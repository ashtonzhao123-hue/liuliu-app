import { useEffect, useState } from 'react';
import { Button, Card, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { confirmOrderComplete, getOrderBundle } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { PWAInstallPrompt } from '../../components/PWAInstallPrompt';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAppStore } from '../../stores/useAppStore';
import type { Order, OrderMedia } from '../../types';
import { formatDateTime } from '../../utils/format';

export function ConfirmOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [order, setOrder] = useState<Order>();
  const [media, setMedia] = useState<OrderMedia[]>([]);
  const [installOpen, setInstallOpen] = useState(false);
  const install = usePWAInstall();

  useEffect(() => {
    if (!currentUser || !id) return;
    void getOrderBundle(currentUser.id, id).then((bundle) => {
      setOrder(bundle.order);
      setMedia(bundle.media);
    });
  }, [currentUser, id]);

  async function handleConfirm() {
    if (!currentUser || !order) return;
    await confirmOrderComplete(currentUser.id, order.id);
    Toast.show('服务已确认完成');
    if (install.canShow) {
      setInstallOpen(true);
      return;
    }
    navigate(`/owner/orders/${order.id}`, { replace: true });
  }

  function closeInstallPrompt() {
    if (!order) return;
    setInstallOpen(false);
    navigate(`/owner/orders/${order.id}`, { replace: true });
  }

  if (!order) return <PageContainer title="确认完成">订单不存在</PageContainer>;

  return (
    <PageContainer title="确认完成" subtitle="狗狗已归还，请确认服务是否完成">
      <Card className="summary-card" title="服务摘要">
        <p>宠物：{order.petNameSnapshot}</p>
        <p>服务者：{order.walkerNicknameSnapshot || '林同学'}</p>
        <p>开始：{formatDateTime(order.startTime)}</p>
        <p>结束：{formatDateTime(order.endTime)}</p>
        <p>服务时长：{order.serviceDurationMinutes}分钟</p>
      </Card>
      <Card className="summary-card" title="打卡照片">
        <div className="media-strip">
          {media.map((item) => (
            <div className="media-thumb" key={item.id}><span>{item.remark}</span></div>
          ))}
        </div>
      </Card>
      <Space direction="vertical" block>
        <Button block color="primary" onClick={handleConfirm}>
          确认完成
        </Button>
        <Button block fill="outline" onClick={() => navigate(`/owner/orders/${order.id}/complaint`)}>
          有问题，去投诉
        </Button>
      </Space>
      <PWAInstallPrompt visible={installOpen} onClose={closeInstallPrompt} trigger="order_success" install={install} />
    </PageContainer>
  );
}
