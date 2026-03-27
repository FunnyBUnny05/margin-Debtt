import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          padding: '40px 20px',
          borderLeft: '3px solid #EF4444',
          background: '#0B0F19',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ fontSize: '14px', color: '#EF4444', fontWeight: '700', letterSpacing: '2px', marginBottom: '12px' }}>
            RENDER ERROR
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '20px', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#1F2937',
              border: '1px solid #374151',
              color: '#F9FAFB',
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              letterSpacing: '1px',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
