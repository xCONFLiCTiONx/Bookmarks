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
    toolbarItems: ['bookmarks', 'contentAll', 'policy', 'siteData', 'settings'],
    theme: 'system'
  }, settings => {

    const savedRootFolderId = settings.popupRootFolderId || settings.popupRootFolder || '2';
    document.getElementById('popupRootFolder').value = savedRootFolderId;

    const items = settings.toolbarItems;

    document.getElementById('item_bookmarks').checked = items.includes('bookmarks');
    document.getElementById('item_contentAll').checked = items.includes('contentAll');
    document.getElementById('item_policy').checked = items.includes('policy');
    document.getElementById('item_siteData').checked = items.includes('siteData');
    document.getElementById('item_settings').checked = items.includes('settings');

    applyThemeToSettingsPage(settings.theme);
    attachSaveHandlers();
    saveSettings();
  });
}

function attachSaveHandlers() {
  document.getElementById('popupRootFolder').addEventListener('change', saveSettings);
  document.getElementById('themeSelect').addEventListener('change', saveSettings);

  const ids = [
    'item_bookmarks',
    'item_contentAll',
    'item_policy',
    'item_siteData',
    'item_settings'
  ];

  ids.forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });
}

function saveSettings() {
  const popupRootFolderId = String(document.getElementById('popupRootFolder').value || '2');
  const theme = document.getElementById('themeSelect').value;

  const toolbarItems = [];
  if (document.getElementById('item_bookmarks').checked) toolbarItems.push('bookmarks');
  if (document.getElementById('item_contentAll').checked) toolbarItems.push('contentAll');
  if (document.getElementById('item_policy').checked) toolbarItems.push('policy');
  if (document.getElementById('item_siteData').checked) toolbarItems.push('siteData');
  if (document.getElementById('item_settings').checked) toolbarItems.push('settings');

  // Extension Options ALWAYS included
  toolbarItems.push('options');

  chrome.storage.local.set({
    popupRootFolderId,
    popupRootFolder: popupRootFolderId,
    toolbarItems,
    theme
  });

  if (window.applyTheme) {
    window.applyTheme(theme);
  }
}
