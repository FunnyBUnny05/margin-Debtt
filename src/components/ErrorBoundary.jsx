import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console in development
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally reload the page or reset app state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-background" style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '20px' 
        }}>
          <div className="glass-card" style={{ 
            textAlign: 'center', 
            padding: '48px', 
            maxWidth: '600px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: '600', 
              color: 'var(--text-primary)', 
              marginBottom: '16px' 
            }}>
              Something Went Wrong
            </div>
            <div style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '16px', 
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              An unexpected error occurred while rendering this component.
              {this.state.error && (
                <div style={{ 
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  color: 'var(--accent-coral)'
                }}>
                  {this.state.error.toString()}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="btn-primary"
              style={{
                padding: '12px 32px',
                fontSize: '16px',
                background: 'var(--gradient-coral)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Reload Application
            </button>
            <div style={{ 
              marginTop: '24px',
              fontSize: '13px',
              color: 'var(--text-muted)'
            }}>
              If this problem persists, please refresh the page or contact support.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
