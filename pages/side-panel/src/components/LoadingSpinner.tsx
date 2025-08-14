import type React from 'react';

const LoadingSpinner: React.FC = () => (
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
    <div
      style={{
        width: 60,
        height: 60,
        border: '6px solid #ccc',
        borderTop: '6px solid aqua',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingSpinner;
