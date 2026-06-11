import { useEffect, useState } from 'react';
import { Button, Card, Space, Switch, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import {
  getWalkerDistanceText,
  getWalkerOnlineStatus,
  getWalkerStats,
  listAvailableOrders,
  setWalkerOnlineStatus,
  type WalkerOrderBundle,
  type WalkerStats
} from '../../api/walker';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';

export function WalkerHomePage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [online, setOnline] = useState(true);
  const [orders, setOrders] = useState<WalkerOrderBundle[]>([]);
  const [stats, setStats] = useState<WalkerStats>({ todayIncome: 0, weekIncome: 0, totalIncome: 0, serviceCount: 0, averageRating: 5 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setOnline(getWalkerOnlineStatus(currentUser.id));
    void Promise.all([listAvailableOrders(), getWalkerStats(currentUser.id)])
      .then(([availableOrders, nextStats]) => {
        setOrders(availableOrders);
        setStats(nextStats);
      })
      .catch((error) => notify(getFriendlyErrorMessage(error, '接单大厅没加载出来，稍后再看看？'), 'error'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  function handleOnlineChange(checked: boolean) {
    if (!currentUser) return;
    setOnline(checked);
    setWalkerOnlineStatus(currentUser.id, checked);
    notify(checked ? '你上线了，附近订单会来找你' : '已切到休息中，慢慢歇口气', 'success');
  }

  return (
    <PageContainer title="今天有空吗？" subtitle="认证状态：靠得住">
      <Card className="summary-card walker-state-card" title="当前状态">
        <div className={`card-row walker-status ${online ? 'walker-status--online' : ''}`}>
          <Space>
            <Tag color={online ? 'success' : 'default'}>{online ? '在线' : '休息中'}</Tag>
            <span className="walker-income">今天赚了 <strong>{formatMoney(stats.todayIncome)}</strong></span>
          </Space>
          <Switch checked={online} onChange={handleOnlineChange} />
        </div>
      </Card>

      <div className="walker-filter">距离近 · 时间顺 · 收益清楚</div>

      <div className="section-stack">
        {loading ? (
          <div className="skeleton-list"><span /><span /><span /></div>
        ) : !online ? (
          <FriendlyEmpty title="你正在休息中" description="上线以后，就能看到附近订单。" />
        ) : orders.length === 0 ? (
          <FriendlyEmpty title="暂时没有新订单" description="先歇一会儿，等风把消息送来。" />
        ) : (
          orders.map((bundle) => (
            <Card key={bundle.order.id} className="summary-card order-card" title={`距离 ${getWalkerDistanceText(bundle)}`}>
              <Space direction="vertical" block>
                <p>
                  {bundle.order.breedSnapshot || '小型犬'} · {bundle.order.serviceDurationMinutes} 分钟 · {formatDateTime(bundle.order.appointmentTime)}
                </p>
                <p>叮嘱：{bundle.order.specialRequirements || '没有特别叮嘱'}</p>
                <div className="card-row">
                  <strong>到手 {formatMoney(bundle.order.walkerIncome)}</strong>
                  <Button size="small" color="primary" onClick={() => navigate(`/walker/orders/${bundle.order.id}`)}>
                    看详情
                  </Button>
                </div>
              </Space>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
