const YELLOW_ON_BLACK = [
  -0.2126, -0.7152, -0.0722, 0, 1,
  -0.2126, -0.7152, -0.0722, 0, 1,
  -0.2126, -0.7152, -0.0722, 0, 0,
  0, 0, 0, 1, 0];

var gFilteredTabs = new Set();

function updateIcon(tabId) {
  let toggled = gFilteredTabs.has(tabId);
  browser.browserAction.setIcon({
    path: toggled ? {
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
    title: toggled ? 'Unfilter it!' : 'Filter it!',
    tabId
  });
}

/*
 * Add or remove the bookmark on the current page.
 */
async function toggleFilter() {
  let [activeTab] = await browser.tabs.query({active: true, currentWindow: true});
  if (gFilteredTabs.has(activeTab.id)) {
    await browser.tabs.unsetColorFilter(activeTab.id);
    gFilteredTabs.delete(activeTab.id);
  } else {
    await browser.tabs.setColorFilter(activeTab.id, YELLOW_ON_BLACK);
    gFilteredTabs.add(activeTab.id);
  }
  updateIcon(activeTab.id);
}

browser.browserAction.onClicked.addListener(toggleFilter);
