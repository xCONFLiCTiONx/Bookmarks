document.addEventListener('DOMContentLoaded', () => {
    // Initial render
    chrome.bookmarks.getTree((tree) => {
        if (!tree || tree.length === 0) return;
        const root = tree[0].children.find(c => c.title === "Other bookmarks") || tree[0].children[0];
        render(root.id);
    });

    // Button action: Sort bookmarks then open native manager
    document.getElementById('exportSortBtn').addEventListener('click', async () => {
        const btn = document.getElementById('exportSortBtn');
        btn.disabled = true;
        btn.textContent = 'Sorting...';

        try {
            const tree = await new Promise((resolve) => chrome.bookmarks.getTree(resolve));
            
            // 1. Physically sort and move in Chrome
            await sortAndMoveBookmarks(tree[0]);
            
            // 2. Open the native Chrome Bookmark Manager for export
            chrome.tabs.create({ url: 'chrome://bookmarks/?id=2' });

            // 3. Re-render UI after sorting is complete
            render(tree[0].children[0].id);
        } catch (err) {
            console.error("Sort error:", err);
            alert("Error: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Bookmark Manager';
        }
    });
});

async function sortAndMoveBookmarks(node) {
    if (!node.children || node.children.length === 0) return;

    const sortedChildren = [...node.children].sort((a, b) => {
        const aIsFolder = !a.url;
        const bIsFolder = !b.url;
        if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
    });

    for (let i = 0; i < sortedChildren.length; i++) {
        if (sortedChildren[i].index !== i) {
            await new Promise((resolve) => {
                chrome.bookmarks.move(sortedChildren[i].id, { index: i, parentId: node.id }, resolve);
            });
        }
        await sortAndMoveBookmarks(sortedChildren[i]);
    }
}

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
        const container = document.getElementById('bookmarkList');
        const pathContainer = document.getElementById('path-container');
        container.innerHTML = '';
        pathContainer.innerHTML = '';

        const path = await getPath(folderId);
        path.forEach((node, index) => {
            const span = document.createElement('span');
            span.textContent = node.title;
            span.style.cursor = 'pointer';
            span.style.fontWeight = index === path.length - 1 ? 'bold' : 'normal';
            span.onclick = () => render(node.id);
            pathContainer.appendChild(span);
            if (index < path.length - 1) pathContainer.appendChild(document.createTextNode(' > '));
        });

        chrome.bookmarks.getChildren(folderId, (children) => {
            if (!children) return;
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
                    li.onmousedown = (e) => {
                        if (e.button === 0) { chrome.tabs.update({url: node.url}); window.close(); }
                        else if (e.button === 1) { chrome.tabs.create({url: node.url, active: false}); }
                    };
                } else {
                    const folderIcon = document.createElement('div');
                    folderIcon.className = 'folder-icon';
                    li.appendChild(folderIcon);
                    li.appendChild(document.createTextNode(node.title));
                    li.onclick = () => render(node.id);
                }
                container.appendChild(li);
            });
        });
    } catch (err) {
        console.error("Render error:", err);
    }
}