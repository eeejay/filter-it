
let globalMM = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);

function contentScript() {
  ChromeUtils.import("resource://gre/modules/MessageChannel.jsm");
  class FilterListener {
    async receiveMessage({target, messageName, recipient, data, name}) {
      switch (messageName) {
        case "Extension:SetColorFilter":
          target.content.document.docShell.setColorMatrix(data);
          break;
        case "Extension:GetColorFilter":
          return target.content.document.docShell.getColorMatrix();
      }
    }
  }
  let filterListener = new FilterListener();
  MessageChannel.addListener(this, "Extension:SetColorFilter", filterListener);
  MessageChannel.addListener(this, "Extension:GetColorFilter", filterListener);
}

globalMM.loadFrameScript(`data:,(${contentScript.toString()})()`, true);

ChromeUtils.defineModuleGetter(this, "PromiseUtils",
                               "resource://gre/modules/PromiseUtils.jsm");

// copied from ext-tabs.js
let tabListener = {
  tabReadyInitialized: false,
  tabReadyPromises: new WeakMap(),
  initializingTabs: new WeakSet(),

  initTabReady() {
    if (!this.tabReadyInitialized) {
      windowTracker.addListener("progress", this);

      this.tabReadyInitialized = true;
    }
  },

  onLocationChange(browser, webProgress, request, locationURI, flags) {
    if (webProgress.isTopLevel) {
      let {gBrowser} = browser.ownerGlobal;
      let nativeTab = gBrowser.getTabForBrowser(browser);

      // Now we are certain that the first page in the tab was loaded.
      this.initializingTabs.delete(nativeTab);

      // browser.innerWindowID is now set, resolve the promises if any.
      let deferred = this.tabReadyPromises.get(nativeTab);
      if (deferred) {
        deferred.resolve(nativeTab);
        this.tabReadyPromises.delete(nativeTab);
      }
    }
  },

  /**
   * Returns a promise that resolves when the tab is ready.
   * Tabs created via the `tabs.create` method are "ready" once the location
   * changes to the requested URL. Other tabs are assumed to be ready once their
   * inner window ID is known.
   *
   * @param {XULElement} nativeTab The <tab> element.
   * @returns {Promise} Resolves with the given tab once ready.
   */
  awaitTabReady(nativeTab) {
    let deferred = this.tabReadyPromises.get(nativeTab);
    if (!deferred) {
      deferred = PromiseUtils.defer();
      if (!this.initializingTabs.has(nativeTab) &&
          (nativeTab.linkedBrowser.innerWindowID ||
           nativeTab.linkedBrowser.currentURI.spec === "about:blank")) {
        deferred.resolve(nativeTab);
      } else {
        this.initTabReady();
        this.tabReadyPromises.set(nativeTab, deferred);
      }
    }
    return deferred.promise;
  },
};

this.filters = class extends ExtensionAPI {
  getAPI(context) {
    const { tabManager } = context.extension;

    // copied from ext-tabs.js
    async function promiseTabWhenReady(tabId) {
      let tab;
      if (tabId !== null) {
        tab = tabManager.get(tabId);
      } else {
        tab = tabManager.getWrapper(tabTracker.activeTab);
      }

      await tabListener.awaitTabReady(tab.nativeTab);

      return tab;
    }

    function isColorFilterSupported() {
      try {
        return Services.prefs.getBoolPref(COLORFILTER_FORCE_PREFNAME);
      } catch (e) {
        return Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo).WebRenderEnabled;
      }
    }


    return {
      filters: {
        async setColorFilter(tabId, matrix) {
          if (!isColorFilterSupported()) {
            throw new Error("Color filters are unsupported in this browser's configuration");
          }

          let tab = await promiseTabWhenReady(tabId);
          return tab.sendMessage(context, "Extension:SetColorFilter", matrix || [], {});
        },

        async getColorFilter(tabId) {
          if (!isColorFilterSupported()) {
            throw new Error("Color filters are unsupported in this browser's configuration");
          }

          let tab = await promiseTabWhenReady(tabId);
          return tab.sendMessage(context, "Extension:GetColorFilter", {}, {});
        }
      }
    }

  }
}
