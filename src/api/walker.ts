import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import {
  CheckpointType,
  ComplaintStatus,
  OrderStatus,
  type Complaint,
  type ID,
  type Order,
  type OrderCheckpoint,
  type OrderMedia,
  type OrderTrack,
  type Review,
  type UserAddress
} from '../types';
import { SERVICE_CENTER, calculateDistanceMeters } from './owner';
import {
  checkpointToRow,
  complaintToRow,
  mapAddress,
  mapCheckpoint,
  mapComplaint,
  mapMedia,
  mapOrder,
  mapReview,
  mapTrack,
  mediaToRow,
  orderToRow,
  trackToRow
} from './mappers';

export interface WalkerOrderBundle {
  ownerUserId: ID;
  order: Order;
  address?: UserAddress;
  tracks: OrderTrack[];
  checkpoints: OrderCheckpoint[];
  media: OrderMedia[];
  review?: Review;
}

export interface WalkerStats {
  todayIncome: number;
  weekIncome: number;
  totalIncome: number;
  serviceCount: number;
  averageRating: number;
}

export type WalkerHistoryFilter = 'all' | 'active' | 'pendingConfirm' | 'completed' | 'cancelled';

const WALKER_STATUS_PREFIX = 'liuliu.walker.status.';

export function getWalkerOnlineStatus(walkerUserId: ID): boolean {
  return localStorage.getItem(`${WALKER_STATUS_PREFIX}${walkerUserId}`) !== 'resting';
}

export function setWalkerOnlineStatus(walkerUserId: ID, online: boolean): void {
  localStorage.setItem(`${WALKER_STATUS_PREFIX}${walkerUserId}`, online ? 'online' : 'resting');
}

export async function listAvailableOrders(): Promise<WalkerOrderBundle[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('orders').select('*').eq('order_status', OrderStatus.PendingAccept).order('appointment_time');
  if (error) throw new Error(error.message);
  return hydrateBundles((data ?? []).map(mapOrder));
}

export async function listWalkerOrders(walkerUserId: ID, filter: WalkerHistoryFilter = 'all'): Promise<WalkerOrderBundle[]> {
  assertSupabaseConfigured();
  let query = supabase.from('orders').select('*').eq('walker_id', walkerUserId).order('updated_at', { ascending: false });
  const statuses = getWalkerFilterStatuses(filter);
  if (statuses.length > 0) query = query.in('order_status', statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return hydrateBundles((data ?? []).map(mapOrder));
}

export async function getWalkerOrderBundle(orderId: ID): Promise<WalkerOrderBundle | undefined> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (error) throw new Error(error.message);
  const bundles = await hydrateBundles(data ? [mapOrder(data)] : []);
  return bundles[0];
}

export async function acceptWalkerOrder(orderId: ID, walkerUserId: ID, walkerNickname: string): Promise<Order> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('orders')
    .update({ walker_id: walkerUserId, walker_nickname_snapshot: walkerNickname, order_status: OrderStatus.PendingPay })
    .eq('id', orderId)
    .eq('order_status', OrderStatus.PendingAccept)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('这单已经被接走啦，看看其他订单吧');
  return mapOrder(data);
}

export async function submitArriveCheckpoint(orderId: ID, walkerUserId: ID, note: string, photoUrl?: string): Promise<Order> {
  const bundle = await getWalkerOrderBundle(orderId);
  if (!bundle) throw new Error('订单不存在');
  const point = getOrderPoint(bundle);
  const { error } = await supabase.from('order_checkpoints').insert(
    checkpointToRow({
      orderId,
      walkerUserId,
      checkpointType: CheckpointType.Arrived,
      lat: point.lat,
      lng: point.lng,
      photoUrl,
      note
    })
  );
  if (error) throw new Error(error.message);
  return updateOrder(orderId, { order_status: OrderStatus.WalkerArrived });
}

export async function startWalkerService(orderId: ID, walkerUserId: ID): Promise<Order> {
  const bundle = await getWalkerOrderBundle(orderId);
  if (!bundle) throw new Error('订单不存在');
  const point = getOrderPoint(bundle);
  const now = new Date().toISOString();
  const [checkpoint, track] = await Promise.all([
    supabase.from('order_checkpoints').insert(
      checkpointToRow({
        orderId,
        walkerUserId,
        checkpointType: CheckpointType.ServiceStarted,
        lat: point.lat,
        lng: point.lng,
        note: '开始服务'
      })
    ),
    supabase.from('order_tracks').insert(trackToRow({ orderId, walkerUserId, lat: point.lat, lng: point.lng, accuracy: 12, speed: 1.1, direction: 80, recordedAt: now }))
  ]);
  if (checkpoint.error) throw new Error(checkpoint.error.message);
  if (track.error) throw new Error(track.error.message);
  return updateOrder(orderId, { order_status: OrderStatus.InService, start_time: bundle.order.startTime ?? now });
}

export async function uploadWalkerTrack(orderId: ID, walkerUserId: ID): Promise<OrderTrack> {
  const bundle = await getWalkerOrderBundle(orderId);
  if (!bundle) throw new Error('订单不存在');
  const point = getOrderPoint(bundle);
  const { data, error } = await supabase
    .from('order_tracks')
    .insert(trackToRow({ orderId, walkerUserId, lat: point.lat + randomDelta(), lng: point.lng + randomDelta(), accuracy: 12, speed: 1.1, direction: 80, recordedAt: new Date().toISOString() }))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapTrack(data);
}

export async function uploadWalkerMedia(orderId: ID, walkerUserId: ID, dataUrl: string, remark: string): Promise<OrderMedia> {
  const bundle = await getWalkerOrderBundle(orderId);
  if (!bundle) throw new Error('订单不存在');
  const point = getOrderPoint(bundle);
  const mediaInsert = await supabase
    .from('order_media')
    .insert(mediaToRow({ orderId, uploaderUserId: walkerUserId, mediaType: 1, mediaScene: 2, mediaUrl: dataUrl, thumbnailUrl: dataUrl, remark }))
    .select('*')
    .single();
  if (mediaInsert.error) throw new Error(mediaInsert.error.message);
  const checkpoint = await supabase.from('order_checkpoints').insert(
    checkpointToRow({ orderId, walkerUserId, checkpointType: CheckpointType.Progress, lat: point.lat, lng: point.lng, photoUrl: dataUrl, note: remark || '过程打卡' })
  );
  if (checkpoint.error) throw new Error(checkpoint.error.message);
  return mapMedia(mediaInsert.data);
}

export async function finishWalkerService(orderId: ID, walkerUserId: ID, note: string, photoUrl?: string): Promise<Order> {
  const bundle = await getWalkerOrderBundle(orderId);
  if (!bundle) throw new Error('订单不存在');
  const minCount = bundle.order.serviceDurationMinutes === 60 ? 2 : 1;
  if (bundle.media.filter((item) => item.mediaScene === 2).length < minCount) throw new Error(`请至少上传 ${minCount} 张过程照片`);
  const point = getOrderPoint(bundle);
  const checkpoint = await supabase.from('order_checkpoints').insert(
    checkpointToRow({ orderId, walkerUserId, checkpointType: CheckpointType.ServiceEnded, lat: point.lat, lng: point.lng, photoUrl, note })
  );
  if (checkpoint.error) throw new Error(checkpoint.error.message);
  if (photoUrl) {
    const media = await supabase.from('order_media').insert(mediaToRow({ orderId, uploaderUserId: walkerUserId, mediaType: 1, mediaScene: 3, mediaUrl: photoUrl, thumbnailUrl: photoUrl, remark: note }));
    if (media.error) throw new Error(media.error.message);
  }
  return updateOrder(orderId, { order_status: OrderStatus.PendingOwnerConfirm, end_time: new Date().toISOString() });
}

export async function getWalkerStats(walkerUserId: ID): Promise<WalkerStats> {
  assertSupabaseConfigured();
  const { data: orders, error } = await supabase.from('orders').select('*').eq('walker_id', walkerUserId).eq('order_status', OrderStatus.Completed);
  if (error) throw new Error(error.message);
  const mapped = (orders ?? []).map(mapOrder);
  const today = new Date().toDateString();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const sum = (items: Order[]) => items.reduce((total, order) => total + order.walkerIncome, 0);
  const { data: reviews } = await supabase.from('reviews').select('*').eq('to_user_id', walkerUserId);
  const ratings = (reviews ?? []).map((row) => mapReview(row).rating);
  return {
    todayIncome: sum(mapped.filter((order) => order.completedAt && new Date(order.completedAt).toDateString() === today)),
    weekIncome: sum(mapped.filter((order) => order.completedAt && new Date(order.completedAt) >= weekStart)),
    totalIncome: sum(mapped),
    serviceCount: mapped.length,
    averageRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 5
  };
}

export async function submitWalkerComplaint(orderId: ID, walkerUserId: ID, content: string): Promise<Complaint> {
  const { data, error } = await supabase
    .from('complaints')
    .insert(complaintToRow({ orderId, userId: walkerUserId, complaintType: 'other', content, evidenceUrls: [], status: ComplaintStatus.Pending }))
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapComplaint(data);
}

export function getWalkerDistanceText(bundle: WalkerOrderBundle): string {
  const distance = bundle.address ? calculateDistanceMeters(SERVICE_CENTER.lat, SERVICE_CENTER.lng, bundle.address.lat, bundle.address.lng) : 0;
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${distance}m`;
}

async function hydrateBundles(orders: Order[]): Promise<WalkerOrderBundle[]> {
  return Promise.all(
    orders.map(async (order) => {
      const [address, tracks, checkpoints, media, review] = await Promise.all([
        supabase.from('user_addresses').select('*').eq('id', order.addressId).maybeSingle(),
        supabase.from('order_tracks').select('*').eq('order_id', order.id).order('recorded_at'),
        supabase.from('order_checkpoints').select('*').eq('order_id', order.id).order('created_at'),
        supabase.from('order_media').select('*').eq('order_id', order.id).order('created_at'),
        supabase.from('reviews').select('*').eq('order_id', order.id).maybeSingle()
      ]);
      return {
        ownerUserId: order.ownerUserId,
        order,
        address: address.data ? mapAddress(address.data) : undefined,
        tracks: (tracks.data ?? []).map(mapTrack),
        checkpoints: (checkpoints.data ?? []).map(mapCheckpoint),
        media: (media.data ?? []).map(mapMedia),
        review: review.data ? mapReview(review.data) : undefined
      };
    })
  );
}

async function updateOrder(orderId: ID, values: Record<string, any>): Promise<Order> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('orders').update(values).eq('id', orderId).select('*').single();
  if (error) throw new Error(error.message);
  return mapOrder(data);
}

function getWalkerFilterStatuses(filter: WalkerHistoryFilter): OrderStatus[] {
  if (filter === 'active') return [OrderStatus.PendingPay, OrderStatus.Accepted, OrderStatus.WalkerArrived, OrderStatus.InService];
  if (filter === 'pendingConfirm') return [OrderStatus.PendingOwnerConfirm];
  if (filter === 'completed') return [OrderStatus.Completed];
  if (filter === 'cancelled') return [OrderStatus.Cancelled];
  return [];
}

function getOrderPoint(bundle: WalkerOrderBundle) {
  const lastTrack = bundle.tracks[bundle.tracks.length - 1];
  return { lat: lastTrack?.lat ?? bundle.address?.lat ?? SERVICE_CENTER.lat, lng: lastTrack?.lng ?? bundle.address?.lng ?? SERVICE_CENTER.lng };
}

function randomDelta(): number {
  return 0.00012 + Math.random() * 0.0001;
}
