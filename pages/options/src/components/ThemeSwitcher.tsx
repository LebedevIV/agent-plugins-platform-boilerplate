import React from 'react';

interface ThemeSwitcherProps {
  isLight: boolean;
  onToggle: () => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ isLight, onToggle }) => {
  const getIcon = () => {
    return isLight ? '🌙' : '☀️'; // Moon for light theme (to switch to dark), Sun for dark theme (to switch to light)
  };

  const getTitle = () => {
    return isLight ? 'Переключить на темную тему' : 'Переключить на светлую тему';
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