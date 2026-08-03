// Background service worker (Manifest V3)
// Opens popup.html in a separate positioned popup window when the extension action is clicked.

const NEW_WIDTH = 380; // matches popup content width
const NEW_HEIGHT = 600; // adjust if needed
const RIGHT_OFFSET = 16; // how far from the right edge of the current browser window
const TOP_OFFSET = 40; // vertical offset from the top of the current window (tweak as needed)

chrome.action.onClicked.addListener((tab) => {
  // Get the current focused browser window so the new popup can be positioned relative to it.
  chrome.windows.getCurrent({populate: false}, (currentWindow) => {
    let left, top;

    if (currentWindow && typeof currentWindow.left === 'number' && typeof currentWindow.width === 'number') {
      left = currentWindow.left + currentWindow.width - NEW_WIDTH - RIGHT_OFFSET;
      // place the popup slightly below the top of the browser window
      top = (typeof currentWindow.top === 'number') ? currentWindow.top + TOP_OFFSET : TOP_OFFSET;

      // clamp to 0 to avoid negative coordinates
      if (left < 0) left = 0;
      if (top < 0) top = 0;
    }

    const createInfo = {
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: NEW_WIDTH,
      height: NEW_HEIGHT
    };

    if (typeof left === 'number') createInfo.left = left;
    if (typeof top === 'number') createInfo.top = top;

    chrome.windows.create(createInfo, (newWindow) => {
      // Optional: focus the new popup
      if (newWindow && newWindow.id) {
        chrome.windows.update(newWindow.id, { focused: true });
      }
    });
  });
});