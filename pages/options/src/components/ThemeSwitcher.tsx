import React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, setTheme }) => {
  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️'; // Sun icon
      case 'dark':
        return '🌙'; // Moon icon
      case 'system':
        return '💻'; // System icon
      default:
        return null;
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
    <button onClick={cycleTheme} style={buttonStyle}>
      {getIcon()}
    </button>
  );
};

export default ThemeSwitcher;