import { PluginDetails } from './PluginDetails';
import { useTranslations } from '../hooks/useTranslations';
import { cn } from '@extension/ui';
import { useState, useRef, useEffect } from 'react';
import type { Plugin } from '../hooks/usePlugins';
import type { TabType } from '../hooks/useTabs';
import type React from 'react';
import ToggleButton from './ToggleButton';

interface IDELayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedPlugin: Plugin | null;
  onGithubClick: () => void;
  locale?: 'en' | 'ru';
  onUpdatePluginSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
  isLight: boolean;
}

const STORAGE_KEY = 'options-right-ratio';

export const IDELayout: React.FC<IDELayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  selectedPlugin,
  onGithubClick,
  locale = 'en',
  onUpdatePluginSetting,
  isLight,
}) => {
  const { t } = useTranslations(locale);
  const layoutRef = useRef<HTMLDivElement>(null);
  const leftWidth = 250; // фиксированная ширина
  // Инициализация из localStorage
  const [rightRatio, setRightRatio] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const num = saved ? parseFloat(saved) : 0.5;
    return isNaN(num) ? 0.5 : Math.max(0.1, Math.min(num, 0.9));
  });
  const [isDragging, setIsDragging] = useState(false);

  // Сохраняем rightRatio в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, rightRatio.toString());
  }, [rightRatio]);

  // Обработка resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (layoutRef.current && isDragging) {
        const rect = layoutRef.current.getBoundingClientRect();
        const total = rect.width - leftWidth;
        let x = e.clientX - rect.left - leftWidth;
        // Ограничения
        const min = 300;
        const max = total - 300;
        x = Math.max(min, Math.min(x, max));
        setRightRatio((total - x) / total);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Вычисляем ширины
  const getGridTemplate = () => {
    const total = `calc(100vw - ${leftWidth}px)`;
    return `${leftWidth}px calc(${total} * ${1 - rightRatio}) 6px calc(${total} * ${rightRatio})`;
  };

  // Версия расширения
  const [extVersion, setExtVersion] = useState('__EXT_VERSION__');
  useEffect(() => {
    try {
      const manifest = chrome.runtime.getManifest();
      setExtVersion(manifest.version || '__EXT_VERSION__');
    } catch (error) {
      console.warn('Failed to get extension version:', error);
      setExtVersion('__EXT_VERSION__');
    }
  }, []);

  return (
    <div
      className={cn('ide-layout', isLight ? 'theme-light' : 'theme-dark')}
      ref={layoutRef}
      style={{ gridTemplateColumns: getGridTemplate() }}>
      <aside className="ide-sidebar-left">
        <header>
          <button onClick={onGithubClick} className="logo-button">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('options.title')}
              <span style={{ fontSize: '0.9em', color: '#a0aec0', marginLeft: 8 }}>v{extVersion}</span>
            </h1>
          </button>
          <p>{t('options.subtitle')}</p>
        </header>
        <nav className="tab-nav">
          <button
            className={cn('tab-button', activeTab === 'plugins' && 'active')}
            onClick={() => onTabChange('plugins')}>
            {t('options.tabs.plugins')}
          </button>
          <button
            className={cn('tab-button', activeTab === 'settings' && 'active')}
            onClick={() => onTabChange('settings')}>
            {t('options.tabs.settings')}
          </button>
        </nav>
        {/* Theme toggle button */}
        <div style={{ margin: '16px auto 0', display: 'flex', justifyContent: 'center' }}>
          {/* AI-First: Переключатель темы через ToggleButton с иконками */}
          <ToggleButton
            checked={isLight}
            onChange={() => import('@extension/storage').then(m => m.exampleThemeStorage.toggle())}
            iconOn={
              // Sun icon (светлая тема)
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            }
            iconOff={
              // Moon icon (тёмная тема)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            }
            label={isLight ? t('options.theme.light') : t('options.theme.dark')}
          />
        </div>
      </aside>
      <main className="ide-main-content">{children}</main>
      {/* Резайзер */}
      <button
        className="resize-handle"
        onMouseDown={() => setIsDragging(true)}
        aria-label="Resize panels"
        type="button"
        tabIndex={0}
      />
      <aside className="ide-sidebar-right">
        <PluginDetails selectedPlugin={selectedPlugin} locale={locale} onUpdateSetting={onUpdatePluginSetting} />
      </aside>
    </div>
  );
};
