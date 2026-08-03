const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const popupHtml = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');

assert.ok(manifest.options_ui && manifest.options_ui.page === 'settings.html', 'Manifest should register settings.html as the options page');
assert.doesNotMatch(popupHtml, /id="settingsBtn"/, 'Popup should no longer include a settings button');
assert.match(homeHtml, /id="navBtn"/, 'Home page should include a navigation button');
assert.match(homeHtml, /id="nav-menu"/, 'Home page should include a navigation menu container');

console.log('Options page integration test passed');
