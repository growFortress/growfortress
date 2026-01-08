import { Component, type ComponentChildren } from 'preact';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div class={styles.container}>
          <div class={styles.content}>
            <span class={styles.icon}>⚠️</span>
            <h2 class={styles.title}>Something went wrong</h2>
            <p class={styles.message}>
              An unexpected error occurred. Please try again.
            </p>
            {this.state.error && (
              <details class={styles.details}>
                <summary>Error details</summary>
                <pre class={styles.errorText}>{this.state.error.message}</pre>
              </details>
            )}
            <div class={styles.actions}>
              <button class={styles.retryBtn} onClick={this.handleRetry}>
                Try Again
              </button>
              <button class={styles.reloadBtn} onClick={this.handleReload}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
