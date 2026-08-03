let allNodesMap = new Map();
let currentContextMenuNode = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeBookmarkPage();
    setupModalListeners();
    setupContextMenuListeners();
    setupFloatingSettingsButton();
});

async function getPreferredRootFolderId() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ popupRootFolderId: '2', popupRootFolder: '2' }, (result) => {
            resolve(result.popupRootFolderId || result.popupRootFolder || '2');
        });
    });
}

function findNodeById(nodes, targetId) {
    for (const node of nodes || []) {
        if (node.id === targetId) return node;
        if (node.children) {
            const found = findNodeById(node.children, targetId);
            if (found) return found;
        }
    }
    return null;
}

function resolveRootNode(bookmarkTree, preferredId) {
    const rootNode = bookmarkTree && bookmarkTree[0];
    if (!rootNode) return null;

    const preferredNode = findNodeById(bookmarkTree, preferredId);
    if (preferredNode && !preferredNode.url) return preferredNode;

    const fallbackNode = findNodeById(bookmarkTree, '2') ||
        (rootNode.children && rootNode.children.find(node => node.title === 'Other bookmarks')) ||
        (rootNode.children && rootNode.children.find(node => !node.url)) ||
        (rootNode.children && rootNode.children[0]);

    return fallbackNode || rootNode;
}

async function initializeBookmarkPage() {
    try {
        const bookmarkTree = await chrome.bookmarks.getTree();
        const preferredRootFolderId = await getPreferredRootFolderId();
        const rootNode = resolveRootNode(bookmarkTree, preferredRootFolderId);
        allNodesMap.clear();

        function traverse(nodes) {
            for (const node of nodes) {
                if (node.url) {
                    allNodesMap.set(node.url, node);
                }
                if (node.children) {
                    traverse(node.children);
                }
            }
        }
        if (rootNode.children) {
            traverse(rootNode.children);
        }

        await renderPinnedBookmarks();
        await renderRecentlyViewed();
        renderAllBookmarksTree(rootNode);
        setupHeaderButtons();

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && (changes.popupRootFolderId || changes.popupRootFolder)) {
                initializeBookmarkPage();
            }
        });
    } catch (error) {
        console.error("Failed to initialize bookmarks:", error);
    }
}

async function getPinnedUrls() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['pinnedBookmarks'], (result) => {
            resolve(result.pinnedBookmarks || []);
        });
    });
}

async function setPinnedUrls(pinned) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ pinnedBookmarks: pinned }, () => {
            resolve();
        });
    });
}

async function getCustomTitles() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['pinnedCustomTitles'], (result) => {
            resolve(result.pinnedCustomTitles || {});
        });
    });
}

async function setCustomTitles(titles) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ pinnedCustomTitles: titles }, () => {
            resolve();
        });
    });
}

function handleCardClick(e, url) {
    if (e.button === 0) {
        window.location.href = url;
    } else if (e.button === 1) {
        chrome.tabs.create({ url: url, active: false });
    }
}

async function renderPinnedBookmarks() {
    const topGrid = document.getElementById('top-used-grid');
    if (!topGrid) return;
    topGrid.innerHTML = '';

    const pinnedUrls = await getPinnedUrls();
    const customTitles = await getCustomTitles();

    pinnedUrls.forEach(url => {
        let node = allNodesMap.get(url);
        let displayTitle = customTitles[url] || (node ? node.title : url);

        const card = document.createElement('div');
        card.className = 'card';
        card.title = displayTitle;

        const img = document.createElement('img');
        img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=16`;
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };

        const span = document.createElement('span');
        span.textContent = displayTitle;

        card.appendChild(img);
        card.appendChild(span);

        card.addEventListener('click', (e) => handleCardClick(e, url));
        card.addEventListener('auxclick', (e) => handleCardClick(e, url));

        card.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pinnedUrls = await getPinnedUrls();
            const isPinned = pinnedUrls.includes(url);
            showContextMenu(e, { url: url, title: displayTitle }, isPinned, true);
        });

        topGrid.appendChild(card);
    });
}

async function renderRecentlyViewed() {
    const recentGrid = document.getElementById('recently-viewed-grid');
    if (!recentGrid) return;

    recentGrid.innerHTML = '';

    chrome.history.search({ text: '', maxResults: 50, startTime: 0 }, async (historyItems) => {
        if (!historyItems) return;

        const uniqueItems = [];
        const seenUrls = new Set();

        for (const item of historyItems) {
            if (!item.url || !item.title) continue;
            if (item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://') || item.url.includes('home.html')) continue;
            
            if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                uniqueItems.push(item);
                if (uniqueItems.length >= 6) break;
            }
        }

        uniqueItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.title = item.title;

            const img = document.createElement('img');
            img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.url)}&sz=16`;
            img.alt = '';
            img.onerror = () => { img.style.display = 'none'; };

            const span = document.createElement('span');
            span.textContent = item.title;

            card.appendChild(img);
            card.appendChild(span);

            card.addEventListener('click', (e) => handleCardClick(e, item.url));
            card.addEventListener('auxclick', (e) => handleCardClick(e, item.url));

            card.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!allNodesMap.has(item.url)) {
                    allNodesMap.set(item.url, { url: item.url, title: item.title });
                }
                const currentPinned = await getPinnedUrls();
                const isPinned = currentPinned.includes(item.url);
                showContextMenu(e, allNodesMap.get(item.url), isPinned, false);
            });

            recentGrid.appendChild(card);
        });
    });
}

function renderAllBookmarksTree(rootNode) {
    const treeList = document.getElementById('all-bookmarks-tree');
    if (!treeList) return;
    treeList.innerHTML = '';

    const rootNodes = rootNode.children || [];
    
    rootNodes.forEach(node => {
        const item = document.createElement('li');
        item.className = 'tree-item';
        item.title = node.title;

        if (node.url) {
            const img = document.createElement('img');
            img.className = 'tree-icon';
            img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(node.url)}&sz=16`;
            img.alt = '';
            img.onerror = () => { img.style.display = 'none'; };

            const span = document.createElement('span');
            span.textContent = node.title;

            item.appendChild(img);
            item.appendChild(span);

            item.addEventListener('click', (e) => handleCardClick(e, node.url));
            item.addEventListener('auxclick', (e) => handleCardClick(e, node.url));

            item.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pinnedUrls = await getPinnedUrls();
                const isPinned = pinnedUrls.includes(node.url);
                showContextMenu(e, node, isPinned, false);
            });
        } else {
            const folderIcon = document.createElement('div');
            folderIcon.className = 'folder-icon-small';

            const span = document.createElement('span');
            span.textContent = node.title;

            item.appendChild(folderIcon);
            item.appendChild(span);
            
            item.addEventListener('click', () => {
                openFolderModal(node, [node]);
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        treeList.appendChild(item);
    });
}

function openFolderModal(folderNode, pathArray) {
    const backdrop = document.getElementById('modal-backdrop');
    const modalBody = document.getElementById('modal-body');
    const breadcrumbs = document.getElementById('modal-breadcrumbs');
    if (!backdrop || !modalBody || !breadcrumbs) return;

    modalBody.innerHTML = '';

    breadcrumbs.innerHTML = '';
    pathArray.forEach((node, index) => {
        if (node.id === "2") return;

        if (index > 0 && breadcrumbs.childNodes.length > 0) {
            const separator = document.createElement('span');
            separator.textContent = ' > ';
            separator.style.color = '#777';
            separator.style.cursor = 'default';
            breadcrumbs.appendChild(separator);
        }

        const crumb = document.createElement('span');
        crumb.textContent = node.title;
        
        if (index === pathArray.length - 1) {
            crumb.style.color = '#fff';
            crumb.style.cursor = 'default';
            crumb.style.fontWeight = '600';
        } else {
            crumb.addEventListener('click', () => {
                const newPath = pathArray.slice(0, index + 1);
                openFolderModal(node, newPath);
            });
        }
        breadcrumbs.appendChild(crumb);
    });

    const children = folderNode.children || [];
    children.forEach(node => {
        const card = document.createElement('div');
        card.className = 'card';
        card.title = node.title;

        if (node.url) {
            const img = document.createElement('img');
            img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(node.url)}&sz=16`;
            img.alt = '';
            img.onerror = () => { img.style.display = 'none'; };
            card.appendChild(img);

            const span = document.createElement('span');
            span.textContent = node.title;
            card.appendChild(span);

            card.addEventListener('click', (e) => handleCardClick(e, node.url));
            card.addEventListener('auxclick', (e) => handleCardClick(e, node.url));

            card.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pinnedUrls = await getPinnedUrls();
                const isPinned = pinnedUrls.includes(node.url);
                showContextMenu(e, node, isPinned, false);
            });
        } else {
            const folderIcon = document.createElement('div');
            folderIcon.className = 'folder-icon-large';

            const span = document.createElement('span');
            span.textContent = node.title;

            card.appendChild(folderIcon);
            card.appendChild(span);
            
            card.addEventListener('click', () => {
                openFolderModal(node, [...pathArray, node]);
            });

            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        modalBody.appendChild(card);
    });

    backdrop.classList.add('active');
}

function showContextMenu(e, node, isPinned, isPinnedSection) {
    currentContextMenuNode = node;
    const menu = document.getElementById('context-menu');
    const actionItem = document.getElementById('context-menu-action');
    const renameItem = document.getElementById('context-menu-rename');
    if (!menu || !actionItem || !renameItem) return;

    actionItem.textContent = isPinned ? 'Remove from Top' : 'Pin to Top';
    
    if (isPinnedSection) {
        renameItem.style.display = 'block';
    } else {
        renameItem.style.display = 'none';
    }

    menu.style.display = 'block';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
}

function setupContextMenuListeners() {
    const menu = document.getElementById('context-menu');
    const actionItem = document.getElementById('context-menu-action');
    const renameItem = document.getElementById('context-menu-rename');

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    document.addEventListener('click', () => {
        if (menu) menu.style.display = 'none';
    });

    if (renameItem) {
        renameItem.addEventListener('click', async () => {
            if (!currentContextMenuNode || !currentContextMenuNode.url) return;
            const url = currentContextMenuNode.url;
            const currentTitle = currentContextMenuNode.title;

            const newTitle = prompt('Enter new name for pinned item:', currentTitle);
            if (newTitle !== null && newTitle.trim() !== '') {
                const customTitles = await getCustomTitles();
                customTitles[url] = newTitle.trim();
                await setCustomTitles(customTitles);
                await renderPinnedBookmarks();
            }
        });
    }

    if (actionItem) {
        actionItem.addEventListener('click', async () => {
            if (!currentContextMenuNode || !currentContextMenuNode.url) return;
            const url = currentContextMenuNode.url;
            if (!allNodesMap.has(url)) {
                allNodesMap.set(url, currentContextMenuNode);
            }

            let pinnedUrls = await getPinnedUrls();
            const index = pinnedUrls.indexOf(url);

            if (index > -1) {
                pinnedUrls.splice(index, 1);
            } else {
                if (pinnedUrls.length >= 18) {
                    alert('You can only pin a maximum of 18 bookmarks.');
                    return;
                }
                pinnedUrls.push(url);
            }

            await setPinnedUrls(pinnedUrls);
            await renderPinnedBookmarks();
        });
    }
}

function setupModalListeners() {
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn && backdrop) {
        closeBtn.addEventListener('click', () => {
            backdrop.classList.remove('active');
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.remove('active');
            }
        });
    }
}

function setupFloatingSettingsButton() {
    const button = document.getElementById('settingsBtn');
    if (!button) return;

    button.addEventListener('click', async () => {
        try {
            await chrome.runtime.openOptionsPage();
        } catch (error) {
            console.error('Failed to open extension settings:', error);
        }
    });
}

async function getToolbarSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ toolbarItems: ['bookmarks', 'contentAll', 'policy', 'siteData', 'settings'] }, (result) => {
            resolve(result.toolbarItems || []);
        });
    });
}

function createToolbarButton(id, title, iconSvg, onClick) {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'icon-btn';
    button.title = title;
    button.type = 'button';
    button.innerHTML = iconSvg;
    button.addEventListener('click', onClick);
    return button;
}

async function setupHeaderButtons() {
    const toolbar = document.getElementById('header-toolbar');
    if (!toolbar) return;

    toolbar.innerHTML = '';

    const enabledItems = await getToolbarSettings();

    const buttonDefinitions = [
        {
            id: 'contentBtn',
            title: 'Content Settings',
            key: 'contentAll',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z"></path><line x1="8.5" y1="10.5" x2="8.51" y2="10.5"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="15.5" y1="10.5" x2="15.51" y2="10.5"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/content/all' })
        },
        {
            id: 'policyBtn',
            title: 'Policy Viewer',
            key: 'policy',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://policy' })
        },
        {
            id: 'siteDataBtn',
            title: 'Site Data',
            key: 'siteData',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 2v4"></path><path d="M16 2v4"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/siteData' })
        },
        {
            id: 'chromeManagerBtn',
            title: 'Open Native Bookmark Manager',
            key: 'bookmarks',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://bookmarks/' })
        },
        {
            id: 'chromeSettingsBtn',
            title: 'Chrome Settings',
            key: 'settings',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/' })
        },
    ];

    buttonDefinitions.forEach((buttonDef) => {
        if (enabledItems.includes(buttonDef.key)) {
            toolbar.appendChild(createToolbarButton(buttonDef.id, buttonDef.title, buttonDef.svg, buttonDef.onClick));
        }
    });
}