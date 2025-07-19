import '@src/NewTab.css';
import '@src/NewTab.scss';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn } from '@extension/ui';
import React from 'react';

// Локальный ErrorDisplay
const ErrorDisplay = function ({ error, resetError }: { error?: Error; resetError?: () => void }) {
  return (
    <div style={{ color: 'red', padding: 24 }}>
      <h2>Произошла ошибка</h2>
      {error && <pre>{error.message}</pre>}
      {resetError && <button onClick={resetError}>Сбросить</button>}
    </div>
  );
};

// Локальный ToggleButton
const ToggleButton = function ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid #ccc',
        background: '#f0f0f0',
        cursor: 'pointer',
        marginTop: 16,
      }}>
      {children}
    </button>
  );
};

const FunctionalErrorBoundary = function ({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null);
  const resetError = React.useCallback(() => setError(null), []);

  if (error) {
    return <ErrorDisplay error={error} resetError={resetError} />;
  }

  try {
    return <>{children}</>;
  } catch (err) {
    setError(err as Error);
    return null;
  }
};

const NewTab = function () {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'new-tab/logo_horizontal.svg' : 'new-tab/logo_horizontal_dark.svg';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  console.log(t('hello', 'World'));
  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <button onClick={goGithubSite}>
          <img src={chrome.runtime.getURL(logo)} className="App-logo" alt="logo" />
        </button>
        <p>
          Edit <code>pages/new-tab/src/NewTab.tsx</code>
        </p>
        <h6>The color of this paragraph is defined using SASS.</h6>
        <ToggleButton onClick={exampleThemeStorage.toggle}>{t('toggleTheme')}</ToggleButton>
      </header>
    </div>
  );
};

export default function () {
  return (
    <FunctionalErrorBoundary>
      <NewTab />
    </FunctionalErrorBoundary>
  );
}
