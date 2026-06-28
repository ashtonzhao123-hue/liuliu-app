import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();
  const [dismissed, setDismissed] = useState(false);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="update-prompt" role="alert">
      <span>遛遛有新版本了</span>
      <div className="update-prompt__actions">
        <button
          className="update-prompt__refresh"
          type="button"
          onClick={() => {
            setNeedRefresh(false);
            void updateServiceWorker(true);
          }}
        >
          刷新
        </button>
        <button
          className="update-prompt__close"
          type="button"
          aria-label="关闭"
          onClick={() => {
            setDismissed(true);
            setNeedRefresh(false);
          }}
        >
          x
        </button>
      </div>
    </div>
  );
}
