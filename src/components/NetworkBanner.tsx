import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="network-banner" role="alert">
      <span>网络跑丢了，检查一下 WiFi 或流量？</span>
      <button className="network-banner__retry" type="button" onClick={() => window.location.reload()}>
        重试
      </button>
    </div>
  );
}
