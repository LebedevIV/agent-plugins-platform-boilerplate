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
    event.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><rect width='48' height='48' fill='%23e0e0e0'/><text x='24' y='24' text-anchor='middle' dy='.3em' font-family='Arial' font-size='12' fill='%23999'>${firstChar.toUpperCase()}</text></svg>`;
  };

  // Миниатюрная кнопка с иконкой и tooltip
  return (
    <button
      className={`plugin-mini-btn${isSelected ? ' selected' : ''}${isRunning ? ' running' : ''}`}
      onClick={onClick}
      title={plugin.name || plugin.manifest?.name || plugin.id}
      style={{ width: 48, height: 48, padding: 0, border: 'none', background: 'none', margin: 4, borderRadius: 8, cursor: 'pointer', outline: isSelected ? '2px solid #3182ce' : 'none' }}
    >
      <img 
        className={`plugin-icon${isRunning ? ' plugin-loader' : ''}`}
        src={plugin.iconUrl || `plugins/${plugin.id}/${plugin.icon || 'icon.svg'}`}
        alt={`${plugin.name} icon`}
        onError={handleIconError}
        style={{ width: 32, height: 32, borderRadius: 6 }}
      />
    </button>
  );
}; 