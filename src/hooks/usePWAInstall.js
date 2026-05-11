import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if installed during session
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

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
