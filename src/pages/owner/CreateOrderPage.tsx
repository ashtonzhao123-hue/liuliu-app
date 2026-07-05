import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dialog, Form, Selector, TextArea } from 'antd-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { createOrder, getOrderPrice, listAddresses, listPets } from '../../api/owner';
import { PageContainer } from '../../components/PageContainer';
import { useAppStore } from '../../stores/useAppStore';
import { AddressReviewStatus, PetReviewStatus, RiskLevel, type Pet, type UserAddress } from '../../types';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { formatMoney } from '../../utils/format';
import { notify } from '../../utils/notify';

interface RepeatOrderState {
  petId?: string;
  addressId?: string;
  duration?: 30 | 60;
  specialRequirements?: string;
}

interface WeatherAdvice {
  text: string;
  temp: number;
  groundTemp: number;
  level: 'safe' | 'warm' | 'danger';
}

export function CreateOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const repeatState = (location.state ?? {}) as RepeatOrderState;
  const currentUser = useAppStore((state) => state.currentUser);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressId, setAddressId] = useState<string>();
  const [petId, setPetId] = useState<string>();
  const [duration, setDuration] = useState<30 | 60>(repeatState.duration ?? 30);
  const [appointmentTime, setAppointmentTime] = useState(() => toLocalDateTime(new Date(Date.now() + 30 * 60 * 1000)));
  const [specialRequirements, setSpecialRequirements] = useState(repeatState.specialRequirements ?? '');
  const [weather, setWeather] = useState<WeatherAdvice>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    void Promise.all([listPets(currentUser.id), listAddresses(currentUser.id)]).then(([petList, addressList]) => {
      const validPetList = petList.filter((pet) => pet.reviewStatus === PetReviewStatus.Approved && pet.riskLevel === RiskLevel.A);
      const validAddressList = addressList.filter((address) => address.reviewStatus === AddressReviewStatus.Valid);
      setPets(petList);
      setAddresses(addressList);
      setAddressId(repeatState.addressId && validAddressList.some((item) => item.id === repeatState.addressId)
        ? repeatState.addressId
        : validAddressList.find((item) => item.isDefault)?.id ?? validAddressList[0]?.id);
      setPetId(repeatState.petId && validPetList.some((item) => item.id === repeatState.petId)
        ? repeatState.petId
        : validPetList[0]?.id);
    });
  }, [currentUser, repeatState.addressId, repeatState.petId]);

  const price = useMemo(() => getOrderPrice(duration), [duration]);
  const validPets = pets.filter((pet) => pet.reviewStatus === PetReviewStatus.Approved && pet.riskLevel === RiskLevel.A);
  const validAddresses = addresses.filter((address) => address.reviewStatus === AddressReviewStatus.Valid);
  const selectedPet = validPets.find((pet) => pet.id === petId);
  const selectedAddress = validAddresses.find((address) => address.id === addressId);
  const hasOrderPrerequisites = validPets.length > 0 && validAddresses.length > 0;

  useEffect(() => {
    const key = import.meta.env.VITE_HEFENG_WEATHER_KEY;
    if (!key || !selectedAddress) {
      setWeather(undefined);
      return;
    }
    const controller = new AbortController();
    void fetch(`https://devapi.qweather.com/v7/weather/now?location=${selectedAddress.lng},${selectedAddress.lat}&key=${key}`, {
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data) => {
        const temp = Number(data?.now?.temp);
        if (Number.isNaN(temp)) return;
        const groundTemp = Math.round(temp * 1.7);
        const level: WeatherAdvice['level'] = groundTemp >= 45 ? 'danger' : groundTemp >= 36 ? 'warm' : 'safe';
        const text = level === 'danger'
          ? '地面偏烫，建议避开正午或缩短时长。'
          : level === 'warm'
            ? '地面有些热，记得带水，优先走树荫。'
            : '天气适合出门，正常安排就好。';
        setWeather({ temp, groundTemp, level, text });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedAddress]);

  async function handleSubmit() {
    if (!hasOrderPrerequisites) {
      notify('先补齐可下单的宠物和服务地址，再发布订单。');
      return;
    }
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
    <PageContainer title="发布订单" subtitle="选好时间，找人遛">
      {location.state ? <div className="prefill-note">已带入上次的宠物、地址和时长，换个时间就能发出。</div> : null}

      {validAddresses.length === 0 ? (
        <Card className="summary-card" title="先添加服务地址">
          <p className="muted-text">需要一个审核有效的地址，遛遛侠才能判断距离和路线。</p>
          <Button size="small" color="primary" onClick={() => navigate('/owner/addresses/new')}>
            添加地址
          </Button>
        </Card>
      ) : null}

      {validPets.length === 0 ? (
        <Card className="summary-card" title="先添加可下单的宠物">
          <p className="muted-text">只有审核通过且风险等级为 A 的宠物可以发布遛狗订单。</p>
          <Button size="small" color="primary" onClick={() => navigate('/owner/pets/new')}>
            添加宠物
          </Button>
        </Card>
      ) : null}

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
          {weather ? (
            <div className={`weather-advice weather-advice--${weather.level}`}>
              <strong>{weather.temp}°C · 估算地面 {weather.groundTemp}°C</strong>
              <span>{weather.text}</span>
            </div>
          ) : null}
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
          <TextArea rows={4} value={specialRequirements} onChange={setSpecialRequirements} placeholder="比如：怕热、不要去草丛、回家后擦脚。" />
        </Form.Item>
      </Form>
      <Card className="summary-card" title="价格明细">
        <div className="price-row"><span>服务费</span><strong key={price} className="price-pop">{formatMoney(price)}</strong></div>
        <div className="price-row"><span>平台服务费</span><strong>已包含</strong></div>
        <div className="price-row price-row--total"><span>合计</span><strong>{formatMoney(price)}</strong></div>
      </Card>
      <Button block color="primary" size="large" loading={submitting} disabled={submitting || !hasOrderPrerequisites} onClick={handleSubmit}>
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
