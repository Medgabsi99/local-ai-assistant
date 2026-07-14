import { useOnlineStatus } from '../hooks/useOnlineStatus';
import InstallPrompt from './InstallPrompt';

export default function Layout({ children }) {
  const { isOnline, showOfflineBanner } = useOnlineStatus();

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {showOfflineBanner && (
        <div className={`px-3 py-1 text-center text-xs font-medium flex-shrink-0 transition-colors ${
          isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
        }`}>
          {isOnline ? '✅ Back online' : '📡 You are offline'}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">{children}</div>
      <InstallPrompt />
    </div>
  );
}