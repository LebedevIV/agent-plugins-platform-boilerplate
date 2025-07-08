import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@extension/ui';
import { TabType } from '../hooks/useTabs';
import { Plugin } from '../hooks/usePlugins';
import { PluginDetails } from './PluginDetails';
import { useTranslations } from '../hooks/useTranslations';

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
  onUpdatePluginSetting
}) => {
  const { t } = useTranslations(locale);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(300);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Handle resize events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (layoutRef.current && (isDraggingLeft || isDraggingRight)) {
        const rect = layoutRef.current.getBoundingClientRect();
        const totalWidth = rect.width;
        
        if (isDraggingLeft) {
          const newLeftWidth = Math.max(150, Math.min(e.clientX - rect.left, totalWidth - rightWidth - 300));
          setLeftWidth(newLeftWidth);
        }
        
        if (isDraggingRight) {
          const newRightWidth = Math.max(200, Math.min(totalWidth - leftWidth - 300, totalWidth - e.clientX + rect.left));
          setRightWidth(newRightWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight, leftWidth, rightWidth]);

  return (
    <div 
      className="ide-layout" 
      ref={layoutRef}
      style={{
        gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`
      }}
    >
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
            onClick={() => onTabChange('plugins')}
          >
            {t('options.tabs.plugins')}
          </button>
          <button 
            className={cn('tab-button', activeTab === 'settings' && 'active')}
            onClick={() => onTabChange('settings')}
          >
            {t('options.tabs.settings')}
          </button>
        </nav>
      </aside>

      {/* Left resize handle */}
      <div 
        className="resize-handle left"
        onMouseDown={() => setIsDraggingLeft(true)}
      />

      <main className="ide-main-content">
        {children}
      </main>

      {/* Right resize handle */}
      <div 
        className="resize-handle right"
        onMouseDown={() => setIsDraggingRight(true)}
      />

      <aside className="ide-sidebar-right">
        <PluginDetails selectedPlugin={selectedPlugin} locale={locale} onUpdateSetting={onUpdatePluginSetting} />
      </aside>
    </div>
  );
}; 