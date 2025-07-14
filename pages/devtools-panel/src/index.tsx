import '@src/index.css';
import Panel from '@src/Panel';
import { createRoot } from 'react-dom/client';

// TypeScript declarations for global test objects
declare global {
  interface Window {
    testLoader?: {
      loadOzonTests(): Promise<{
        createOzonChat(): Promise<boolean>;
        createTestPluginChat(): Promise<boolean>;
        sendTestLogs(): Promise<void>;
        getAllData(): Promise<{
          chats: unknown[];
          drafts: unknown[];
          logs: Record<string, unknown>;
        }>;
        runOzonTests(): Promise<void>;
        getCurrentUrl(): Promise<string>;
      }>;
      runOzonTests(): Promise<boolean>;
      getLoadedScripts(): string[];
      clearLoadedScripts(): void;
    };
    ozonTestSystem?: {
      createOzonChat(): Promise<boolean>;
      createTestPluginChat(): Promise<boolean>;
      sendTestLogs(): Promise<void>;
      getAllData(): Promise<{
        chats: unknown[];
        drafts: unknown[];
        logs: Record<string, unknown>;
      }>;
      runOzonTests(): Promise<void>;
      getCurrentUrl(): Promise<string>;
    };
  }
}

const init = () => {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);

  root.render(<Panel />);
};

init();
