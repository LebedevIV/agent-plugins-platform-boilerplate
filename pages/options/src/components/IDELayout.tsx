import { PluginDetails } from './PluginDetails';
import { useTranslations } from '../hooks/useTranslations';
import { cn } from '@extension/ui';
import { useState, useRef, useEffect } from 'react';
import type { Plugin } from '../hooks/usePlugins';
import type { TabType } from '../hooks/useTabs';
import type React from 'react';

interface IDELayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedPlugin: Plugin | null;
  onGithubClick: () => void;
  locale?: 'en' | 'ru';
  onUpdatePluginSetting?: (pluginId: string, setting: string, value: boolean) => Promise<void>;
}

export const IDELayout: React.FC<IDELayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  selectedPlugin,
  onGithubClick,
  locale = 'en',
  onUpdatePluginSetting,
}) => {
  const { t } = useTranslations(locale);
  const layoutRef = useRef<HTMLDivElement>(null);
  const leftWidth = 250; // фиксированная ширина
  const [rightRatio, setRightRatio] = useState(0.5); // доля правой колонки (0.5 = 50%)
  const [isDragging, setIsDragging] = useState(false);

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

  return (
    <div className="ide-layout" ref={layoutRef} style={{ gridTemplateColumns: getGridTemplate() }}>
      <aside className="ide-sidebar-left">
        <header>
          <button onClick={onGithubClick} className="logo-button">
            <h1>{t('options.title')}</h1>
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
