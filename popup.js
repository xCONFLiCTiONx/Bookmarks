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
    await renderToolbar();

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
    button.className = 'footer-btn';
    button.title = title;
    button.type = 'button';
    button.innerHTML = iconSvg;
    button.addEventListener('click', onClick);
    return button;
}

async function renderToolbar() {
    const footer = document.getElementById('footer-row');
    if (!footer) return;

    footer.innerHTML = '';
    const enabledItems = await getToolbarSettings();

    const buttonDefinitions = [
        {
            id: 'exportSortBtn',
            title: 'Bookmarks Manager',
            key: 'bookmarks',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://bookmarks/' })
        },
        {
            id: 'contentBtn',
            title: 'Cookies Settings',
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
            id: 'chromeSettingsBtn',
            title: 'Chrome Settings',
            key: 'settings',
            svg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/' })
        }
    ];

    buttonDefinitions.forEach((buttonDef) => {
        if (enabledItems.includes(buttonDef.key)) {
            footer.appendChild(createToolbarButton(buttonDef.id, buttonDef.title, buttonDef.svg, buttonDef.onClick));
        }
    });
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