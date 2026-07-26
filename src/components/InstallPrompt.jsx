import { usePWAInstall } from '../hooks/usePWAInstall';
import { t } from '../lib/i18n';

export default function InstallPrompt() {
  const { showPrompt, install, dismiss } = usePWAInstall();

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 flex items-center gap-4 max-w-md">
        <div className="text-2xl">📲</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{t('install_app')}</p>
          <p className="text-xs text-slate-400">{t('install_desc')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={dismiss} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            {t('later')}
          </button>
          <button onClick={install} className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium">
            {t('install')}
          </button>
        </div>
      </div>
    </div>
  );
}