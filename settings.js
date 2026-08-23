document.addEventListener('DOMContentLoaded', () => {
  chrome.bookmarks.getTree(tree => {
    const select = document.getElementById('popupRootFolder');
    populateFolderSelect(select, tree);
    loadSettings();
  });
});

function applyThemeToSettingsPage(theme) {
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = theme || 'system';
  }
}

function populateFolderSelect(select, nodes, depth = 0) {
  nodes.forEach(node => {
    if (!node.url) {
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = `${'— '.repeat(depth)}${node.title || 'Folder'}`;
      select.appendChild(option);

      if (node.children) {
        populateFolderSelect(select, node.children, depth + 1);
      }
    }
  });
}

function loadSettings() {
  chrome.storage.local.get({
    popupRootFolderId: '2',
    popupRootFolder: '2',
    theme: 'system'
  }, settings => {

    const savedRootFolderId = settings.popupRootFolderId || settings.popupRootFolder || '2';
    document.getElementById('popupRootFolder').value = savedRootFolderId;

    applyThemeToSettingsPage(settings.theme);
    attachSaveHandlers();
    saveSettings();
  });
}

function attachSaveHandlers() {
  document.getElementById('popupRootFolder').addEventListener('change', saveSettings);
  document.getElementById('themeSelect').addEventListener('change', saveSettings);
}

function saveSettings() {
  const popupRootFolderId = String(document.getElementById('popupRootFolder').value || '2');
  const theme = document.getElementById('themeSelect').value;

  chrome.storage.local.set({
    popupRootFolderId,
    popupRootFolder: popupRootFolderId,
    theme
  });

  if (window.applyTheme) {
    window.applyTheme(theme);
  }
}
