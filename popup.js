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

function resolveInitialFolderId(tree, preferredId) {
    const rootNode = tree && tree[0];
    if (!rootNode) return '2';

    const preferredNode = findNodeById(tree, preferredId);
    if (preferredNode && !preferredNode.url) return preferredNode.id;

    const fallbackNode = findNodeById(tree, '2') ||
        (rootNode.children && rootNode.children.find(node => node.title === 'Other bookmarks')) ||
        (rootNode.children && rootNode.children.find(node => !node.url)) ||
        (rootNode.children && rootNode.children[0]);

    return fallbackNode?.id || rootNode.id || '2';
}

async function renderPreferredRootFolder() {
    const preferredRootFolderId = await getPreferredRootFolderId();

    chrome.bookmarks.getTree((tree) => {
        if (!tree || tree.length === 0) return;
        const rootId = resolveInitialFolderId(tree, preferredRootFolderId);
        render(rootId);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await renderPreferredRootFolder();
    setupNavigationMenu();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.popupRootFolderId) {
            renderPreferredRootFolder();
        }
    });

    // Prevent middle-click scroll behavior globally inside the popup body
    document.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
            e.preventDefault();
        }
    });

    // Prevent default right-click context menu globally across the popup
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});



async function getPath(id) {
    let path = [];
    let currentId = id;
    while (currentId && currentId !== "0") {
        try {
            let node = await new Promise((resolve) => chrome.bookmarks.get(currentId, resolve));
            if (!node || !node[0]) break;
            path.unshift(node[0]);
            currentId = node[0].parentId;
        } catch (e) { break; }
    }
    return path;
}

async function render(folderId) {
    try {
        const path = await getPath(folderId);
        const children = await new Promise((resolve) => chrome.bookmarks.getChildren(folderId, resolve));

        const container = document.createElement('ul');
        const pathContainer = document.createElement('div');
        pathContainer.id = 'path-container';

        path.forEach((node, index) => {
            const span = document.createElement('span');
            span.textContent = node.title;
            span.style.cursor = 'pointer';
            span.style.fontWeight = index === path.length - 1 ? 'bold' : 'normal';
            span.onclick = () => render(node.id);
            pathContainer.appendChild(span);
            if (index < path.length - 1) pathContainer.appendChild(document.createTextNode(' > '));
        });

        if (children) {
            children.forEach(node => {
                const li = document.createElement('li');
                if (node.url) {
                    const icon = document.createElement('img');
                    icon.style.marginRight = '10px'; icon.style.width = '16px'; icon.style.height = '16px';
                    icon.alt = '';
                    icon.decoding = 'async';
                    const defaultIcon = chrome.runtime.getURL('icons/default.png');
                    const hostname = (() => {
                        try {
                            return new URL(node.url).hostname;
                        } catch (e) {
                            return null;
                        }
                    })();

                    if (hostname) {
                        icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=16`;
                    } else {
                        icon.src = defaultIcon;
                    }

                    icon.onerror = () => {
                        icon.onerror = null;
                        icon.src = defaultIcon;
                    };

                    li.appendChild(icon);
                    li.appendChild(document.createTextNode(node.title));
                    
                    li.addEventListener('mousedown', (e) => {
                        if (e.button === 0) { 
                            chrome.tabs.update({url: node.url}); 
                            window.close(); 
                        } else if (e.button === 2) {
                            chrome.tabs.create({url: node.url, active: true});
                        }
                    });
                    li.addEventListener('auxclick', (e) => {
                        if (e.button === 1) { 
                            e.preventDefault(); 
                            chrome.tabs.create({url: node.url, active: false}); 
                        }
                    });
                } else {
                    const folderIcon = document.createElement('div');
                    folderIcon.className = 'folder-icon';
                    li.appendChild(folderIcon);
                    li.appendChild(document.createTextNode(node.title));
                    li.onclick = () => render(node.id);
                    li.addEventListener('mousedown', (e) => {
                        if (e.button === 2) {
                            e.preventDefault();
                        }
                    });
                }
                container.appendChild(li);
            });
        }

        const oldPathContainer = document.getElementById('path-container');
        const oldContainer = document.getElementById('bookmarkList');
        
        oldPathContainer.replaceWith(pathContainer);
        oldContainer.replaceWith(container);
        container.id = 'bookmarkList';

    } catch (err) {
        console.error("Render error:", err);
    }
}