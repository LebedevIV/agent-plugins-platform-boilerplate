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

  async llm_call(modelAlias: string, options: any) {
    try {
      // Получаем информацию о плагине из контекста, если доступен
      const currentPlugin = (window as any).currentPlugin || 'ozon-analyzer';

      // Направляем через background script
      return sendMessageToBackground({
        command: "llm_call",
        data: {
          modelAlias,
          options,
          pluginId: currentPlugin
        }
      });
    } catch (error) {
      console.error('[HOST API] llm_call error:', error);
      throw error;
    }
  },

  async get_setting(settingName: string, defaultValue?: any, category?: string) {
    try {
      // Получаем информацию о плагине из контекста
      const currentPlugin = (window as any).currentPlugin || 'ozon-analyzer';

      // Направляем через background script
      return sendMessageToBackground({
        command: "get_setting",
        data: {
          settingName,
          defaultValue,
          category,
          pluginId: currentPlugin
        }
      });
    } catch (error) {
      console.error('[HOST API] get_setting error:', error);
      // Возвращаем значение по умолчанию в случае ошибки
      return defaultValue;
    }
  },

  sendMessageToChat(message: { content: string }) {
    if ((window as any).activeWorkflowLogger) {
      (window as any).activeWorkflowLogger.addMessage('PYTHON', message.content);
    } else {
      console.warn("[Python Message] Логгер не активен:", message.content);
    }
  }
};