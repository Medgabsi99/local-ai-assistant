import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if installed during session
    const handleInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [isInstalled]);

  const install = async () => {
    if (!installPrompt) return;

    const result = await installPrompt.prompt();
    console.log(`Install prompt result: ${result.outcome}`);

    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
    setShowPrompt(false);
  };

  const dismiss = () => {
    setShowPrompt(false);
  };

  return { isInstalled, showPrompt, install, dismiss };
}
