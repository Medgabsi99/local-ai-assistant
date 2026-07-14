import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-8" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {window.__LANG === 'fr' ? "Quelque chose s'est mal passé" : window.__LANG === 'ar' ? 'حدث خطأ ما' : 'Something went wrong'}
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {this.state.error?.message || (window.__LANG === 'fr' ? "Une erreur inattendue s'est produite" : window.__LANG === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred')}
            </p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium">
              {window.__LANG === 'fr' ? 'Recharger' : window.__LANG === 'ar' ? 'إعادة تحميل' : 'Reload'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}