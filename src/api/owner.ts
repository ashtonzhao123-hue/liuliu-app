import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import {
  AddressReviewStatus,
  CheckpointType,
  ComplaintStatus,
  OrderStatus,
  PayStatus,
  PetReviewStatus,
  RiskLevel,
  type BooleanNumber,
  type Complaint,
  type ComplaintType,
  type ID,
  type Order,
  type Pet,
  type PetBreedCode,
  type PetGender,
  type Review,
  type UserAddress
} from '../types';
import {
  addressToRow,
  checkpointToRow,
  complaintToRow,
  mapAddress,
  mapCheckpoint,
  mapComplaint,
  mapMedia,
  mapOrder,
  mapPet,
  mapReview,
  mapTrack,
  mediaToRow,
  orderToRow,
  petToRow,
  reviewToRow,
  trackToRow
} from './mappers';
import { getPlatformFeeRate } from '../utils/fee';

export const SERVICE_CENTER = {
  name: '幸福小区',
  lat: 22.543096,
  lng: 114.057865
} as const;

export const SERVICE_RADIUS_METERS = 3000;

export const PET_BREEDS: Array<{ code: PetBreedCode; label: string; maxWeightKg: number }> = [
  { code: 'BICHON', label: '比熊', maxWeightKg: 15 },
  { code: 'POODLE', label: '贵宾/泰迪', maxWeightKg: 15 },
  { code: 'POMERANIAN', label: '博美', maxWeightKg: 10 },
  { code: 'SCHNAUZER', label: '雪纳瑞', maxWeightKg: 15 },
  { code: 'CHIHUAHUA', label: '吉娃娃', maxWeightKg: 8 },
  { code: 'YORKSHIRE', label: '约克夏', maxWeightKg: 8 },
  { code: 'CORGI', label: '柯基', maxWeightKg: 15 }
];

export interface PetInput {
  petName: string;
  avatarUrl?: string;
  breed: PetBreedCode;
  gender: PetGender;
  ageMonths: number;
  weightKg: number;
  neutered: BooleanNumber;
  vaccinated: BooleanNumber;
  acceptsStrangers: BooleanNumber;
  biteHistory: BooleanNumber;
  jumpPeople: BooleanNumber;
  leashTrained: BooleanNumber;
  healthNote?: string;
  remark?: string;
}

export interface AddressInput {
  communityName: string;
  buildingNo: string;
  roomNo: string;
  contactName: string;
  contactMobile: string;
  lat: number;
  lng: number;
  addressNote?: string;
  isDefault: BooleanNumber;
}

export interface CreateOrderInput {
  addressId: ID;
  petId: ID;
  serviceDurationMinutes: 30 | 60;
  appointmentTime: string;
  specialRequirements?: string;
}

export interface ReviewInput {
  rating: number;
  punctualScore: number;
  attitudeScore: number;
  petFriendlyScore: number;
  requirementScore: number;
  content: string;
}

export interface ComplaintInput {
  complaintType: ComplaintType;
  content: string;
}

export interface ActiveWalkerInfo {
  count: number;
  level: 'plenty' | 'few' | 'none';
}

export async function getActiveWalkerCount(): Promise<ActiveWalkerInfo> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('get_active_walker_count');
  if (error) {
    console.warn('Failed to get active walker count', error);
    return { count: 0, level: 'none' };
  }

  const numericCount = Number(data);
  const count = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;
  return { count, level: count >= 3 ? 'plenty' : count >= 1 ? 'few' : 'none' };
}

export function getPetBreedLabel(code: string): string {
  return PET_BREEDS.find((breed) => breed.code === code)?.label ?? code;
}

export function getOrderPrice(duration: 30 | 60): number {
  return duration === 30 ? 39 : 69;
}

export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function listPets(userId: ID): Promise<Pet[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('pets').select('*').eq('user_id', userId).eq('is_deleted', 0).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPet);
}

export async function getPet(userId: ID, id: ID): Promise<Pet | undefined> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('pets').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPet(data) : undefined;
}

export async function savePet(userId: ID, input: PetInput, id?: ID): Promise<Pet> {
  assertSupabaseConfigured();
  validatePet(input);
  const payload = petToRow({
    ownerUserId: userId,
    petName: input.petName,
    avatarUrl: input.avatarUrl || '',
    breed: input.breed,
    gender: input.gender,
    ageMonths: input.ageMonths,
    weightKg: input.weightKg,
    sizeLevel: 1,
    neutered: input.neutered,
    vaccinated: input.vaccinated,
    acceptsStrangers: input.acceptsStrangers,
    biteHistory: input.biteHistory,
    jumpPeople: input.jumpPeople,
    leashTrained: input.leashTrained,
    healthNote: input.healthNote,
    remark: input.remark,
    riskLevel: RiskLevel.A,
    reviewStatus: PetReviewStatus.PendingReview,
    isDeleted: false
  });
  const query = id
    ? supabase.from('pets').update(payload).eq('id', id).eq('user_id', userId).select('*').single()
    : supabase.from('pets').insert(payload).select('*').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapPet(data);
}

export async function deletePet(userId: ID, id: ID): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.from('pets').update({ is_deleted: 1 }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function listAddresses(userId: ID): Promise<UserAddress[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('user_addresses').select('*').eq('user_id', userId).eq('is_deleted', 0).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAddress);
}

export async function getAddress(userId: ID, id: ID): Promise<UserAddress | undefined> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('user_addresses').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAddress(data) : undefined;
}

export async function saveAddress(userId: ID, input: AddressInput, id?: ID): Promise<UserAddress> {
  assertSupabaseConfigured();
  const distanceMeters = calculateDistanceMeters(SERVICE_CENTER.lat, SERVICE_CENTER.lng, input.lat, input.lng);
  const address: Partial<UserAddress> = {
    userId,
    communityName: input.communityName,
    buildingNo: input.buildingNo,
    roomNo: input.roomNo,
    contactName: input.contactName,
    contactMobile: input.contactMobile,
    lat: input.lat,
    lng: input.lng,
    fullAddress: `${input.communityName} ${input.buildingNo} ${input.roomNo}`,
    addressNote: input.addressNote,
    isDefault: input.isDefault,
    reviewStatus: distanceMeters <= SERVICE_RADIUS_METERS ? AddressReviewStatus.Valid : AddressReviewStatus.OutOfServiceArea,
    distanceMeters,
    isDeleted: false
  };
  if (input.isDefault) {
    // Clear existing defaults first — note: for true atomicity use a DB function
    await supabase.from('user_addresses').update({ is_default: 0 }).eq('user_id', userId).eq('is_default', 1);
  }
  const query = id
    ? supabase.from('user_addresses').update(addressToRow(address)).eq('id', id).eq('user_id', userId).select('*').single()
    : supabase.from('user_addresses').insert(addressToRow(address)).select('*').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapAddress(data);
}

export async function deleteAddress(userId: ID, id: ID): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.from('user_addresses').update({ is_deleted: 1, is_default: 0 }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function setDefaultAddress(userId: ID, id: ID): Promise<void> {
  assertSupabaseConfigured();
  // Use the atomic database function to avoid TOCTOU race condition
  const { error } = await supabase.rpc('set_default_address', {
    p_user_id: userId,
    p_address_id: id
  });
  if (error) throw new Error(error.message);
}

export async function listOrders(userId: ID, filter: string = 'all'): Promise<Order[]> {
  assertSupabaseConfigured();
  let query = supabase.from('orders').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
  if (filter !== 'all') {
    query = query.in('order_status', getOrderFilterStatuses(filter));
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrder);
}

export async function getOrderBundle(userId: ID, id: ID) {
  assertSupabaseConfigured();
  const { data: orderRow, error } = await supabase.from('orders').select('*').eq('id', id).eq('owner_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!orderRow) {
    return { order: undefined, tracks: [], checkpoints: [], media: [], review: undefined };
  }
  const [tracks, checkpoints, media, review] = await Promise.all([
    supabase.from('order_tracks').select('*').eq('order_id', id).order('recorded_at'),
    supabase.from('order_checkpoints').select('*').eq('order_id', id).order('created_at'),
    supabase.from('order_media').select('*').eq('order_id', id).order('created_at'),
    supabase.from('reviews').select('*').eq('order_id', id).maybeSingle()
  ]);
  return {
    order: mapOrder(orderRow),
    tracks: (tracks.data ?? []).map(mapTrack),
    checkpoints: (checkpoints.data ?? []).map(mapCheckpoint),
    media: (media.data ?? []).map(mapMedia),
    review: review.data ? mapReview(review.data) : undefined
  };
}

export async function createOrder(userId: ID, input: CreateOrderInput): Promise<Order> {
  assertSupabaseConfigured();
  // Validate appointment time is in the future
  const appointmentDate = new Date(input.appointmentTime);
  if (Number.isNaN(appointmentDate.getTime())) throw new Error('预约时间格式不正确');
  if (appointmentDate <= new Date()) throw new Error('预约时间必须在当前时间之后');
  const [address, pet] = await Promise.all([getAddress(userId, input.addressId), getPet(userId, input.petId)]);
  if (!address || address.reviewStatus !== AddressReviewStatus.Valid) throw new Error('请选择服务范围内的地址');
  if (!pet || pet.reviewStatus !== PetReviewStatus.Approved || pet.riskLevel !== RiskLevel.A) throw new Error('请选择审核通过且风险等级为 A 的宠物');
  const amountTotal = getOrderPrice(input.serviceDurationMinutes);
  const platformFeeRate = getPlatformFeeRate();
  const payload = orderToRow({
    orderNo: createOrderNo(),
    ownerUserId: userId,
    petId: pet.id,
    addressId: address.id,
    serviceType: 1,
    serviceDurationMinutes: input.serviceDurationMinutes,
    appointmentTime: input.appointmentTime,
    orderStatus: OrderStatus.PendingAccept,
    specialRequirements: input.specialRequirements,
    amountTotal,
    platformCommission: Number((amountTotal * platformFeeRate).toFixed(2)),
    walkerIncome: Number((amountTotal * (1 - platformFeeRate)).toFixed(2)),
    payStatus: PayStatus.Pending,
    exceptionFlag: 0,
    petNameSnapshot: pet.petName,
    breedSnapshot: getPetBreedLabel(pet.breed),
    ownerNicknameSnapshot: '主人',
    addressSnapshot: address.fullAddress
  });
  const { data, error } = await supabase.from('orders').insert(payload).select('*').single();
  if (error) throw new Error(error.message);
  return mapOrder(data);
}

export async function cancelOrder(userId: ID, id: ID): Promise<Order> {
  const cancellableStatuses: OrderStatus[] = [
    OrderStatus.PendingAccept,
    OrderStatus.PendingPay,
    OrderStatus.Accepted,
    OrderStatus.WalkerArrived,
    OrderStatus.InService,
    OrderStatus.PendingOwnerConfirm
  ];
  const { data: current } = await supabase
    .from('orders')
    .select('order_status')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (!current) throw new Error('订单不存在');
  if (!cancellableStatuses.includes(current.order_status)) {
    throw new Error('当前订单状态不可取消');
  }
  return updateOwnerOrder(userId, id, { order_status: OrderStatus.Cancelled, cancel_reason: '主人取消' });
}

export async function simulateAcceptOrder(userId: ID, id: ID): Promise<Order> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).eq('owner_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('订单不存在');
  const order = mapOrder(data);
  if (order.ownerUserId === userId) throw new Error('主人不能接自己发布的订单');
  return updateOwnerOrder(userId, id, { walker_id: userId, walker_nickname_snapshot: '模拟遛狗员', order_status: OrderStatus.PendingPay });
}

export async function simulatePayOrder(userId: ID, id: ID): Promise<Order> {
  return updateOwnerOrder(userId, id, { pay_status: PayStatus.Success, order_status: OrderStatus.Accepted });
}

export async function simulateStartService(userId: ID, id: ID): Promise<Order> {
  const order = await updateOwnerOrder(userId, id, { order_status: OrderStatus.InService, start_time: new Date().toISOString() });
  await seedLiveData(order);
  return order;
}

export async function simulateFinishService(userId: ID, id: ID): Promise<Order> {
  return updateOwnerOrder(userId, id, { order_status: OrderStatus.PendingOwnerConfirm, end_time: new Date().toISOString() });
}

export async function confirmOrderComplete(userId: ID, id: ID): Promise<Order> {
  return updateOwnerOrder(userId, id, { order_status: OrderStatus.Completed, completed_at: new Date().toISOString() });
}

export async function submitReview(userId: ID, orderId: ID, input: ReviewInput): Promise<Review> {
  assertSupabaseConfigured();
  const { data: orderRow, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderError) throw new Error(orderError.message);
  const order = orderRow ? mapOrder(orderRow) : undefined;
  if (!order) throw new Error('订单不存在');
  if (order.ownerUserId !== userId) throw new Error('只能评价自己的订单');
  if (order.orderStatus !== OrderStatus.Completed) throw new Error('订单尚未完成，还不能评价');
  if (!order.walkerUserId) throw new Error('该订单没有服务者，无法评价');
  const { data, error } = await supabase
    .from('reviews')
    .insert(reviewToRow({ orderId, fromUserId: userId, toUserId: order.walkerUserId, ...input }))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapReview(data);
}

export async function submitComplaint(userId: ID, orderId: ID, input: ComplaintInput): Promise<Complaint> {
  assertSupabaseConfigured();
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('owner_id, walker_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!orderRow) throw new Error('订单不存在');
  if (orderRow.owner_id !== userId && orderRow.walker_id !== userId) {
    throw new Error('只能对自己相关的订单发起投诉');
  }
  const { data, error } = await supabase
    .from('complaints')
    .insert(complaintToRow({ orderId, userId, complaintType: input.complaintType, content: input.content, evidenceUrls: [], status: ComplaintStatus.Pending }))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapComplaint(data);
}

async function updateOwnerOrder(userId: ID, id: ID, values: Record<string, any>): Promise<Order> {
  assertSupabaseConfigured();
  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('order_status')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!current) throw new Error('订单不存在');
  const terminalStatuses: OrderStatus[] = [OrderStatus.Completed, OrderStatus.Cancelled];
  if (terminalStatuses.includes(current.order_status)) {
    throw new Error('已完成或已取消的订单不可再修改');
  }
  const { data, error } = await supabase.from('orders').update(values).eq('id', id).eq('owner_id', userId).select('*').single();
  if (error) throw new Error(error.message);
  return mapOrder(data);
}

async function seedLiveData(order: Order) {
  const point = { lat: SERVICE_CENTER.lat + 0.002, lng: SERVICE_CENTER.lng - 0.002 };
  await supabase.from('order_tracks').insert(
    Array.from({ length: 4 }).map((_, index) =>
      trackToRow({
        orderId: order.id,
        walkerUserId: order.walkerUserId ?? '',
        lat: point.lat + index * 0.0002,
        lng: point.lng + index * 0.0002,
        accuracy: 12,
        speed: 1.2,
        direction: 80,
        recordedAt: new Date(Date.now() - (4 - index) * 60_000).toISOString()
      })
    )
  );
  await supabase.from('order_checkpoints').insert(
    checkpointToRow({
      orderId: order.id,
      walkerUserId: order.walkerUserId ?? '',
      checkpointType: CheckpointType.ServiceStarted,
      lat: point.lat,
      lng: point.lng,
      note: '开始服务'
    })
  );
  await supabase.from('order_media').insert(
    mediaToRow({
      orderId: order.id,
      uploaderUserId: order.walkerUserId ?? '',
      mediaType: 1,
      mediaScene: 2,
      mediaUrl: '',
      thumbnailUrl: '',
      remark: '过程打卡'
    })
  );
}

function getOrderFilterStatuses(filter: string): OrderStatus[] {
  if (filter === 'pendingAccept') return [OrderStatus.PendingAccept];
  if (filter === 'pendingPay') return [OrderStatus.PendingPay];
  if (filter === 'inProgress') return [OrderStatus.Accepted, OrderStatus.WalkerArrived, OrderStatus.InService];
  if (filter === 'pendingConfirm') return [OrderStatus.PendingOwnerConfirm];
  if (filter === 'completed') return [OrderStatus.Completed];
  if (filter === 'cancelled') return [OrderStatus.Cancelled];
  return [];
}

function createOrderNo(): string {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `LL${Date.now()}${suffix}`;
}

function validatePet(input: PetInput) {
  const breed = PET_BREEDS.find((item) => item.code === input.breed);
  if (!breed) throw new Error('暂不支持该品种');
  if (input.weightKg > breed.maxWeightKg) throw new Error(`${breed.label}当前最大支持 ${breed.maxWeightKg}kg`);
  if (input.biteHistory) throw new Error('有咬人史的犬只暂不可服务');
  if (!input.acceptsStrangers) throw new Error('暂仅支持可接受陌生人的犬只');
  if (!input.leashTrained) throw new Error('暂仅支持有牵引习惯的犬只');
}
