import * as React from 'react';

export type TabType = 'plugins' | 'settings';

export const useTabs = (initialTab: TabType = 'plugins') => {
  const [activeTab, setActiveTab] = React.useState<TabType>(initialTab);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
  };

  const isActiveTab = (tab: TabType) => activeTab === tab;

  return {
    activeTab,
    switchTab,
    isActiveTab,
  };
};
