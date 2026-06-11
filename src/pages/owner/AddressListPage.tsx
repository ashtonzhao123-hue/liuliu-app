import { useEffect, useState } from 'react';
import { Button, Card, Dialog, Space, Tag } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { deleteAddress, listAddresses, setDefaultAddress } from '../../api/owner';
import { FriendlyEmpty } from '../../components/FriendlyEmpty';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { AddressReviewStatus, type UserAddress } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatDistance } from '../../utils/format';
import { notify } from '../../utils/notify';
import { getAddressReviewText } from '../../utils/status';

export function AddressListPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!currentUser) return;
    try {
      setLoading(true);
      setAddresses(await listAddresses(currentUser.id));
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '遛狗地址没加载出来，稍后再试试'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [currentUser]);

  async function handleDefault(id: string) {
    if (!currentUser) return;
    const address = addresses.find((item) => item.id === id);
    Dialog.confirm({
      title: '设为默认地址？',
      content: `之后下单会优先使用「${address?.fullAddress ?? '这个地址'}」哦`,
      confirmText: '设为默认',
      cancelText: '先不了',
      onConfirm: async () => {
        try {
          await setDefaultAddress(currentUser.id, id);
          notify('好，默认地址已更新', 'success');
          void refresh();
        } catch (error) {
          notify(getFriendlyErrorMessage(error, '默认地址没设置成功'), 'error');
        }
      }
    });
  }

  async function handleDelete(id: string) {
    if (!currentUser) return;
    Dialog.confirm({
      title: '确定要删除吗？',
      content: '删了就找不回来啦，下单前可能还要重新添加',
      confirmText: '删除',
      cancelText: '再想想',
      onConfirm: async () => {
        try {
          await deleteAddress(currentUser.id, id);
          notify('地址已删除', 'success');
          void refresh();
        } catch (error) {
          notify(getFriendlyErrorMessage(error, '删除没成功，我们再试一次'), 'error');
        }
      }
    });
  }

  return (
    <PageContainer title="遛狗地址" subtitle="管理交接地址和服务范围">
      <Button block color="primary" onClick={() => navigate('/owner/addresses/new')}>
        <AddOutline /> 新增地址
      </Button>
      <div className="section-stack">
        {loading ? (
          <div className="skeleton-list"><span /><span /></div>
        ) : addresses.length === 0 ? (
          <FriendlyEmpty title="还没有服务地址" description="添加一个吧，之后下单会省心很多" actionText="新增地址" onAction={() => navigate('/owner/addresses/new')} />
        ) : (
          addresses.map((address) => (
            <Card
              key={address.id}
              className={`summary-card ${address.reviewStatus === AddressReviewStatus.OutOfServiceArea ? 'danger-card' : ''}`}
              title={address.fullAddress}
            >
              <Space direction="vertical" block>
                <p>联系人：{address.contactName} | 手机号：{address.contactMobile}</p>
                <Space wrap>
                  {address.isDefault ? <Tag className="default-address-tag">★ 默认地址</Tag> : null}
                  <Tag color={address.reviewStatus === AddressReviewStatus.Valid ? 'success' : 'danger'}>
                    {getAddressReviewText(address.reviewStatus)}
                  </Tag>
                  <Tag>{formatDistance(address.distanceMeters)}</Tag>
                </Space>
                <Space wrap>
                  <Button size="small" fill="outline" onClick={() => navigate(`/owner/addresses/${address.id}/edit`)}>
                    编辑
                  </Button>
                  <Button size="small" fill="outline" disabled={Boolean(address.isDefault)} onClick={() => void handleDefault(address.id)}>
                    设默认
                  </Button>
                  <Button size="small" color="danger" fill="outline" onClick={() => void handleDelete(address.id)}>
                    删除
                  </Button>
                </Space>
              </Space>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
