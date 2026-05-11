import { useOnlineStatus } from '../hooks/useOnlineStatus';
import InstallPrompt from './InstallPrompt';

export default function Layout({ children }) {
  const { isOnline, showOfflineBanner } = useOnlineStatus();

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Offline/Online Banner */}
      {showOfflineBanner && (
        <div
          className={`px-4 py-2 text-center text-sm font-medium transition-colors ${
            isOnline
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-600 text-white'
          }`}
        >
          {isOnline
            ? '✅ Back online! Syncing data...'
            : '📡 You are offline. Local AI still works!'}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">{children}</div>

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
