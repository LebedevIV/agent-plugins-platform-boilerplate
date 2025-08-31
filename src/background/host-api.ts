/**
 * Host API for Agent-Plugins-Platform
 * Provides JavaScript tools that can be called from Python workflows
 * Simplified version for background context
 */

/**
 * Wraps chrome.runtime.sendMessage in Promise for convenience
 */
function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { source: "app-host-api", ...message },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response && response.error) {
          return reject(new Error(response.error));
        }
        resolve(response);
      }
    );
  });
}

/**
 * Finds a suitable target tab (not the extension page)
 */
async function findTargetTab(): Promise<chrome.tabs.Tab> {
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL('index.html');

  const targetTab = allTabsInWindow.find(tab =>
    tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
  );

  if (!targetTab) {
    throw new Error("Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).");
  }

  return targetTab;
}

export const hostApi = {
  async getElements(selectors: string[], context?: any) {
    const targetTab = await findTargetTab();

    return sendMessageToBackground({
      command: "getElements",
      data: {
        tabId: targetTab.id,
        selectors: selectors || ['body']
      }
    });
  },

  async getActivePageContent(selectors?: string[], context?: any) {
    const targetTab = await findTargetTab();

    return sendMessageToBackground({
      command: "getActivePageContent",
      data: {
        tabId: targetTab.id,
        selectors: selectors || ['body']
      }
    });
  },

  async host_fetch(url: string) {
    return sendMessageToBackground({
      command: "host_fetch",
      data: { url }
    });
  }
};