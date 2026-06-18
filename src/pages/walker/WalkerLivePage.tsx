import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Image, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getWalkerOrderBundle, startWalkerService, uploadWalkerMedia, uploadWalkerTrack, type WalkerOrderBundle } from '../../api/walker';
import { MockMap } from '../../components/MockMap';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { OrderStatus, type OrderMedia, type OrderTrack } from '../../types';
import { readImageAsDataUrl } from '../../utils/image';

export function WalkerLivePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [bundle, setBundle] = useState<WalkerOrderBundle>();
  const [tracks, setTracks] = useState<OrderTrack[]>([]);
  const [media, setMedia] = useState<OrderMedia[]>([]);
  const [now, setNow] = useState(Date.now());

  async function refresh() {
    if (!id || !currentUser) return;
    const next = await getWalkerOrderBundle(id, currentUser.id);
    setBundle(next);
    setTracks(next?.tracks ?? []);
    setMedia(next?.media ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [id, currentUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id || !currentUser || bundle?.order.orderStatus !== OrderStatus.InService) return;
    const timer = window.setInterval(() => {
      void uploadWalkerTrack(id, currentUser.id).then((track) => setTracks((items) => [...items, track]));
    }, 12000);
    return () => window.clearInterval(timer);
  }, [bundle?.order.orderStatus, currentUser, id]);

  async function handleStart() {
    if (!id || !currentUser) return;
    try {
      await startWalkerService(id, currentUser.id);
      Toast.show('服务已开始');
      void refresh();
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '开始失败');
    }
  }

  async function handleUpload(file?: File) {
    if (!id || !currentUser || !file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const next = await uploadWalkerMedia(id, currentUser.id, dataUrl, '过程打卡');
      setMedia((items) => [...items, next]);
      Toast.show('过程照片已上传');
    } catch (error) {
      Toast.show(error instanceof Error ? error.message : '上传失败');
    }
  }

  const servedMinutes = useMemo(() => {
    if (!bundle?.order.startTime) return 0;
    return Math.max(0, Math.floor((now - new Date(bundle.order.startTime).getTime()) / 60000));
  }, [bundle?.order.startTime, now]);

  if (!bundle) return <PageContainer title="遛狗中">订单不存在</PageContainer>;
  const minMedia = bundle.order.serviceDurationMinutes === 60 ? 2 : 1;

  return (
    <PageContainer title="遛狗中" subtitle="页面停留期间会模拟上传轨迹">
      <MockMap lat={tracks[tracks.length - 1]?.lat} lng={tracks[tracks.length - 1]?.lng} tracks={tracks} />
      <Card className="summary-card" title="计时区">
        <p>已服务时长：{servedMinutes}分钟</p>
        <p>定位上传状态：正常 · 已记录 {tracks.length} 个轨迹点</p>
      </Card>
      {bundle.order.orderStatus === OrderStatus.WalkerArrived ? (
        <Button block color="primary" onClick={handleStart}>
          开始服务
        </Button>
      ) : null}
      <Card className="summary-card" title={`已上传打卡 ${media.length}/${minMedia}`}>
        <div className="media-strip">
          {media.map((item) => (
            <div className="media-thumb" key={item.id}>
              <Image src={item.thumbnailUrl || undefined} fit="cover" />
              <span>{item.remark}</span>
            </div>
          ))}
        </div>
      </Card>
      <Space direction="vertical" block>
        <label className="adm-button adm-button-primary adm-button-block">
          <span className="adm-button-content">上传过程照片</span>
          <input hidden type="file" accept="image/*" onChange={(event) => void handleUpload(event.currentTarget.files?.[0])} />
        </label>
        <Button block fill="outline" onClick={() => { Toast.show('异常已记录，平台客服会介入'); }}>
          异常上报
        </Button>
        <Button
          block
          color="warning"
          onClick={() => {
            if (media.length < minMedia) {
              Toast.show(`请至少上传 ${minMedia} 张过程照片`);
              return;
            }
            navigate(`/walker/orders/${bundle.order.id}/finish`);
          }}
        >
          结束服务
        </Button>
      </Space>
    </PageContainer>
  );
}
