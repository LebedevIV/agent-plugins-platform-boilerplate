import '@src/index.css';
import { createRoot } from 'react-dom/client';
import { TestReact19Pure } from '@extension/ui';

const init = () => {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(<TestReact19Pure />);
};

init();
