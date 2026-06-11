import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dialog, Form, Selector, TextArea } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { AddressReviewStatus, PetReviewStatus, RiskLevel, type Pet, type UserAddress } from '../../types';
import { createOrder, getOrderPrice, listAddresses, listPets } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressId, setAddressId] = useState<string>();
  const [petId, setPetId] = useState<string>();
  const [duration, setDuration] = useState<30 | 60>(30);
  const [appointmentTime, setAppointmentTime] = useState(() => toLocalDateTime(new Date(Date.now() + 30 * 60 * 1000)));
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    void Promise.all([listPets(currentUser.id), listAddresses(currentUser.id)]).then(([petList, addressList]) => {
      setPets(petList);
      setAddresses(addressList);
      setAddressId(addressList.find((item) => item.isDefault && item.reviewStatus === AddressReviewStatus.Valid)?.id);
      setPetId(petList.find((item) => item.reviewStatus === PetReviewStatus.Approved && item.riskLevel === RiskLevel.A)?.id);
    });
  }, [currentUser]);

  const price = useMemo(() => getOrderPrice(duration), [duration]);
  const validPets = pets.filter((pet) => pet.reviewStatus === PetReviewStatus.Approved && pet.riskLevel === RiskLevel.A);
  const validAddresses = addresses.filter((address) => address.reviewStatus === AddressReviewStatus.Valid);
  const selectedPet = validPets.find((pet) => pet.id === petId);

  async function handleSubmit() {
    if (!currentUser || !addressId || !petId || !appointmentTime) {
      notify('地址、宝贝和时间都选好后，就能发布啦');
      return;
    }
    try {
      setSubmitting(true);
      const order = await createOrder(currentUser.id, {
        addressId,
        petId,
        serviceDurationMinutes: duration,
        appointmentTime: new Date(appointmentTime).toISOString(),
        specialRequirements
      });
      Dialog.alert({
        title: '订单发布好啦',
        content: '我们会把它放进接单大厅，等待附近服务者接单。',
        confirmText: '去看看',
        onConfirm: () => navigate(`/owner/orders/${order.id}`, { replace: true })
      });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '订单暂时没发出去，我们再试一次'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer title="发布订单" subtitle="选择地址、宠物和服务时长">
      <Form layout="vertical" className="owner-form">
        <Form.Item label="服务地址">
          <Selector
            value={addressId ? [addressId] : []}
            options={validAddresses.map((address) => ({ label: address.fullAddress, value: address.id }))}
            onChange={(value) => setAddressId(value[0])}
          />
        </Form.Item>
        <Form.Item label="宠物">
          <Selector
            value={petId ? [petId] : []}
            options={validPets.map((pet) => ({ label: `${pet.petName} · ${pet.weightKg}kg`, value: pet.id }))}
            onChange={(value) => setPetId(value[0])}
          />
          {selectedPet ? (
            <div className="pet-select-preview">
              <div className="pet-avatar">{selectedPet.petName.slice(0, 1)}</div>
              <div>
                <strong>{selectedPet.petName}</strong>
                <p>{selectedPet.weightKg}kg · 已通过审核</p>
              </div>
            </div>
          ) : null}
        </Form.Item>
        <Form.Item label="预约时间">
          <input
            className="native-input"
            type="datetime-local"
            value={appointmentTime}
            onChange={(event) => setAppointmentTime(event.target.value)}
          />
        </Form.Item>
        <Form.Item label="服务时长">
          <div className="duration-toggle">
            {[30, 60].map((item) => (
              <button
                key={item}
                className={duration === item ? 'duration-toggle__item duration-toggle__item--active' : 'duration-toggle__item'}
                type="button"
                onClick={() => setDuration(item as 30 | 60)}
              >
                <strong>{item}分钟</strong>
                <span>{formatMoney(getOrderPrice(item as 30 | 60))}</span>
              </button>
            ))}
          </div>
        </Form.Item>
        <Form.Item label="特殊要求">
          <TextArea rows={4} value={specialRequirements} onChange={setSpecialRequirements} />
        </Form.Item>
      </Form>
      <Card className="summary-card" title="价格明细">
        <div className="price-row"><span>服务费</span><strong key={price} className="price-pop">{formatMoney(price)}</strong></div>
        <div className="price-row"><span>平台服务费</span><strong>已包含</strong></div>
        <div className="price-row price-row--total"><span>合计</span><strong>{formatMoney(price)}</strong></div>
      </Card>
      <Button block color="primary" size="large" loading={submitting} disabled={submitting} onClick={handleSubmit}>
        {submitting ? '正在发布...' : '提交订单'}
      </Button>
    </PageContainer>
  );
}

function toLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(
    date.getHours()
  ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
