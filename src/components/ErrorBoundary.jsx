import { Component } from 'react';
import { t } from '../lib/i18n';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
          <div className="text-center max-w-sm animate-scale-in">
            <div
              className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <AlertTriangle size={28} style={{ color: '#ef4444' }} />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('error_title')}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {this.state.error?.message || t('error_body')}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw size={14} /> {t('reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
