import React from 'react';
import { PageErrorState } from './StateViews';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

// Keeps one failed view from blanking the whole app.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled view error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <PageErrorState
        title="Something went wrong"
        description="Your data is safe. Please try again."
        onRetry={() => this.setState({ hasError: false })}
      />
    );
  }
}
