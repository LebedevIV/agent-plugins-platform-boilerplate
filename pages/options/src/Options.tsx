import '@src/Options.css';
import '../../../packages/ui/lib/components/PluginCard.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect } from 'react';
import { APPOptions } from './components/APPOptions';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);

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

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')} id="app-container">
      <APPOptions isLight={isLight} />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
