import '@src/Options.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useEffect } from 'react';
import { APPOptions } from './components/APPOptions';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';

  useEffect(() => {
    // Log for debugging
    console.log('Options component initialized');
    
    // Check if we're in a Chrome extension context
    const isExtension = !!(window.chrome && chrome.runtime && chrome.runtime.id);
    console.log('Is extension context:', isExtension);
    
    if (isExtension) {
      // Log the extension ID
      console.log('Extension ID:', chrome.runtime.id);
    }
  }, []);

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  return (
    <div className="App" id="app-container">
      <APPOptions />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
