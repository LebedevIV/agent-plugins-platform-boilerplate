import type React from 'react';

const ErrorDisplay: React.FC<{ error?: Error; resetError?: () => void }> = ({ error, resetError }) => (
  <div style={{ color: 'red', padding: 24 }}>
    <h2>Произошла ошибка</h2>
    {error && <pre>{error.message}</pre>}
    {resetError && <button onClick={resetError}>Сбросить</button>}
  </div>
);

export default ErrorDisplay;
