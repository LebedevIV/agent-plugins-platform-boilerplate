import { useState } from 'react';

export type TabType = 'plugins' | 'settings';

export const useTabs = (initialTab: TabType = 'plugins') => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
  };

  const isActiveTab = (tab: TabType) => {
    return activeTab === tab;
  };

  return {
    activeTab,
    switchTab,
    isActiveTab
  };
}; 