import { useEffect, useState } from 'react';
import { Button, Card, Space, Tag, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import {
  cancelOrder,
  getOrderBundle,
  simulateAcceptOrder,
  simulateFinishService,
  simulatePayOrder,
  simulateStartService
} from '../../api/owner';
import { OrderStatusSteps } from '../../components/OrderStatusSteps';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { OrderStatus, type Order, type Review } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getOrderStatusText, isLiveOrder } from '../../utils/status';

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [order, setOrder] = useState<Order>();
  const [review, setReview] = useState<Review>();
  const [running, setRunning] = useState(false);

  async function refresh() {
    if (!currentUser || !id) return;
    const bundle = await getOrderBundle(currentUser.id, id);
    setOrder(bundle.order);
    setReview(bundle.review);
  }

  useEffect(() => {
    void refresh();
  }, [currentUser, id]);

  async function run(action: () => Promise<Order>, message: string) {
    try {
      setRunning(true);
      const next = await action();
      setOrder(next);
      notify(message, 'success');
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '状态暂时没更新成功'), 'error');
    } finally {
      setRunning(false);
    }
  }

  if (!order || !currentUser) {
    return <PageContainer title="订单详情">订单不存在</PageContainer>;
  }

  return (
    <PageContainer title="订单详情" subtitle={order.orderNo}>
      <Card className="summary-card" title="当前状态">
        <Tag color="primary">{getOrderStatusText(order.orderStatus)}</Tag>
        <OrderStatusSteps status={order.orderStatus} />
      </Card>
      <Card className="summary-card" title="服务信息">
        <p>宠物：{order.petNameSnapshot}</p>
        <p>时长：{order.serviceDurationMinutes}分钟</p>
        <p>预约：{formatDateTime(order.appointmentTime)}</p>
        <p>地址：{order.addressSnapshot}</p>
        <p>要求：{order.specialRequirements || '无'}</p>
      </Card>
      {order.walkerUserId ? (
        <Card className="summary-card" title="服务者信息">
          <p>{order.walkerNicknameSnapshot} · 学生认证 · 深圳大学</p>
          <Button size="small" fill="outline" onClick={() => { Toast.show('已为你呼叫服务者'); }}>
            联系
          </Button>
        </Card>
      ) : null}
      <Card className="summary-card" title="金额信息">
        <div className="price-row"><span>订单金额</span><strong>{formatMoney(order.amountTotal)}</strong></div>
        <div className="price-row"><span>平台服务费</span><strong>{formatMoney(order.platformCommission)}</strong></div>
        <div className="price-row price-row--total"><span>应付金额</span><strong>{formatMoney(order.amountTotal)}</strong></div>
      </Card>
      <Space direction="vertical" block>
        {order.orderStatus === OrderStatus.PendingAccept ? (
          <>
            <Button block color="danger" fill="outline" loading={running} disabled={running} onClick={() => void run(() => cancelOrder(currentUser.id, order.id), '订单已取消')}>
              取消订单
            </Button>
            <Button block color="primary" loading={running} disabled={running} onClick={() => void run(() => simulateAcceptOrder(currentUser.id, order.id), '服务者已接单')}>
              模拟接单
            </Button>
          </>
        ) : null}
        {order.orderStatus === OrderStatus.PendingPay ? (
          <Button block color="primary" loading={running} disabled={running} onClick={() => void run(() => simulatePayOrder(currentUser.id, order.id), '支付成功')}>
            立即支付
          </Button>
        ) : null}
        {order.orderStatus === OrderStatus.Accepted ? (
          <Button block color="primary" loading={running} disabled={running} onClick={() => void run(() => simulateStartService(currentUser.id, order.id), '服务已开始')}>
            模拟开始服务
          </Button>
        ) : null}
        {isLiveOrder(order.orderStatus) ? (
          <Button block color="primary" fill="outline" onClick={() => navigate(`/owner/orders/${order.id}/live`)}>
            查看服务进度
          </Button>
        ) : null}
        {order.orderStatus === OrderStatus.InService ? (
          <Button block color="primary" loading={running} disabled={running} onClick={() => void run(() => simulateFinishService(currentUser.id, order.id), '服务待确认')}>
            模拟结束服务
          </Button>
        ) : null}
        {order.orderStatus === OrderStatus.PendingOwnerConfirm ? (
          <>
            <Button block color="primary" onClick={() => navigate(`/owner/orders/${order.id}/confirm`)}>
              确认完成
            </Button>
            <Button block fill="outline" onClick={() => navigate(`/owner/orders/${order.id}/complaint`)}>
              投诉
            </Button>
          </>
        ) : null}
        {order.orderStatus === OrderStatus.Completed ? (
          <Button block color="primary" disabled={Boolean(review)} onClick={() => navigate(`/owner/orders/${order.id}/review`)}>
            {review ? '已评价' : '去评价'}
          </Button>
        ) : null}
      </Space>
    </PageContainer>
  );
}
