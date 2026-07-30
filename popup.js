document.addEventListener('DOMContentLoaded', () => {
    // Initial render
    chrome.bookmarks.getTree((tree) => {
        if (!tree || tree.length === 0) return;
        const root = tree[0].children.find(c => c.title === "Other bookmarks") || tree[0].children[0];
        render(root.id);
    });

    // Open Bookmarks Manager
    document.getElementById('exportSortBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://bookmarks/' });
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
                    try {
                        icon.src = `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}&sz=16`;
                    } catch(e) { icon.src = 'icons/default.png'; }
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