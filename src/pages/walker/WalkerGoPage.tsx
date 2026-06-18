import { useEffect, useState } from 'react';
import { Button, Card, Space, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { getWalkerOrderBundle, type WalkerOrderBundle } from '../../api/walker';
import { MockMap } from '../../components/MockMap';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateTime } from '../../utils/format';
import { OrderStatus } from '../../types';

export function WalkerGoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [bundle, setBundle] = useState<WalkerOrderBundle>();

  useEffect(() => {
    if (!id || !currentUser) return;
    void getWalkerOrderBundle(id, currentUser.id).then(setBundle);
  }, [id, currentUser]);

  if (!bundle) return <PageContainer title="前往交接点">订单不存在</PageContainer>;

  return (
    <PageContainer title="前往交接点" subtitle="按约定地点完成交接">
      <MockMap lat={bundle.address?.lat} lng={bundle.address?.lng} />
      <Card className="summary-card" title="信息卡片">
        <p>主人地址：{bundle.order.addressSnapshot}</p>
        <p>联系人：{bundle.address?.contactName} · {bundle.address?.contactMobile}</p>
        <p>预约时间：{formatDateTime(bundle.order.appointmentTime)}</p>
        <p>宠物说明：{bundle.order.breedSnapshot} · {bundle.order.specialRequirements || '无特殊要求'}</p>
      </Card>
      <Space direction="vertical" block>
        <Button block fill="outline" onClick={() => { Toast.show('已打开模拟导航'); }}>
          导航前往
        </Button>
        {bundle.order.orderStatus === OrderStatus.Accepted ? (
          <Button block color="primary" onClick={() => navigate(`/walker/orders/${bundle.order.id}/arrive`)}>
            我已到达
          </Button>
        ) : null}
        {bundle.order.orderStatus === OrderStatus.WalkerArrived ? (
          <Button block color="primary" onClick={() => navigate(`/walker/orders/${bundle.order.id}/live`)}>
            开始服务
          </Button>
        ) : null}
        {bundle.order.orderStatus === OrderStatus.InService ? (
          <Button block color="primary" onClick={() => navigate(`/walker/orders/${bundle.order.id}/live`)}>
            继续服务
          </Button>
        ) : null}
      </Space>
    </PageContainer>
  );
}
