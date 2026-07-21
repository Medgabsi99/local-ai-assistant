import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { t } from '../lib/i18n';
import InstallPrompt from './InstallPrompt';

export default function Layout({ children }) {
  const { isOnline, showOfflineBanner } = useOnlineStatus();

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`px-3 py-1 text-center text-xs font-medium flex-shrink-0 transition-colors ${
            isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}
        >
          <span aria-hidden="true">{isOnline ? '✅' : '📡'}</span> {isOnline ? t('back_online') : t('you_are_offline')}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">{children}</div>
      <InstallPrompt />
    </div>
  );
}
