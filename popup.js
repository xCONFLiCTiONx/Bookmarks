// Start fetching storage immediately to minimize wait time
const preferredFolderPromise = new Promise((resolve) => {
    chrome.storage.local.get({ popupRootFolderId: '2', popupRootFolder: '2' }, (result) => {
        resolve(result.popupRootFolderId || result.popupRootFolder || '2');
    });
});

async function getPath(id) {
    let path = [];
    let currentId = id;
    // Cap at 20 levels to avoid any infinite loop or extreme depth performance issues
    for (let i = 0; i < 20; i++) {
        if (!currentId || currentId === "0") break;
        try {
            const nodes = await new Promise(resolve => chrome.bookmarks.get(currentId, resolve));
            if (!nodes || nodes.length === 0) break;
            const node = nodes[0];
            path.unshift(node);
            currentId = node.parentId;
        } catch (e) { break; }
    }
    return path;
}

async function render(folderId) {
    try {
        // Fetch path and children in parallel
        const [path, children] = await Promise.all([
            getPath(folderId),
            new Promise((resolve) => chrome.bookmarks.getChildren(folderId, resolve))
        ]);

        const container = document.createElement('ul');
        container.id = 'bookmarkList';
        const pathFragment = document.createDocumentFragment();

        path.forEach((node, index) => {
            const span = document.createElement('span');
            span.textContent = node.title || (node.id === '0' ? 'Root' : '');
            span.style.cursor = 'pointer';
            span.style.fontWeight = index === path.length - 1 ? 'bold' : 'normal';
            span.onclick = () => render(node.id);
            pathFragment.appendChild(span);
            if (index < path.length - 1) pathFragment.appendChild(document.createTextNode(' > '));
        });

        if (children) {
            children.forEach(node => {
                const li = document.createElement('li');
                if (node.url) {
                    const icon = document.createElement('img');
                    icon.style.marginRight = '10px';
                    icon.style.width = '16px';
                    icon.style.height = '16px';
                    icon.alt = '';
                    icon.decoding = 'async';

                    const defaultIcon = chrome.runtime.getURL('icons/default.png');
                    try {
                        icon.src = getFaviconUrl(node.url, 16);
                    } catch (e) {
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

        const pathContainer = document.getElementById('path-container');
        const oldContainer = document.getElementById('bookmarkList');
        
        if (pathContainer) {
            pathContainer.innerHTML = '';
            pathContainer.appendChild(pathFragment);
        }
        if (oldContainer) {
            oldContainer.replaceWith(container);
        }

    } catch (err) {
        console.error("Render error:", err);
    }
}

async function initializePopup() {
    const preferredId = await preferredFolderPromise;

    // Check if the preferred folder is valid
    chrome.bookmarks.get(preferredId, (results) => {
        if (results && results[0] && !results[0].url) {
            render(preferredId);
        } else {
            // Fallback to "Other Bookmarks" (usually '2')
            chrome.bookmarks.getChildren('0', (rootChildren) => {
                const other = rootChildren.find(c => c.id === '2' || c.title.toLowerCase().includes('other'));
                render(other ? other.id : (rootChildren[0]?.id || '1'));
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializePopup();
    setupNavigationMenu();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.popupRootFolderId) {
            render(changes.popupRootFolderId.newValue);
        }
    });

    // Prevent middle-click scroll behavior
    document.addEventListener('mousedown', (e) => {
        if (e.button === 1) e.preventDefault();
    });

    // Prevent default right-click context menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});
