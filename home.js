let allNodesMap = new Map();
let currentContextMenuNode = null;
let dragSource = null;
let currentModalPath = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeBookmarkPage();
    setupModalListeners();
    setupContextMenuListeners();
    setupNavigationMenu();
    setupHistoryPanel();

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
        // Optionally sort bookmarks alphabetically before rendering
        await sortAllBookmarksAlphabetically();

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
        traverse(bookmarkTree);

        await renderPinnedBookmarks();
        await renderRecentlyViewed();
        renderAllBookmarksTree(rootNode);
    } catch (error) {
        console.error("Failed to initialize bookmarks:", error);
    }
}

async function sortAllBookmarksAlphabetically() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ sortAlphabetically: false }, async (result) => {
            if (result.sortAlphabetically) {
                try {
                    const tree = await chrome.bookmarks.getTree();
                    if (tree && tree[0]) {
                        await sortNodeRecursive(tree[0]);
                    }
                } catch (err) {
                    console.error("Sorting failed:", err);
                }
            }
            resolve();
        });
    });
}

async function sortNodeRecursive(node) {
    if (node.children && node.children.length > 0) {
        // Create a copy to sort
        const sortedChildren = [...node.children].sort((a, b) => {
            // Folders first, then bookmarks
            if (!a.url && b.url) return -1;
            if (a.url && !b.url) return 1;
            return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        // Check if order needs to be updated
        let needsUpdate = false;
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].id !== sortedChildren[i].id) {
                needsUpdate = true;
                break;
            }
        }

        if (needsUpdate) {
            for (let i = 0; i < sortedChildren.length; i++) {
                // Move each child to its correct position if it's not already there
                // This is safer than moving everything blindly
                await new Promise((resolveMove) => {
                    chrome.bookmarks.move(sortedChildren[i].id, { index: i }, () => resolveMove());
                });
            }
        }

        // Recursively sort folders
        for (const child of node.children) {
            if (!child.url) {
                await sortNodeRecursive(child);
            }
        }
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

function handleDragStart(e) {
    dragSource = this;
    e.dataTransfer.effectAllowed = 'move';

    // Use a custom type to prevent Chrome from interpreting this as a URL drag
    const dragData = {
        url: this.dataset.url,
        id: this.dataset.id,
        isFolder: this.dataset.isFolder === 'true',
        type: this.closest('#top-used-grid') ? 'pinned' : 'chrome'
    };

    e.dataTransfer.setData('application/x-bookmark-data', JSON.stringify(dragData));
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== dragSource) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const rawData = e.dataTransfer.getData('application/x-bookmark-data');
    if (!rawData) return false;

    // Clear all drag-over classes immediately
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    const dragData = JSON.parse(rawData);
    const target = this;

    // Case 1: Dropping into the Pinned Grid (for reordering pinned items)
    if (target.closest('#top-used-grid') && dragSource && dragSource.closest('#top-used-grid')) {
        const topGrid = document.getElementById('top-used-grid');
        const cards = Array.from(topGrid.querySelectorAll('.card'));
        const fromIndex = cards.indexOf(dragSource);
        const toIndex = cards.indexOf(this);

        if (fromIndex !== -1 && toIndex !== -1) {
            let pinnedUrls = await getPinnedUrls();
            const movedUrl = pinnedUrls.splice(fromIndex, 1)[0];
            pinnedUrls.splice(toIndex, 0, movedUrl);
            await setPinnedUrls(pinnedUrls);
            await renderPinnedBookmarks();
        }
        return false;
    }

    // Case 2: Dropping an All-Bookmarks item (or Pinned item) into a Folder or near a Bookmark
    if (dragData.id) {
        const targetId = target.dataset.id;
        const targetIsFolder = target.dataset.isFolder === 'true';

        // Don't allow dropping an item onto itself
        if (dragData.id === targetId) return false;

        try {
            if (targetIsFolder) {
                // Move into the folder (at the end)
                await chrome.bookmarks.move(dragData.id, { parentId: targetId });
            } else {
                // Reorder: Move to the same folder as target
                const targetNode = (await chrome.bookmarks.get(targetId))[0];
                const dragNode = (await chrome.bookmarks.get(dragData.id))[0];

                if (!targetNode) return false;

                // Move source item to target's index
                await chrome.bookmarks.move(dragData.id, {
                    parentId: targetNode.parentId,
                    index: targetNode.index
                });
            }

            // Increase delay slightly to ensure Chrome has finished the update
            await new Promise(r => setTimeout(r, 150));

            // Refresh main page components
            await initializeBookmarkPage();

            // Refresh modal if open
            if (currentModalPath) {
                const lastNode = currentModalPath[currentModalPath.length - 1];
                // Refetch the folder tree to get the new child order
                const updatedTree = await chrome.bookmarks.getSubTree(lastNode.id);
                if (updatedTree && updatedTree[0]) {
                    openFolderModal(updatedTree[0], currentModalPath);
                }
            }
        } catch (err) {
            console.error("Failed to move bookmark:", err);
        }
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
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
        card.draggable = true;
        card.dataset.url = url;
        if (node) card.dataset.id = node.id;

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

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

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
        item.draggable = true;
        item.dataset.id = node.id;
        item.dataset.url = node.url || '';
        item.dataset.isFolder = !node.url;

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
                openFolderModal(node, [rootNode, node]);
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        treeList.appendChild(item);
    });
}

function openFolderModal(folderNode, pathArray) {
    currentModalPath = pathArray;
    const backdrop = document.getElementById('modal-backdrop');
    const modalBody = document.getElementById('modal-body');
    const breadcrumbs = document.getElementById('modal-breadcrumbs');
    if (!backdrop || !modalBody || !breadcrumbs) return;

    modalBody.innerHTML = '';
    // Also make modal body a drop target to move items into this folder
    modalBody.dataset.id = folderNode.id;
    modalBody.dataset.isFolder = 'true';
    modalBody.addEventListener('dragover', handleDragOver);
    modalBody.addEventListener('dragenter', handleDragEnter);
    modalBody.addEventListener('dragleave', handleDragLeave);
    modalBody.addEventListener('drop', handleDrop);

    breadcrumbs.innerHTML = '';
    pathArray.forEach((node, index) => {
        if (node.id === "0") return;

        if (breadcrumbs.childNodes.length > 0) {
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

        // Make breadcrumbs drop targets too!
        crumb.dataset.id = node.id;
        crumb.dataset.isFolder = 'true';
        crumb.addEventListener('dragover', handleDragOver);
        crumb.addEventListener('dragenter', handleDragEnter);
        crumb.addEventListener('dragleave', handleDragLeave);
        crumb.addEventListener('drop', handleDrop);

        breadcrumbs.appendChild(crumb);
    });

    const children = folderNode.children || [];
    children.forEach(node => {
        const card = document.createElement('div');
        card.className = 'card';
        card.title = node.title;
        card.draggable = true;
        card.dataset.id = node.id;
        card.dataset.url = node.url || '';
        card.dataset.isFolder = !node.url;

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

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

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
            currentModalPath = null;
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.remove('active');
                currentModalPath = null;
            }
        });
    }
}

function setupHistoryPanel() {
    const panel = document.getElementById('history-panel');
    const trigger = document.getElementById('history-trigger');
    if (!panel || !trigger) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = panel.classList.toggle('active');
        if (isActive) {
            renderSessionHistory();
        }
    });

    document.addEventListener('click', (e) => {
        if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // Refresh history when items are closed or sessions change
    if (chrome.sessions && chrome.sessions.onChanged) {
        chrome.sessions.onChanged.addListener(() => {
            if (panel.classList.contains('active')) {
                renderSessionHistory();
            }
        });
    }
}

async function renderSessionHistory() {
    const unifiedList = document.getElementById('history-unified-list');
    if (!unifiedList) return;

    unifiedList.innerHTML = '';

    chrome.windows.getCurrent((currentWin) => {
        const currentWindowId = currentWin.id;

        chrome.sessions.getRecentlyClosed({ maxResults: 25 }, (sessions) => {
            if (!sessions) return;

            const currentWindowTabs = [];
            const otherClosedTabs = [];
            const closedWindows = [];

            sessions.forEach(s => {
                if (s.window) {
                    closedWindows.push(s.window);
                } else if (s.tab) {
                    if (s.tab.windowId === currentWindowId) {
                        currentWindowTabs.push(s.tab);
                    } else {
                        otherClosedTabs.push(s.tab);
                    }
                }
            });

            // Limit the recently closed tabs list to a maximum of 7 items
            const limitedOtherClosedTabs = otherClosedTabs.slice(0, 7);

            // Helper to render a tab list
            const renderTabGroup = (tabs, title, iconSvg) => {
                if (tabs.length === 0) return;

                const container = document.createElement('div');
                container.className = 'window-entry';

                const header = document.createElement('div');
                header.className = 'history-item window-header';
                header.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${iconSvg}
                        <span class="title">${title}</span>
                    </div>
                `;
                header.style.cursor = 'default';
                container.appendChild(header);

                const tabsSubList = document.createElement('div');
                tabsSubList.className = 'window-tabs';

                tabs.forEach(tab => {
                    const tabItem = document.createElement('div');
                    tabItem.className = 'history-item window-tab-item';

                    const img = document.createElement('img');
                    img.src = getFaviconUrl(tab.url, 16);
                    img.alt = '';
                    img.onerror = () => { img.style.display = 'none'; };

                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'title';
                    titleSpan.textContent = tab.title || tab.url || 'Untitled';

                    tabItem.appendChild(img);
                    tabItem.appendChild(titleSpan);

                    const restoreBtn = document.createElement('span');
                    restoreBtn.className = 'restore-btn';
                    restoreBtn.textContent = 'Restore';
                    tabItem.appendChild(restoreBtn);

                    tabItem.addEventListener('click', () => {
                        chrome.sessions.restore(tab.sessionId);
                    });

                    tabsSubList.appendChild(tabItem);
                });
                container.appendChild(tabsSubList);
                unifiedList.appendChild(container);
            };

            const winIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
            const tabIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';

            // Render Groups
            renderTabGroup(currentWindowTabs, 'Current Window (Closed Tabs)', winIcon);
            renderTabGroup(limitedOtherClosedTabs, 'Recently Closed Tabs', tabIcon);

            // Render other Closed Windows
            closedWindows.forEach(windowSession => {
                const windowContainer = document.createElement('div');
                windowContainer.className = 'window-entry';

                const tabCount = windowSession.tabs ? windowSession.tabs.length : 0;
                const title = `Closed Window (${tabCount} tabs)`;
                const header = createHistoryItem({ title: title, url: '' }, windowSession.sessionId, true);
                header.classList.add('window-header');
                windowContainer.appendChild(header);

                if (windowSession.tabs && windowSession.tabs.length > 0) {
                    const tabsSubList = document.createElement('div');
                    tabsSubList.className = 'window-tabs';

                    windowSession.tabs.forEach(tab => {
                        const tabItem = document.createElement('div');
                        tabItem.className = 'history-item window-tab-item';

                        const img = document.createElement('img');
                        img.src = getFaviconUrl(tab.url, 16);
                        img.alt = '';
                        img.onerror = () => { img.style.display = 'none'; };

                        const titleSpan = document.createElement('span');
                        titleSpan.className = 'title';
                        titleSpan.textContent = tab.title || tab.url || 'Untitled';

                        tabItem.appendChild(img);
                        tabItem.appendChild(titleSpan);

                        tabItem.addEventListener('click', (e) => {
                            e.stopPropagation();
                            chrome.sessions.restore(windowSession.sessionId);
                        });

                        tabsSubList.appendChild(tabItem);
                    });
                    windowContainer.appendChild(tabsSubList);
                }

                unifiedList.appendChild(windowContainer);
            });

            if (unifiedList.innerHTML === '') {
                unifiedList.innerHTML = '<div class="history-item" style="cursor: default; opacity: 0.5;">No session history</div>';
            }
        });
    });
}

function createHistoryItem(data, sessionId, isWindow = false) {
    const item = document.createElement('div');
    item.className = 'history-item';

    if (!isWindow) {
        const img = document.createElement('img');
        img.src = getFaviconUrl(data.url, 16);
        img.alt = '';
        img.onerror = () => { img.style.display = 'none'; };
        item.appendChild(img);
    } else {
        const icon = document.createElement('div');
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        item.appendChild(icon);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    titleSpan.textContent = data.title || data.url || 'Untitled';
    item.appendChild(titleSpan);

    const restoreBtn = document.createElement('span');
    restoreBtn.className = 'restore-btn';
    restoreBtn.textContent = 'Restore';
    item.appendChild(restoreBtn);

    item.addEventListener('click', () => {
        chrome.sessions.restore(sessionId, (restoredSession) => {
            if (chrome.runtime.lastError) {
                console.error("Error restoring session:", chrome.runtime.lastError);
            }
        });
    });

    return item;
}