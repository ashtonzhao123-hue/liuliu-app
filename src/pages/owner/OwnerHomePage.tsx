import { useEffect, useState } from 'react';
import { Button, Card, Space, Tag } from 'antd-mobile';
import { EnvironmentOutline, FileOutline, RightOutline, UserOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { getActiveWalkerCount, listAddresses, listOrders, listPets, type ActiveWalkerInfo } from '../../api/owner';
import { OwnerActionGrid } from '../../components/OwnerActionGrid';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import type { Order, Pet, UserAddress } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';
import { isLiveOrder } from '../../utils/status';

export function OwnerHomePage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const logout = useAppStore((state) => state.logout);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walkerActivity, setWalkerActivity] = useState<ActiveWalkerInfo>({ count: 0, level: 'none' });

  useEffect(() => {
    if (!currentUser) return;
    void Promise.all([listPets(currentUser.id), listAddresses(currentUser.id), listOrders(currentUser.id), getActiveWalkerCount()]).then(
      ([petList, addressList, orderList, activity]) => {
        setPets(petList);
        setAddresses(addressList);
        setOrders(orderList);
        setWalkerActivity(activity);
      }
    );
  }, [currentUser]);

  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const liveOrder = orders.find((order) => isLiveOrder(order.orderStatus));

  async function handleLogout() {
    try {
      await logout();
      notify('已经退出，等你回来', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '退出没成，稍后再试？'), 'error');
    }
  }

  return (
    <PageContainer
      title="嗨，今天遛了吗？"
      subtitle={`欢迎回来，${currentUser?.nickname ?? '朋友'}`}
      action={
        <button className="top-icon-button top-icon-button--logout" type="button" aria-label="退出登录" onClick={() => void handleLogout()}>
          <RightOutline />
        </button>
      }
    >
      <div className="owner-location">
        <EnvironmentOutline />
        <span>{defaultAddress?.communityName ?? '先选个服务小区'}</span>
      </div>

      <section className="owner-hero">
        <div>
          <span className="song-label">附近靠谱</span>
          <h2>找个会照顾的人，带它出去转一圈</h2>
          <p>小型犬优先，全程有轨迹和打卡，回来以后心里有数。</p>
        </div>
        <Button className="pulse-cta" color="primary" onClick={() => navigate('/owner/orders/new')}>
          找人遛
        </Button>
        <div className={`walker-activity-hint walker-activity-hint--${walkerActivity.level}`}>
          {walkerActivity.level !== 'none' ? <span className={`walker-activity-dot walker-activity-dot--${walkerActivity.level}`} aria-hidden="true" /> : null}
          <span>{getWalkerActivityMessage(walkerActivity)}</span>
        </div>
      </section>

      <OwnerActionGrid
        actions={[
          { label: '找人遛', description: '半小时 / 一小时', path: '/owner/orders/new', icon: <RightOutline /> },
          { label: '毛孩子', description: `${pets.length} 个档案`, path: '/owner/pets', icon: <UserOutline /> },
          { label: '常用地址', description: `${addresses.length} 个地点`, path: '/owner/addresses', icon: <EnvironmentOutline /> },
          { label: '遛过的路', description: `${orders.length} 笔订单`, path: '/owner/orders', icon: <FileOutline /> }
        ]}
      />

      {liveOrder ? (
        <Card className="summary-card" title="正在路上" onClick={() => navigate(`/owner/orders/${liveOrder.id}/live`)}>
          <Space direction="vertical" block>
            <Tag color="success">遛着呢</Tag>
            <p>{liveOrder.petNameSnapshot} · {liveOrder.serviceDurationMinutes} 分钟 · {liveOrder.addressSnapshot}</p>
            <Button color="primary" fill="outline" block>
              看看走到哪儿了
            </Button>
          </Space>
        </Card>
      ) : (
        <Card className="summary-card empty-order-card">
          <div className="song-empty-figure" aria-hidden="true">
            <img src="/song-walker-reference.jpg" alt="" />
          </div>
          <h2>毛孩子还没出过门呢</h2>
          <p>找个靠得住的人，带它遛一场。</p>
          <Button color="primary" onClick={() => navigate('/owner/orders/new')}>
            找人遛
          </Button>
        </Card>
      )}

      <Card className="summary-card" title="服务小记">
        <ul className="plain-list">
          <li>当前优先支持小型犬</li>
          <li>试点小区周边 3km 服务范围</li>
          <li>支持半小时和一小时代遛</li>
        </ul>
      </Card>
    </PageContainer>
  );
}

function getWalkerActivityMessage(activity: ActiveWalkerInfo): string {
  if (activity.level === 'plenty') return `附近${activity.count}位遛遛侠最近活跃，快有人来`;
  if (activity.level === 'few') return `附近${activity.count}位遛遛侠最近活跃，可能要等等`;
  return '附近暂无活跃遛遛侠，建议预约稍后时段';
}
