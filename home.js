let allNodesMap = new Map();
let currentContextMenuNode = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeBookmarkPage();
    setupModalListeners();
    setupContextMenuListeners();
    setupNavigationMenu();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.popupRootFolderId || changes.popupRootFolder) {
                initializeBookmarkPage();
            }
        }
    });
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
        img.src = getFaviconUrl(url, 16);
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
            img.src = getFaviconUrl(item.url, 16);
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
            img.src = getFaviconUrl(node.url, 16);
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
            img.src = getFaviconUrl(node.url, 16);
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



