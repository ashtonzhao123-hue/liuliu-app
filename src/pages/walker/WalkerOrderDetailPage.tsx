import { useEffect, useState } from 'react';
import { Button, Card, Space, Tag } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptWalkerOrder, getWalkerOrderBundle, type WalkerOrderBundle } from '../../api/walker';
import { OrderStatusSteps } from '../../components/OrderStatusSteps';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { OrderStatus } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getOrderStatusText } from '../../utils/status';

export function WalkerOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [bundle, setBundle] = useState<WalkerOrderBundle>();
  const [accepting, setAccepting] = useState(false);

  async function refresh() {
    if (!id) return;
    setBundle(await getWalkerOrderBundle(id));
  }

  useEffect(() => {
    void refresh();
  }, [id]);

  async function handleAccept() {
    if (!id || !currentUser) return;
    try {
      setAccepting(true);
      await acceptWalkerOrder(id, currentUser.id, currentUser.nickname);
      notify('接单成功，等主人支付就能出发', 'success');
      void refresh();
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '这单暂时没接上，我们再试一次'), 'error');
    } finally {
      setAccepting(false);
    }
  }

  if (!bundle) {
    return <PageContainer title="订单详情">订单不存在</PageContainer>;
  }

  const { order, address } = bundle;
  const canGo = [OrderStatus.Accepted, OrderStatus.WalkerArrived, OrderStatus.InService].includes(order.orderStatus);

  return (
    <PageContainer title="订单详情" subtitle={getOrderStatusText(order.orderStatus)}>
      <Card className="summary-card" title="订单进度">
        <OrderStatusSteps status={order.orderStatus} />
      </Card>
      <Card className="summary-card" title="订单信息">
        <p>宠物：{order.breedSnapshot}/A级 · {order.petNameSnapshot}</p>
        <p>时长：{order.serviceDurationMinutes}分钟</p>
        <p>预约：{formatDateTime(order.appointmentTime)}</p>
        <p>地址：{order.addressSnapshot}</p>
        <p>备注：{order.specialRequirements || '无'}</p>
      </Card>
      <Card className="summary-card" title="主人信息">
        <p>{order.ownerNicknameSnapshot} · {address?.contactName ?? '联系人'} · {address?.contactMobile ?? '手机号待确认'}</p>
      </Card>
      <Card className="summary-card" title="收益信息">
        <div className="price-row"><span>订单总额</span><strong>{formatMoney(order.amountTotal)}</strong></div>
        <div className="price-row"><span>平台抽成</span><strong>{formatMoney(order.platformCommission)}</strong></div>
        <div className="price-row price-row--total"><span>预计收入</span><strong>{formatMoney(order.walkerIncome)}</strong></div>
      </Card>
      <Card className="summary-card" title="风险提示">
        <Space wrap>
          <Tag color="success">A级低风险</Tag>
          <Tag color="primary">全程留痕</Tag>
        </Space>
        <p>请确认你能接受该犬只情况，并按平台要求完成打卡和轨迹记录。</p>
      </Card>
      {order.orderStatus === OrderStatus.PendingAccept ? (
        <Space direction="vertical" block>
          <Button block color="primary" loading={accepting} disabled={accepting} onClick={handleAccept}>
            {accepting ? '正在接单...' : '接单'}
          </Button>
          <Button block fill="outline" onClick={() => navigate('/walker')}>
            暂不接
          </Button>
        </Space>
      ) : null}
      {order.orderStatus === OrderStatus.PendingPay ? (
        <Button block disabled>
          等待主人支付
        </Button>
      ) : null}
      {canGo ? (
        <Button block color="primary" onClick={() => navigate(`/walker/orders/${order.id}/go`)}>
          前往服务
        </Button>
      ) : null}
    </PageContainer>
  );
}
