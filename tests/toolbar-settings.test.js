const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const popupHtml = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');

assert.match(popupHtml, /id="navBtn"/, 'Popup should have a navigation button');
assert.match(popupHtml, /id="nav-menu"/, 'Popup should have a navigation menu container');
assert.match(homeHtml, /id="header-toolbar"/, 'Home page should have a header toolbar container');
assert.match(settingsHtml, /id="themeSelect"/, 'Settings page should expose the theme selector');
assert.match(settingsHtml, /id="item_bookmarks"/, 'Settings page should expose the bookmarks toolbar option');

console.log('Toolbar settings test passed');
