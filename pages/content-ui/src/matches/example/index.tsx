import './index.css';
import initAppWithShadow from '@extension/shared/lib/utils/init-app-with-shadow';
import App from '@src/matches/example/App';

initAppWithShadow({
  id: 'CEB-extension-example',
  inlineCss: '',
  app: <App />
});
