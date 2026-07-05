import { useEffect, useState } from 'react';
import { Button, Card, Space, Switch, Tag } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import {
  getWalkerDistanceText,
  getWalkerOnlineStatus,
  getWalkerStats,
  listAvailableOrders,
  markWalkerActive,
  setWalkerOnlineStatus,
  type WalkerOrderBundle,
  type WalkerStats
} from '../../api/walker';
import { getWalkerCredentialStatus } from '../../api/walkerCredential';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';

const EMPTY_STATS: WalkerStats = {
  todayIncome: 0,
  weekIncome: 0,
  totalIncome: 0,
  serviceCount: 0,
  averageRating: 5,
  petCount: 0,
  totalDistance: 0
};

const CREDENTIAL_HINT_PREFIX = 'liuliu_walker_credential_hint_seen_';

export function WalkerHomePage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [online, setOnline] = useState(true);
  const [orders, setOrders] = useState<WalkerOrderBundle[]>([]);
  const [stats, setStats] = useState<WalkerStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [showCredentialHint, setShowCredentialHint] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setOnline(getWalkerOnlineStatus(currentUser.id));
    markWalkerActive(currentUser.id);
    void Promise.all([listAvailableOrders(), getWalkerStats(currentUser.id), getWalkerCredentialStatus(currentUser.id)])
      .then(([availableOrders, nextStats, credentialStatus]) => {
        setOrders(availableOrders);
        setStats(nextStats);
        const hintKey = `${CREDENTIAL_HINT_PREFIX}${currentUser.id}`;
        if (!credentialStatus.hasStudentCard && localStorage.getItem(hintKey) !== '1') {
          setShowCredentialHint(true);
          localStorage.setItem(hintKey, '1');
        }
      })
      .catch((error) => notify(getFriendlyErrorMessage(error, '接单大厅暂时没加载出来，稍后再看看？'), 'error'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markWalkerActive(currentUser.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentUser]);

  function handleOnlineChange(checked: boolean) {
    if (!currentUser) return;
    setOnline(checked);
    setWalkerOnlineStatus(currentUser.id, checked);
    notify(checked ? '你上线了，附近订单会来找你' : '已切到休息中，慢慢歇口气', 'success');
  }

  async function shareWeeklyReport() {
    const text = `这周在遛遛完成 ${stats.serviceCount} 单，陪伴 ${stats.petCount} 只毛孩子，走了 ${stats.totalDistance} 公里。`;
    if (navigator.share) {
      await navigator.share({ title: '我的遛遛周报', text, url: window.location.origin }).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(text);
    notify('周报文案已复制', 'success');
  }

  return (
    <PageContainer title="今天有空吗？" subtitle="接一单，把风也遛一遛">
      {showCredentialHint ? (
        <div className="credential-reminder" role="status">
          <div>
            <strong>学生证还没留档</strong>
            <p>现在也能逛大厅，接单前记得补一下。</p>
          </div>
          <Button size="small" color="primary" onClick={() => navigate('/walker/credential')}>
            去上传
          </Button>
          <button className="credential-reminder__close" type="button" aria-label="关闭提醒" onClick={() => setShowCredentialHint(false)}>
            x
          </button>
        </div>
      ) : null}
      <Card className="summary-card walker-achievement-card" title="遛遛战绩">
        <div className="walker-achievement-grid">
          <AchievementMetric label="累计遛狗" value={stats.serviceCount} suffix="单" />
          <AchievementMetric label="陪伴毛孩子" value={stats.petCount} suffix="只" />
          <AchievementMetric label="遛了" value={stats.totalDistance} suffix="km" decimals={1} />
        </div>
        <div className="badge-row">
          <span className={`walker-badge ${stats.serviceCount >= 7 ? '' : 'walker-badge--locked'}`}>七日稳稳</span>
          <span className={`walker-badge ${stats.serviceCount >= 30 ? '' : 'walker-badge--locked'}`}>校园熟路</span>
          <span className={`walker-badge ${stats.averageRating >= 4.8 ? '' : 'walker-badge--locked'}`}>五星口碑</span>
        </div>
        <Button fill="outline" size="small" onClick={() => void shareWeeklyReport()}>
          生成周报
        </Button>
      </Card>

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

function AchievementMetric({ label, value, suffix, decimals = 0 }: { label: string; value: number; suffix: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 700);
      setDisplayValue(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="walker-achievement-metric">
      <strong>{displayValue.toFixed(decimals)}</strong>
      <span>{suffix}</span>
      <small>{label}</small>
    </div>
  );
}
