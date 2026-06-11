import { useEffect, useState } from 'react';
import { Button, Form, Input, Switch, TextArea } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { SERVICE_CENTER, getAddress, saveAddress, type AddressInput } from '../../api/owner';
import { MockMap } from '../../components/MockMap';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

const defaultForm: AddressInput = {
  communityName: '幸福小区',
  buildingNo: '',
  roomNo: '',
  contactName: '',
  contactMobile: '',
  lat: SERVICE_CENTER.lat,
  lng: SERVICE_CENTER.lng,
  addressNote: '',
  isDefault: 1
};

const mobilePattern = /^1[3-9]\d{9}$/;

export function AddressFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [form, setForm] = useState<AddressInput>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser || !id) return;
    void getAddress(currentUser.id, id).then((address) => {
      if (address) {
        setForm({
          communityName: address.communityName,
          buildingNo: address.buildingNo,
          roomNo: address.roomNo,
          contactName: address.contactName,
          contactMobile: address.contactMobile,
          lat: address.lat,
          lng: address.lng,
          addressNote: address.addressNote,
          isDefault: address.isDefault
        });
      }
    });
  }, [currentUser, id]);

  async function handleSubmit() {
    if (!currentUser) return;
    if (!form.communityName || !form.buildingNo || !form.roomNo || !form.contactName || !form.contactMobile) {
      notify('地址信息还差一点，补完整再保存吧');
      return;
    }
    if (!mobilePattern.test(form.contactMobile.trim())) {
      notify('联系电话好像不太对，再检查一下？', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await saveAddress(currentUser.id, form, id);
      notify('遛狗地址保存好啦', 'success');
      navigate('/owner/addresses', { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '地址信息不符合平台要求，请检查后再提交'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer title={id ? '编辑地址' : '新增地址'} subtitle="地图可点选试点内外位置">
      <Form layout="vertical" className="owner-form">
        <Form.Item label="小区名称">
          <Input value={form.communityName} onChange={(communityName) => setForm({ ...form, communityName })} />
        </Form.Item>
        <Form.Item label="楼栋">
          <Input value={form.buildingNo} placeholder="例如：3栋2单元" onChange={(buildingNo) => setForm({ ...form, buildingNo })} />
        </Form.Item>
        <Form.Item label="门牌号">
          <Input value={form.roomNo} placeholder="例如：502" onChange={(roomNo) => setForm({ ...form, roomNo })} />
        </Form.Item>
        <Form.Item label="联系人">
          <Input value={form.contactName} onChange={(contactName) => setForm({ ...form, contactName })} />
        </Form.Item>
        <Form.Item label="联系电话">
          <Input inputMode="tel" value={form.contactMobile} onChange={(contactMobile) => setForm({ ...form, contactMobile })} />
        </Form.Item>
      </Form>
      <MockMap
        lat={form.lat}
        lng={form.lng}
        selectable
        onSelect={(lat, lng) => setForm({ ...form, lat, lng })}
      />
      <Form layout="vertical" className="owner-form">
        <Form.Item label="备注">
          <TextArea rows={3} value={form.addressNote} onChange={(addressNote) => setForm({ ...form, addressNote })} />
        </Form.Item>
        <Form.Item label="设为默认地址">
          <Switch checked={Boolean(form.isDefault)} onChange={(checked) => setForm({ ...form, isDefault: checked ? 1 : 0 })} />
        </Form.Item>
      </Form>
      <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
        保存
      </Button>
    </PageContainer>
  );
}
