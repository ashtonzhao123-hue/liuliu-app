import { useEffect, useState } from 'react';
import { Button, Card, Popup, Selector, Space, Tag, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelOrder, getOrderBundle, simulateAcceptOrder, simulateFinishService, simulatePayOrder, simulateStartService } from '../../api/owner';
import { OrderStatusSteps } from '../../components/OrderStatusSteps';
import { PageContainer } from '../../components/PageContainer';
import { ShareReportCard } from '../../components/ShareReportCard';
import { OrderDetailSkeleton } from '../../components/Skeleton';
import { useAppStore } from '../../stores/useAppStore';
import { OrderStatus, type Order, type Review } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDateTime, formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getOrderStatusText, isLiveOrder } from '../../utils/status';

const cancelReasons = [
  { label: '时间不合适', value: 'time' },
  { label: '找到别人遛了', value: 'other_walker' },
  { label: '狗狗不舒服', value: 'pet_unwell' },
  { label: '临时改主意', value: 'changed_mind' },
  { label: '其他', value: 'other' }
];

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [order, setOrder] = useState<Order>();
  const [review, setReview] = useState<Review>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>();

  async function refresh() {
    if (!currentUser || !id) return;
    try {
      setLoading(true);
      const bundle = await getOrderBundle(currentUser.id, id);
      setOrder(bundle.order);
      setReview(bundle.review);
    } finally {
      setLoading(false);
    }
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

  async function handleCancel() {
    if (!currentUser || !order || !cancelReason) return;
    if (cancelReason === 'other_walker') {
      notify('没关系，下次需要随时来', 'success');
      setCancelOpen(false);
      return;
    }
    await run(() => cancelOrder(currentUser.id, order.id), '下次想遛随时来，毛孩子等你呢');
    setCancelOpen(false);
  }

  function repeatOrder() {
    if (!order) return;
    navigate('/owner/orders/new', {
      state: {
        petId: order.petId,
        addressId: order.addressId,
        duration: order.serviceDurationMinutes,
        specialRequirements: order.specialRequirements
      }
    });
  }

  if (loading) {
    return (
      <PageContainer title="订单详情">
        <OrderDetailSkeleton />
      </PageContainer>
    );
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
        <p>时长：{order.serviceDurationMinutes} 分钟</p>
        <p>预约：{formatDateTime(order.appointmentTime)}</p>
        <p>地址：{order.addressSnapshot}</p>
        <p>要求：{order.specialRequirements || '无'}</p>
      </Card>

      {order.walkerUserId ? (
        <Card className="summary-card trust-card" title="服务者信息">
          <p>{order.walkerNicknameSnapshot || '遛狗员'} · 学生认证 · 西安文理学院</p>
          <Button size="small" fill="outline" onClick={() => { Toast.show('已为你呼叫服务者'); }}>
            聊两句
          </Button>
        </Card>
      ) : null}

      {order.orderStatus === OrderStatus.Completed ? <WalkReportCard order={order} /> : null}

      <Card className="summary-card" title="金额信息">
        <div className="price-row"><span>订单金额</span><strong>{formatMoney(order.amountTotal)}</strong></div>
        <div className="price-row"><span>平台服务费</span><strong>{formatMoney(order.platformCommission)}</strong></div>
        <div className="price-row price-row--total"><span>应付金额</span><strong>{formatMoney(order.amountTotal)}</strong></div>
      </Card>

      <OrderActions
        order={order}
        review={review}
        running={running}
        onCancel={() => setCancelOpen(true)}
        onRun={run}
        onRepeat={repeatOrder}
      />

      <Popup visible={cancelOpen} onMaskClick={() => setCancelOpen(false)} position="bottom" bodyClassName="retention-sheet">
        <h2>真的要取消吗？</h2>
        <p className="muted-text">先选个原因，我们看看能不能帮你省一步。</p>
        <Selector options={cancelReasons} value={cancelReason ? [cancelReason] : []} onChange={(value) => setCancelReason(value[0])} />
        {cancelReason === 'time' ? (
          <div className="retention-tip">
            <strong>要不要换个时间？</strong>
            <Button size="small" color="primary" onClick={() => navigate('/owner/orders/new', { state: { petId: order.petId, addressId: order.addressId, duration: order.serviceDurationMinutes } })}>
              修改时间
            </Button>
          </div>
        ) : null}
        <div className="retention-bar">
          <p>已经有附近遛狗员看到你的需求，确定取消吗？</p>
          <Space block>
            <Button block color="primary" onClick={() => setCancelOpen(false)}>再等等</Button>
            <Button block fill="none" loading={running} disabled={!cancelReason || running} onClick={() => void handleCancel()}>还是取消</Button>
          </Space>
        </div>
      </Popup>
    </PageContainer>
  );
}

function OrderActions({
  order,
  review,
  running,
  onCancel,
  onRun,
  onRepeat
}: {
  order: Order;
  review?: Review;
  running: boolean;
  onCancel: () => void;
  onRun: (action: () => Promise<Order>, message: string) => Promise<void>;
  onRepeat: () => void;
}) {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  if (!currentUser) return null;

  return (
    <Space direction="vertical" block>
      {order.orderStatus === OrderStatus.PendingAccept ? (
        <>
          <Button block color="danger" fill="outline" loading={running} disabled={running} onClick={onCancel}>
            取消订单
          </Button>
          <Button block color="primary" loading={running} disabled={running} onClick={() => void onRun(() => simulateAcceptOrder(currentUser.id, order.id), '服务者已接单')}>
            模拟接单
          </Button>
        </>
      ) : null}
      {order.orderStatus === OrderStatus.PendingPay ? (
        <Button block color="primary" loading={running} disabled={running} onClick={() => void onRun(() => simulatePayOrder(currentUser.id, order.id), '支付成功')}>
          立即支付
        </Button>
      ) : null}
      {order.orderStatus === OrderStatus.Accepted ? (
        <Button block color="primary" loading={running} disabled={running} onClick={() => void onRun(() => simulateStartService(currentUser.id, order.id), '服务已开始')}>
          模拟开始服务
        </Button>
      ) : null}
      {isLiveOrder(order.orderStatus) ? (
        <Button block color="primary" fill="outline" onClick={() => navigate(`/owner/orders/${order.id}/live`)}>
          查看服务进度
        </Button>
      ) : null}
      {order.orderStatus === OrderStatus.InService ? (
        <Button block color="primary" loading={running} disabled={running} onClick={() => void onRun(() => simulateFinishService(currentUser.id, order.id), '服务待确认')}>
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
        <>
          <Button block color="primary" disabled={Boolean(review)} onClick={() => navigate(`/owner/orders/${order.id}/review`)}>
            {review ? '已评价' : '去评价'}
          </Button>
          <Button block color="primary" fill="outline" onClick={onRepeat}>
            再约{order.walkerNicknameSnapshot || '这位遛狗员'}遛一次
          </Button>
          <p className="muted-text">同样的配方，换个时间就行。</p>
        </>
      ) : null}
    </Space>
  );
}

function WalkReportCard({ order }: { order: Order }) {
  const photos = order.reportPhotos ?? [];
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <Card className="summary-card walk-report-card" title="遛狗报告">
      {photos.length ? (
        <div className="walk-report-photos">
          {photos.map((photo, index) => (
            <img key={`${photo}-${index}`} src={photo} alt={`遛狗报告 ${index + 1}`} />
          ))}
        </div>
      ) : (
        <div className="walk-report-placeholder">这次没有留下照片，但服务已完成。</div>
      )}
      <div className="walk-report-metrics">
        <div><strong>{order.walkDistance?.toFixed(1) ?? '2.0'}km</strong><span>今天遛了</span></div>
        <div><strong>{order.walkDuration ?? order.serviceDurationMinutes}</strong><span>分钟</span></div>
      </div>
      <div className="walk-report-tags">
        <Tag color={order.hasPoop ? 'success' : 'default'}>{order.hasPoop ? '已便便' : '未记录便便'}</Tag>
        <Tag color={order.hasPee ? 'success' : 'default'}>{order.hasPee ? '已尿尿' : '未记录尿尿'}</Tag>
      </div>
      {order.walkerNote ? <p>{order.walkerNote}</p> : null}
      <Button fill="outline" size="small" onClick={() => setShareOpen(true)}>
        保存遛狗日记
      </Button>
      <ShareReportCard
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        petName={order.petNameSnapshot}
        distance={`${order.walkDistance?.toFixed(1) ?? '2.0'}km`}
        duration={`${order.walkDuration ?? order.serviceDurationMinutes}分钟`}
        photoUrl={photos[0]}
      />
    </Card>
  );
}
