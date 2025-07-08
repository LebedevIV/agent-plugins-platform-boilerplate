import React from 'react';
import './PluginCard.css';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  iconUrl?: string;
  manifest?: {
    name: string;
    version: string;
    description: string;
    icon?: string;
  };
}

interface PluginCardProps {
  plugin: Plugin;
  isSelected?: boolean;
  isRunning?: boolean;
  onClick?: () => void;
}

export const PluginCard: React.FC<PluginCardProps> = ({ 
  plugin, 
  isSelected = false, 
  isRunning = false, 
  onClick 
}) => {
  const handleIconError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    // Fallback SVG placeholder with safe string handling
    const pluginName = plugin.name || plugin.manifest?.name || plugin.id || 'P';
    const firstChar = pluginName.charAt(0) || 'P';
    event.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="%23e0e0e0"/><text x="24" y="24" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="%23999">${firstChar.toUpperCase()}</text></svg>`;
  };

  const cardClassName = `plugin-card ${onClick ? 'clickable' : ''} ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''}`;

  return (
    <div className={cardClassName} onClick={onClick}>
      <img 
        className={`plugin-icon ${isRunning ? 'plugin-loader' : ''}`}
        src={plugin.iconUrl || `plugins/${plugin.id}/${plugin.icon || 'icon.svg'}`}
        alt={`${plugin.name} icon`}
        onError={handleIconError}
      />
      <div className="plugin-content">
        <div className="plugin-header">
          <span className="plugin-name">{plugin.name || plugin.manifest?.name || plugin.id}</span>
          <span className="plugin-version">v{plugin.version || plugin.manifest?.version || '1.0.0'}</span>
        </div>
        <p className="plugin-description">{plugin.description || plugin.manifest?.description || 'Описание недоступно'}</p>
      </div>
    </div>
  );
}; 