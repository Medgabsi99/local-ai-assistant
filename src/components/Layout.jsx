import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { t } from '../lib/i18n';
import { Wifi, WifiOff } from 'lucide-react';
import InstallPrompt from './InstallPrompt';

export default function Layout({ children }) {
  const { isOnline, showOfflineBanner } = useOnlineStatus();

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {showOfflineBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium flex-shrink-0 transition-all duration-300 ${
            isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}
        >
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? t('back_online') : t('you_are_offline')}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">{children}</div>
      <InstallPrompt />
    </div>
  );
}
