import * as React from 'react';
import type { ComponentType } from 'react';

export const withErrorBoundary = <T extends Record<string, unknown>>(
  Component: ComponentType<T>,
  FallbackComponent: ComponentType<{ error?: Error; resetError?: () => void }>,
) =>
  function WithErrorBoundary(props: T) {
    const [error, setError] = React.useState<Error | null>(null);
    const resetError = React.useCallback(() => setError(null), []);

    if (error) {
      return <FallbackComponent error={error} resetError={resetError} />;
    }

    try {
      return <Component {...props} />;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  };
