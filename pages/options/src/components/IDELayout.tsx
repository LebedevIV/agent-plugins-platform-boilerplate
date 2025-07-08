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
  const leftWidth = 250; // Fixed left panel width
  const [rightWidth, setRightWidth] = useState(300);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Handle resize events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (layoutRef.current && isDraggingRight) {
        const rect = layoutRef.current.getBoundingClientRect();
        const totalWidth = rect.width;
        const mouseX = e.clientX - rect.left;

        // Calculate new widths based on mouse position
        const newRightWidth = Math.max(200, Math.min(400, totalWidth - mouseX - leftWidth));
        const newMiddleWidth = totalWidth - leftWidth - newRightWidth;

        // Ensure middle section has minimum width
        if (newMiddleWidth >= 300) {
          setRightWidth(newRightWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingRight, leftWidth]);

  return (
    <div
      className="ide-layout"
      ref={layoutRef}
      style={{
        gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
      }}>
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

      {/* Right resize handle */}
      <button
        className="resize-handle"
        onMouseDown={() => setIsDraggingRight(true)}
        aria-label="Resize panels"
        type="button"
      />

      <aside className="ide-sidebar-right">
        <PluginDetails selectedPlugin={selectedPlugin} locale={locale} onUpdateSetting={onUpdatePluginSetting} />
      </aside>
    </div>
  );
};
