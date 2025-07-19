import type React from 'react';

interface ToggleButtonProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  iconOn?: React.ReactNode;
  iconOff?: React.ReactNode;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ checked, onChange, disabled, label, iconOn, iconOff }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', gap: 8 }}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      style={{ display: 'none' }}
    />
    <span
      style={{
        width: 40,
        height: 22,
        borderRadius: 12,
        background: checked ? 'aqua' : '#ccc',
        position: 'relative',
        transition: 'background 0.2s',
        display: 'inline-block',
      }}>
      <span
        style={{
          position: 'absolute',
          left: checked ? 20 : 2,
          top: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          transition: 'left 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? iconOn : iconOff}
      </span>
    </span>
    {label && <span style={{ userSelect: 'none', fontSize: 15 }}>{label}</span>}
  </label>
);

export default ToggleButton;
