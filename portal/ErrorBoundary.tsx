import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Portal Error Boundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({
      error,
      errorInfo,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div 
          className="flex items-center justify-center min-h-screen p-4"
          style={{ 
            backgroundColor: '#0a0a0b',
            color: '#e5e5e7'
          }}
        >
          <div 
            className="max-w-2xl w-full p-8 border rounded-lg"
            style={{
              backgroundColor: '#141416',
              borderColor: '#27272a'
            }}
          >
            <h1 
              className="text-2xl font-bold mb-4"
              style={{ color: '#ef4444' }}
            >
              Something went wrong in the Portal
            </h1>
            <p 
              className="mb-4"
              style={{ color: '#9ca3af' }}
            >
              The portal encountered an unexpected error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary 
                  className="cursor-pointer text-sm font-medium mb-2"
                  style={{ color: '#e5e5e7' }}
                >
                  Error Details (Click to expand)
                </summary>
                <pre 
                  className="text-xs p-4 rounded overflow-auto"
                  style={{
                    backgroundColor: '#1e1e20',
                    color: '#e5e5e7',
                    maxHeight: '400px'
                  }}
                >
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo && '\n\nComponent Stack:'}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg transition-opacity"
              style={{
                backgroundColor: '#ff6b35',
                color: '#0a0a0b',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
