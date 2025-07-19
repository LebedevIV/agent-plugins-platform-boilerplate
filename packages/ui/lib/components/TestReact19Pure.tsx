import * as React from 'react';

export const TestReact19Pure = () => {
  const [count, setCount] = React.useState(0);
  return (
    <div style={{ padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>React 19 Pure Test</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};
