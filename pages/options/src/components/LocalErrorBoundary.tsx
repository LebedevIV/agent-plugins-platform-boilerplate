import React from 'react';
import ErrorDisplay from './ErrorDisplay';

const LocalErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = React.useState<Error | null>(null);
  const resetError = React.useCallback(() => setError(null), []);

  if (error) {
    return <ErrorDisplay error={error} resetError={resetError} />;
  }

  try {
    return <>{children}</>;
  } catch (err) {
    setError(err as Error);
    return null;
  }
};

export default LocalErrorBoundary;
