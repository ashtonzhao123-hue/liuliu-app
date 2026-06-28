import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'liuliu_pwa_install_dismiss_count';
const MAX_DISMISS_COUNT = 3;

function getDismissCount(): number {
  return Number(localStorage.getItem(STORAGE_KEY) || '0');
}

function incrementDismissCount(): void {
  localStorage.setItem(STORAGE_KEY, String(getDismissCount() + 1));
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissCount, setDismissCount] = useState(() => getDismissCount());

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const iosSafari = /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);
    setIsIOS(iosSafari);

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const canShow = useMemo(
    () => !isInstalled && (deferredPrompt !== null || isIOS) && dismissCount < MAX_DISMISS_COUNT,
    [deferredPrompt, dismissCount, isIOS, isInstalled]
  );

  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      incrementDismissCount();
      setDismissCount(getDismissCount());
      return false;
    } catch {
      return false;
    }
  }

  function dismiss(): void {
    incrementDismissCount();
    setDismissCount(getDismissCount());
  }

  return { canShow, isInstalled, isIOS, promptInstall, dismiss };
}
