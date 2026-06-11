import { useEffect, useState } from 'react';
import { Card, Tabs, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { listWalkerOrders, type WalkerHistoryFilter, type WalkerOrderBundle } from '../../api/walker';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getOrderStatusText } from '../../utils/status';

const tabs: Array<{ key: WalkerHistoryFilter; title: string }> = [
  { key: 'all', title: '全部' },
  { key: 'active', title: '进行中' },
  { key: 'pendingConfirm', title: '待确认' },
  { key: 'completed', title: '已完成' },
  { key: 'cancelled', title: '已取消' }
];

export function WalkerHistoryPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [filter, setFilter] = useState<WalkerHistoryFilter>('all');
  const [orders, setOrders] = useState<WalkerOrderBundle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    void listWalkerOrders(currentUser.id, filter)
      .then(setOrders)
      .catch((error) => notify(getFriendlyErrorMessage(error, '服务记录没加载出来，稍后再看看'), 'error'))
      .finally(() => setLoading(false));
  }, [currentUser, filter]);

  return (
    <PageContainer title="服务记录" subtitle="查看历史订单和主人评价">
      <Tabs activeKey={filter} onChange={(key) => setFilter(key as WalkerHistoryFilter)}>
        {tabs.map((tab) => <Tabs.Tab key={tab.key} title={tab.title} />)}
      </Tabs>
      <div className="section-stack">
        {loading ? (
          <div className="skeleton-list"><span /><span /></div>
        ) : orders.length === 0 ? (
          <FriendlyEmpty title="这里还空空的" description="完成第一单后，记录会安静地躺在这里" icon="🍵" />
        ) : (
          orders.map((bundle) => (
            <Card key={bundle.order.id} className="summary-card" title={bundle.order.petNameSnapshot} onClick={() => navigate(`/walker/orders/${bundle.order.id}`)}>
              <p>{bundle.order.serviceDurationMinutes}分钟 · {formatDateTime(bundle.order.appointmentTime)}</p>
              <div className="card-row">
                <Tag color="primary">{getOrderStatusText(bundle.order.orderStatus)}</Tag>
                <strong>{formatMoney(bundle.order.walkerIncome)}</strong>
              </div>
              {bundle.review ? <p>主人评价：{bundle.review.rating}星 · {bundle.review.content || '还没有留下文字'}</p> : null}
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
