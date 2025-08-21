import React from 'react';

interface ThemeSwitcherProps {
  theme: 'light' | 'dark' | 'system';
  isLight: boolean;
  onToggle: () => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, isLight, onToggle }) => {
  const getIcon = () => {
    switch (theme) {
      case 'light':
        return '🌙'; // Moon - to switch to dark
      case 'dark':
        return '💻'; // System icon - to switch to system
      case 'system':
        return '☀️'; // Sun - to switch to light
      default:
        return '🌙';
    }
  };

  const getTitle = () => {
    switch (theme) {
      case 'light':
        return 'Переключить на темную тему';
      case 'dark':
        return 'Переключить на системную тему';
      case 'system':
        return 'Переключить на светлую тему';
      default:
        return 'Переключить тему';
    }
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '20px',
    marginTop: '20px',
    alignSelf: 'center'
  };

  return (
    <button onClick={onToggle} style={buttonStyle} title={getTitle()}>
      {getIcon()}
    </button>
  );
};

export default ThemeSwitcher;