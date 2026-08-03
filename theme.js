(function () {
  function getStoredTheme(defaultTheme = 'system') {
    return new Promise((resolve) => {
      chrome.storage.local.get({ theme: defaultTheme }, (result) => {
        resolve(result.theme || defaultTheme);
      });
    });
  }

  function resolveTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    if (theme === 'system' || !theme) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }

      return 'light';
    }

    return 'light';
  }

  function applyTheme(theme) {
    const resolvedTheme = resolveTheme(theme || 'system');
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body?.setAttribute('data-theme', resolvedTheme);
    document.body?.classList.toggle('theme-dark', resolvedTheme === 'dark');
    document.body?.classList.toggle('theme-light', resolvedTheme === 'light');
  }

  window.applyTheme = applyTheme;

  async function initializeTheme() {
    const theme = await getStoredTheme('system');
    applyTheme(theme);

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.theme) {
          applyTheme(changes.theme.newValue || 'system');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTheme);
  } else {
    initializeTheme();
  }
})();
