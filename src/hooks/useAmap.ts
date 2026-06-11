import { useEffect, useState } from 'react';

type AmapStatus = 'idle' | 'missing-key' | 'loading' | 'ready' | 'error';

interface AmapWindow extends Window {
  AMap?: unknown;
  _AMapSecurityConfig?: {
    securityJsCode: string;
  };
}

interface UseAmapState {
  status: AmapStatus;
  error?: string;
  AMap?: unknown;
}

const AMAP_SCRIPT_ID = 'amap-jsapi-v2';

export function useAmap(): UseAmapState {
  const [state, setState] = useState<UseAmapState>({ status: 'idle' });

  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY;
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
    const amapWindow = window as AmapWindow;

    if (!key) {
      setState({ status: 'missing-key', error: '未配置 VITE_AMAP_KEY' });
      return;
    }

    if (amapWindow.AMap) {
      setState({ status: 'ready', AMap: amapWindow.AMap });
      return;
    }

    if (securityCode) {
      amapWindow._AMapSecurityConfig = { securityJsCode: securityCode };
    }

    const existingScript = document.getElementById(AMAP_SCRIPT_ID) as HTMLScriptElement | null;
    setState({ status: 'loading' });

    const handleLoad = () => setState({ status: 'ready', AMap: amapWindow.AMap });
    const handleError = () => setState({ status: 'error', error: '高德地图脚本加载失败' });

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);
      return () => {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
      };
    }

    const script = document.createElement('script');
    script.id = AMAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  return state;
}
