function getNavigationItems() {
    return [
        {
            id: 'bookmarks',
            title: 'Bookmarks Manager',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://bookmarks/' })
        },
        {
            id: 'settings',
            title: 'Chrome Settings',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M9 14h6"></path><path d="M9 18h4"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/' })
        },
        {
            id: 'passwords',
            title: 'Password Manager',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0,1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://password-manager/passwords' })
        },
        {
            id: 'contentAll',
            title: 'Cookies',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z"></path><line x1="8.5" y1="10.5" x2="8.51" y2="10.5"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="15.5" y1="10.5" x2="15.51" y2="10.5"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/content/all' })
        },
        {
            id: 'extensions',
            title: 'Extensions',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11V7.5C21 6.4 20.1 5.5 19 5.5H15C15 4.1 13.9 3 12.5 3S10 4.1 10 5.5H6C4.9 5.5 4 6.4 4 7.5V11C5.4 11 6.5 12.1 6.5 13.5S5.4 16 4 16V19.5C4 20.6 4.9 21.5 6 21.5H9.5C9.5 22.9 10.6 24 12.5 24S15 22.9 15 21.5H19C20.1 21.5 21 20.6 21 19.5V16C19.6 16 18.5 14.9 18.5 13.5S19.6 11 21 11Z"/></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://extensions/' })
        },
        {
            id: 'policy',
            title: 'Policy Viewer',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://policy' })
        },
        {
            id: 'extensionSettings',
            title: 'Extension Settings',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z"></path></svg>',
            onClick: () => {
                if (window.location.pathname.endsWith('/home.html')) {
                    window.location.href = 'settings.html';
                } else {
                    chrome.runtime.openOptionsPage();
                }
            }
        }
    ];
}

function getFaviconUrl(url, size = 16) {
    const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
    faviconUrl.searchParams.set('pageUrl', url);
    faviconUrl.searchParams.set('size', size.toString());
    return faviconUrl.toString();
}

function renderNavigationMenu(menu) {
    const items = getNavigationItems();

    // Separate Extension Settings
    const otherItems = items.filter(item => item.id !== 'extensionSettings');
    const settingsItem = items.find(item => item.id === 'extensionSettings');

    // Sort other items alphabetically by title
    otherItems.sort((a, b) => a.title.localeCompare(b.title));

    menu.innerHTML = '';

    const renderItem = (item) => {
        const row = document.createElement('div');
        row.className = 'navigation-menu-item';
        row.innerHTML = `<span>${item.svg}</span><span>${item.title}</span>`;
        row.addEventListener('click', () => {
            menu.classList.remove('active');
            item.onClick();
        });
        menu.appendChild(row);
    };

    otherItems.forEach(renderItem);

    if (settingsItem) {
        const divider = document.createElement('div');
        divider.className = 'navigation-divider';
        menu.appendChild(divider);
        renderItem(settingsItem);
    }
}

function setupNavigationMenu() {
    const navButton = document.getElementById('navBtn');
    const navMenu = document.getElementById('nav-menu');
    if (!navButton || !navMenu) return;

    navButton.addEventListener('click', (e) => {
        e.stopPropagation();
        renderNavigationMenu(navMenu);
        navMenu.classList.toggle('active');
    });

    navMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
}
