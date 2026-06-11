import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Image, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getOrderBundle } from '../../api/owner';
import { MockMap } from '../../components/MockMap';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import type { Order, OrderCheckpoint, OrderMedia, OrderTrack } from '../../types';
import { formatDateTime } from '../../utils/format';
import { getOrderStatusText } from '../../utils/status';

export function LiveOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [order, setOrder] = useState<Order>();
  const [tracks, setTracks] = useState<OrderTrack[]>([]);
  const [media, setMedia] = useState<OrderMedia[]>([]);
  const [checkpoints, setCheckpoints] = useState<OrderCheckpoint[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!currentUser || !id) return;
    void getOrderBundle(currentUser.id, id).then((bundle) => {
      setOrder(bundle.order);
      setTracks(bundle.tracks);
      setMedia(bundle.media);
      setCheckpoints(bundle.checkpoints);
    });
  }, [currentUser, id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const servedMinutes = useMemo(() => {
    if (!order?.startTime) return 0;
    return Math.max(0, Math.floor((now - new Date(order.startTime).getTime()) / 60000));
  }, [now, order?.startTime]);
  const currentTrack = tracks[tracks.length - 1];

  if (!order) {
    return <PageContainer title="服务进行中">订单不存在</PageContainer>;
  }

  return (
    <PageContainer title="服务进行中" subtitle="轨迹和打卡实时留痕">
      {tracks.length > 0 ? (
        <MockMap lat={currentTrack?.lat} lng={currentTrack?.lng} tracks={tracks} />
      ) : (
        <div className="map-placeholder">服务开始后将显示实时轨迹</div>
      )}
      <Card className="summary-card" title="服务信息">
        <p>开始时间：{formatDateTime(order.startTime)}</p>
        <p>已服务时长：{servedMinutes}分钟</p>
        <p>当前状态：{getOrderStatusText(order.orderStatus)}</p>
      </Card>
      <Card className="summary-card" title="过程打卡">
        <div className="media-strip">
          {media.map((item, index) => (
            <div className="media-thumb" key={item.id}>
              <Image src={item.thumbnailUrl || undefined} fit="cover" />
              <span>{item.remark || `照片${index + 1}`}</span>
            </div>
          ))}
        </div>
        {checkpoints.map((checkpoint) => (
          <p key={checkpoint.id} className="muted-text">{formatDateTime(checkpoint.createdAt)} · {checkpoint.note}</p>
        ))}
      </Card>
      <p className="notice-text">服务轨迹已记录，如发现异常可及时反馈。</p>
      <Space direction="vertical" block>
        <Button block fill="outline" onClick={() => { Toast.show('已为你呼叫服务者'); }}>
          联系服务者
        </Button>
        <Button block fill="outline" onClick={() => { Toast.show('已接入平台客服'); }}>
          联系客服
        </Button>
        <Button block color="warning" onClick={() => navigate(`/owner/orders/${order.id}/complaint`)}>
          异常反馈
        </Button>
      </Space>
    </PageContainer>
  );
}
