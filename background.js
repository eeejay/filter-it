const YELLOW_ON_BLACK = [ -0.2126, -0.2126, -0.2126, 0,
                          -0.7152, -0.7152, -0.7152, 0,
                          -0.0722, -0.0722, -0.0722, 0,
                          0, 0, 0, 1,
                          1, 1, 0, 0 ];

const REINVERT_IMAGES_CSS = `
em, img, svg, image, video, audio, embed, iframe, object, button, canvas, figure:empty {
  filter: invert(100%) !important;
}

button > img {
  filter: initial;
}

.img:empty,
.btn:empty,
.logo:empty,
.image:empty,
.photo:empty,
.button:empty,
[role='button'],
input[type='checkbox'],
[style*='background:url']:not(html):not(body):not(input),
[style*='background: url']:not(html):not(body):not(input),
[style*='background-image']:not(html):not(body):not(input) {
  filter: invert(100%) !important;
}
`;

function loadCSS(tabId) {
  return browser.tabs.insertCSS(tabId,
    { allFrames: true, code: REINVERT_IMAGES_CSS, runAt: "document_start" });
}

function unloadCSS(tabId) {
  return browser.tabs.removeCSS(tabId,
    { allFrames: true, code: REINVERT_IMAGES_CSS, runAt: "document_start" });
}


function updateIcon(tabId, hasFilter) {
  browser.browserAction.setIcon({
    path: hasFilter ? {
      19: "icons/filter-filled-19.png",
      38: "icons/filter-filled-38.png"
    } : {
      19: "icons/filter-empty-19.png",
      38: "icons/filter-empty-38.png"
    },
    tabId
  });
  browser.browserAction.setTitle({
    // Screen readers can see the title
    title: hasFilter ? 'Unfilter it!' : 'Filter it!',
    tabId
  });
}

/*
 * Add or remove the filter on the current tab.
 */
async function toggleFilter() {
  let [activeTab] = await browser.tabs.query({active: true, currentWindow: true});
  let hasFilter = !!(await browser.filters.getColorFilter(activeTab.id)).length;
  if (hasFilter) {
    unloadCSS(activeTab.id);
    await browser.filters.setColorFilter(activeTab.id);
  } else {
    loadCSS(activeTab.id);
    await browser.filters.setColorFilter(activeTab.id, YELLOW_ON_BLACK);
  }
  updateIcon(activeTab.id, !hasFilter);
}

browser.browserAction.onClicked.addListener(toggleFilter);

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo && changeInfo.url) {
    browser.filters.getColorFilter(tabId).then(matrix => {
      if (matrix.length) {
        loadCSS(tabId);
        updateIcon(tabId, true);
      }
    });
  }
});
