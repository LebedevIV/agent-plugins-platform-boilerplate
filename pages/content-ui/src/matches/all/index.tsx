import './index.css';
import initAppWithShadow from '@extension/shared/lib/utils/init-app-with-shadow';
import App from '@src/matches/all/App';

initAppWithShadow({
  id: 'CEB-extension-all',
  inlineCss: '',
  app: <App />
});
