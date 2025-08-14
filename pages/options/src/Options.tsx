import '@src/Options.css';
import { SettingsTab } from './components/SettingsTab';
import LocalErrorBoundary from './components/LocalErrorBoundary';

// AI-First: Основная страница настроек, обёрнута в ErrorBoundary для защиты UX
const Options = function () {
  // TODO: Подключить реальные пропсы и стейт для SettingsTab
  return (
    <div className="App" id="app-container" style={{ padding: 32 }}>
      <h1>Options (React 19 ESM test)</h1>
      <LocalErrorBoundary>
        <SettingsTab
          aiKeys={[]}
          customKeys={[]}
          onSave={() => {}}
          onTest={() => {}}
          onAddCustomKey={() => {}}
          onRemoveCustomKey={() => {}}
          onUpdateKey={() => {}}
          onUpdateCustomKeyName={() => {}}
          getStatusText={() => ''}
          getStatusClass={() => ''}
          theme="light"
          setTheme={() => {}}
        />
      </LocalErrorBoundary>
    </div>
  );
};

export default Options;
