import { useState } from 'react';
import { Card, List } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/PageContainer';
import { PWAInstallPrompt } from '../../components/PWAInstallPrompt';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

export function OwnerProfilePage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const [installOpen, setInstallOpen] = useState(false);
  const install = usePWAInstall();

  async function handleLogout() {
    try {
      await logout();
      notify('已退出登录，等你回来', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '退出登录失败，请稍后再试'), 'error');
    }
  }

  return (
    <PageContainer title="我的" subtitle="资料与常用功能">
      <Card className="summary-card" title={currentUser?.nickname ?? '用户'}>
        <p>手机号：{currentUser?.mobile}</p>
      </Card>
      <List>
        <List.Item onClick={() => navigate('/owner/pets')}>我的宠物</List.Item>
        <List.Item description="新增、编辑、默认地址" onClick={() => navigate('/owner/addresses')}>
          地址管理
        </List.Item>
        <List.Item onClick={() => navigate('/owner/orders')}>我的订单</List.Item>
        <List.Item>消息中心</List.Item>
        <List.Item>投诉记录</List.Item>
        <List.Item>申请成为服务者</List.Item>
        {install.canShow ? <List.Item onClick={() => setInstallOpen(true)}>添加到桌面</List.Item> : null}
        <List.Item>设置</List.Item>
        <List.Item onClick={handleLogout}>
          退出登录
        </List.Item>
      </List>
      <PWAInstallPrompt visible={installOpen} onClose={() => setInstallOpen(false)} trigger="profile" install={install} />
    </PageContainer>
  );
}
