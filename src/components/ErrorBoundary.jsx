import { Component } from 'react';
import { t } from '../lib/i18n';

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
        <div className="h-full flex items-center justify-center p-8" className="bg-bg-primary">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold mb-2" className="text-text-primary">
              {t('error_title')}
            </h2>
            <p className="text-sm mb-4" className="text-text-muted">
              {this.state.error?.message || t('error_body')}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium"
            >
              {t('reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
