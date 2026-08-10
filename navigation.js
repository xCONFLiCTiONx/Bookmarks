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
            id: 'contentAll',
            title: 'Cookies',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z"></path><line x1="8.5" y1="10.5" x2="8.51" y2="10.5"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="15.5" y1="10.5" x2="15.51" y2="10.5"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://settings/content/all' })
        },
        {
            id: 'extensions',
            title: 'Extensions',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.45 10.15C19.79 10.6 20 11.26 20 12s-.21 1.4-.55 1.85l1.55 1.55c.4.4.4 1.05 0 1.45l-1.45 1.45c-.4.4-1.05.4-1.45 0l-1.55-1.55C13.4 19.79 12.75 20 12 20s-1.4-.21-1.85-.55l-1.55 1.55c-.4.4-1.05.4-1.45 0l-1.45-1.45c-.4-.4-.4-1.05 0-1.45l1.55-1.55C4.21 13.4 4 12.75 4 12s.21-1.4.55-1.85L3 8.6c-.4-.4-.4-1.05 0-1.45l1.45-1.45c.4-.4 1.05-.4 1.45 0l1.55 1.55C10.6 4.21 11.26 4 12 4s1.4.21 1.85.55l1.55-1.55c.4-.4 1.05-.4 1.45 0l1.45 1.45c.4.4.4 1.05 0 1.45l-1.55 1.55z"/></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://extensions/' })
        },
        {
            id: 'policy',
            title: 'Policy Viewer',
            svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            onClick: () => chrome.tabs.create({ url: 'chrome://policy' })
        },{
              id: 'extensionSettings',
              title: 'Extension Settings',
              svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z"></path></svg>',
              onClick: () => chrome.runtime.openOptionsPage()
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
    menu.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'navigation-menu-item';
        row.innerHTML = `<span>${item.svg}</span><span>${item.title}</span>`;
        row.addEventListener('click', () => {
            menu.classList.remove('active');
            item.onClick();
        });
        menu.appendChild(row);
    });
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
