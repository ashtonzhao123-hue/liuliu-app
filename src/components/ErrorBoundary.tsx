import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from 'antd-mobile';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React error', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-boundary" role="alert">
        <section className="error-boundary__panel">
          <h1>页面开了个小差</h1>
          <p>可能网络不太稳定，检查一下 WiFi 或流量，然后刷新试试。如果还是不行，稍后再来。</p>
          <Button block color="primary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </section>
      </main>
    );
  }
}
