import { useEffect, useState } from 'react';
import { Card, Tabs, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listOrders } from '../../api/owner';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import type { Order, OwnerOrderFilter } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getOrderStatusText } from '../../utils/status';

const tabs: Array<{ key: OwnerOrderFilter; title: string }> = [
  { key: 'all', title: '全部' },
  { key: 'pendingAccept', title: '待接单' },
  { key: 'pendingPay', title: '待支付' },
  { key: 'inProgress', title: '进行中' },
  { key: 'pendingConfirm', title: '待确认' },
  { key: 'completed', title: '已完成' },
  { key: 'cancelled', title: '已取消' }
];

export function OrderListPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [filter, setFilter] = useState<OwnerOrderFilter>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    void listOrders(currentUser.id, filter)
      .then(setOrders)
      .catch((error) => notify(getFriendlyErrorMessage(error, '订单没加载出来，稍后再看看'), 'error'))
      .finally(() => setLoading(false));
  }, [currentUser, filter]);

  return (
    <PageContainer title="我的订单" subtitle="查看服务进度和订单状态">
      <Tabs activeKey={filter} onChange={(key) => setFilter(key as OwnerOrderFilter)}>
        {tabs.map((tab) => (
          <Tabs.Tab title={tab.title} key={tab.key} />
        ))}
      </Tabs>
      <div className="section-stack">
        {loading ? (
          <div className="skeleton-list"><span /><span /></div>
        ) : orders.length === 0 ? (
          <FriendlyEmpty title="这里还空空的" description="发布第一笔遛狗订单后，它会出现在这里" actionText="去下单" onAction={() => navigate('/owner/orders/new')} />
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="summary-card" title={order.orderNo} onClick={() => navigate(`/owner/orders/${order.id}`)}>
              <p>宠物：{order.petNameSnapshot} | 时长：{order.serviceDurationMinutes}分钟</p>
              <p>预约：{formatDateTime(order.appointmentTime)}</p>
              <div className="card-row">
                <Tag color="primary">{getOrderStatusText(order.orderStatus)}</Tag>
                <strong>{formatMoney(order.amountTotal)}</strong>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
