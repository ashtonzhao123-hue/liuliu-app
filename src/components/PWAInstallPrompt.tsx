import { Popup } from 'antd-mobile';
import { usePWAInstall } from '../hooks/usePWAInstall';

type PWAInstallController = ReturnType<typeof usePWAInstall>;

interface PWAInstallPromptProps {
  visible: boolean;
  onClose: () => void;
  trigger?: 'order_success' | 'profile';
  install?: PWAInstallController;
}

export function PWAInstallPrompt({ visible, onClose, trigger = 'order_success', install }: PWAInstallPromptProps) {
  const ownInstall = usePWAInstall();
  const { isIOS, promptInstall, dismiss } = install ?? ownInstall;

  async function handleInstall() {
    if (isIOS) {
      onClose();
      return;
    }
    const installed = await promptInstall();
    if (installed) onClose();
  }

  function handleDismiss() {
    dismiss();
    onClose();
  }

  return (
    <Popup visible={visible} onMaskClick={handleDismiss} position="bottom" bodyClassName="pwa-install-sheet">
      <div className="pwa-install-content">
        <h3>把遛遛放桌面，下次一秒打开</h3>
        <p className="pwa-install-desc">
          {trigger === 'order_success' ? '订单发好了，下次直接从桌面找我们，不用再翻浏览器。' : '从桌面打开遛遛，比浏览器快一步。'}
        </p>
        {isIOS ? (
          <div className="pwa-install-ios-steps">
            <p>1. 点底部的分享按钮</p>
            <p>2. 往下滑，点「添加到主屏幕」</p>
            <p>3. 点右上角「添加」</p>
          </div>
        ) : (
          <button className="pwa-install-btn" type="button" onClick={() => void handleInstall()}>
            添加到桌面
          </button>
        )}
        <button className="pwa-install-dismiss" type="button" onClick={handleDismiss}>
          下次再说
        </button>
      </div>
    </Popup>
  );
}
