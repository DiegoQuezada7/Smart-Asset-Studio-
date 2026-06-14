"use client";

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: '1rem', padding: '2rem', textAlign: 'center',
          background: 'var(--bg-app)', color: 'var(--text-main)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,77,77,0.15)', color: 'var(--danger)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 700,
          }}>!</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>Algo salió mal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, lineHeight: 1.5 }}>
            {this.state.error?.message || 'Ocurrió un error inesperado.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: 'var(--primary)', border: 'none', color: 'white',
              padding: '0.5rem 1.5rem', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
