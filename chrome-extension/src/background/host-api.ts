/**
 * Host API for Agent-Plugins-Platform
 * Provides JavaScript tools that can be called from Python workflows
 */

export interface WorkflowContext {
  steps: Record<string, any>;
  logger: any;
  page_html?: string;
}

export interface HostApiOptions {
  selectors?: string[];
  timeout?: number;
}

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
async function findTargetTab(context: WorkflowContext): Promise<chrome.tabs.Tab> {
  const logger = context.logger;
  logger.addMessage('HOST', 'Ищем целевую вкладку...');
  
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL('index.html');
  
  const targetTab = allTabsInWindow.find(tab => 
    tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https'))
  );
  
  if (!targetTab) {
    const errorMsg = "Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).";
    logger.addMessage('ERROR', errorMsg);
    throw new Error(errorMsg);
  }
  
  logger.addMessage('HOST', `Целевая вкладка найдена: ${targetTab.url?.substring(0, 70)}...`);
  return targetTab;
}

export const hostApi = {
  async getElements(options: HostApiOptions, context: WorkflowContext) {
    const targetTab = await findTargetTab(context);
    
    return sendMessageToBackground({
      command: "getElements",
      data: { 
        tabId: targetTab.id,
        selectors: options.selectors || ['body']
      }
    });
  },

  async getActivePageContent(selectors?: string[], context?: WorkflowContext) {
    const targetTab = await findTargetTab(context!);
    
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
  },

  sendMessageToChat(message: { content: string }) {
    if ((window as any).activeWorkflowLogger) {
      (window as any).activeWorkflowLogger.addMessage('PYTHON', message.content);
    } else {
      console.warn("[Python Message] Логгер не активен:", message.content);
    }
  }
}; 