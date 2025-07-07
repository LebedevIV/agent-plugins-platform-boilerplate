import React, { useState, useCallback } from 'react';
import './JsonViewer.css';

interface JsonViewerProps {
  data: any;
  initialExpanded?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, initialExpanded = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(!initialExpanded);

  const toggleAll = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  return (
    <div className="json-viewer-container">
      <div className="json-viewer-controls">
        <input
          type="text"
          className="json-viewer-search"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
        />
        <button onClick={toggleAll}>
          {isCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
      </div>
      <div className="json-viewer-content">
        <JsonNode 
          data={data} 
          key={null} 
          level={0} 
          searchTerm={searchTerm}
          isCollapsed={isCollapsed}
        />
      </div>
    </div>
  );
};

interface JsonNodeProps {
  data: any;
  key: string | null;
  level: number;
  searchTerm: string;
  isCollapsed: boolean;
}

const JsonNode: React.FC<JsonNodeProps> = ({ data, key, level, searchTerm, isCollapsed }) => {
  const [isExpanded, setIsExpanded] = useState(!isCollapsed);
  const isObject = typeof data === 'object' && data !== null;
  const isArray = Array.isArray(data);

  const isHighlighted = searchTerm && (
    (key && key.toLowerCase().includes(searchTerm)) ||
    (typeof data === 'string' && data.toLowerCase().includes(searchTerm))
  );

  const toggleNode = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Remove quotes from string values
      let textToCopy = text;
      if (textToCopy.startsWith('"') && textToCopy.endsWith('"')) {
        textToCopy = textToCopy.slice(1, -1);
      }
      
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }, []);

  const nodeStyle = {
    marginLeft: `${level * 20}px`,
    backgroundColor: isHighlighted ? '#2a4a2a' : undefined,
    borderRadius: isHighlighted ? '3px' : undefined,
    padding: isHighlighted ? '2px 4px' : undefined,
  };

  if (isObject) {
    return (
      <div className="json-viewer-node" style={nodeStyle}>
        <span className="json-viewer-toggle" onClick={toggleNode}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="json-viewer-key">
          {key ? `"${key}": ` : ''}
        </span>
        <span>{isArray ? '[' : '{'}</span>
        
        {isExpanded && (
          <div className="json-viewer-children">
            {Object.keys(data).map(childKey => (
              <JsonNode
                key={childKey}
                data={data[childKey]}
                key={childKey}
                level={level + 1}
                searchTerm={searchTerm}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
        
        <div style={{ marginLeft: `${level * 20}px` }}>
          {isArray ? ']' : '}'}
        </div>
      </div>
    );
  } else {
    return (
      <div className="json-viewer-node" style={nodeStyle}>
        <span className="json-viewer-key">
          {key ? `"${key}": ` : ''}
        </span>
        <span className={`json-viewer-value ${data === null ? 'null' : typeof data}`}>
          {JSON.stringify(data)}
        </span>
        <CopyButton 
          text={JSON.stringify(data)} 
          onCopy={copyToClipboard}
        />
      </div>
    );
  }
};

interface CopyButtonProps {
  text: string;
  onCopy: (text: string) => Promise<boolean>;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, onCopy }) => {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  const handleCopy = useCallback(async () => {
    setCopyState('copying');
    const success = await onCopy(text);
    setCopyState(success ? 'success' : 'error');
    
    setTimeout(() => {
      setCopyState('idle');
    }, 1500);
  }, [text, onCopy]);

  const getButtonText = () => {
    switch (copyState) {
      case 'copying': return 'Copying...';
      case 'success': return 'Copied!';
      case 'error': return 'Error!';
      default: return 'Copy';
    }
  };

  const getButtonStyle = () => {
    switch (copyState) {
      case 'success': return { backgroundColor: '#2a4a2a' };
      case 'error': return { backgroundColor: '#4a2a2a' };
      default: return {};
    }
  };

  return (
    <button 
      className="json-viewer-copy-button"
      onClick={handleCopy}
      style={getButtonStyle()}
      disabled={copyState === 'copying'}
    >
      {getButtonText()}
    </button>
  );
}; 