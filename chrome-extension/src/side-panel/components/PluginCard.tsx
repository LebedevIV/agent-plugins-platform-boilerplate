import React from 'react';
import './PluginCard.css';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  iconUrl?: string;
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
    // Fallback SVG placeholder
    event.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="%23e0e0e0"/><text x="24" y="24" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="%23999">${plugin.name.charAt(0).toUpperCase()}</text></svg>`;
  };

  const cardClassName = `plugin-card ${onClick ? 'clickable' : ''} ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''}`;

  return (
    <div className={cardClassName} onClick={onClick}>
      <img 
        className={`plugin-icon ${isRunning ? 'plugin-loader' : ''}`}
        src={plugin.iconUrl || require(`@platform-public/plugins/${plugin.id}/${plugin.icon || 'icon.svg'}`)}
        alt={`${plugin.name} icon`}
        onError={handleIconError}
      />
      <div className="plugin-content">
        <div className="plugin-header">
          <span className="plugin-name">{plugin.name}</span>
          <span className="plugin-version">v{plugin.version}</span>
        </div>
        <p className="plugin-description">{plugin.description}</p>
      </div>
    </div>
  );
}; 