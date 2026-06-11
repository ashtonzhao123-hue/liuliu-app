import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import {
  ComplaintStatus,
  OrderStatus,
  PetReviewStatus,
  RiskLevel,
  WalkerAuthStatus,
  type Complaint,
  type ID,
  type Order,
  type OrderCheckpoint,
  type OrderMedia,
  type OrderTrack,
  type Pet,
  type Review,
  type UserAddress
} from '../types';
import { mapAddress, mapCheckpoint, mapComplaint, mapMedia, mapOrder, mapPet, mapReview, mapTrack, mapWalkerAuth } from './mappers';

export const ADMIN_SESSION_KEY = 'liuliu.admin.session';

export interface AdminOrderBundle {
  ownerUserId: ID;
  order: Order;
  address?: UserAddress;
  tracks: OrderTrack[];
  checkpoints: OrderCheckpoint[];
  media: OrderMedia[];
  complaints: Complaint[];
}

export interface AdminPetRecord {
  ownerUserId: ID;
  pet: Pet;
}

export interface AdminComplaintRecord {
  ownerUserId: ID;
  complaint: Complaint;
  order?: Order;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalOrders: number;
  todayOrders: number;
  totalIncome: number;
  todayIncome: number;
  walkerCount: number;
  ownerCount: number;
  activeOrders: number;
  completedOrders: number;
  exceptionOrders: number;
  pendingPets: number;
  pendingWalkers: number;
}

export interface WalkerApplication {
  id: ID;
  userId: ID;
  realName: string;
  schoolName: string;
  submittedAt: string;
  status: WalkerAuthStatus;
  examScore: number;
  rejectReason?: string;
}

export function isAdminLoggedIn(): boolean {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'logged-in';
}

export function loginAdmin(password: string): boolean {
  if (password !== 'admin123') return false;
  localStorage.setItem(ADMIN_SESSION_KEY, 'logged-in');
  return true;
}

export function logoutAdmin(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function getAdminDashboard(): Promise<AdminDashboardStats> {
  assertSupabaseConfigured();
  const [users, orders, pets, walkerAuth] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('orders').select('*'),
    supabase.from('pets').select('*'),
    supabase.from('walker_auth').select('*')
  ]);
  if (users.error) throw new Error(users.error.message);
  if (orders.error) throw new Error(orders.error.message);
  if (pets.error) throw new Error(pets.error.message);
  if (walkerAuth.error) throw new Error(walkerAuth.error.message);

  const orderList = (orders.data ?? []).map(mapOrder);
  const today = new Date().toDateString();
  const completed = orderList.filter((order) => order.orderStatus === OrderStatus.Completed);
  const todayCompleted = completed.filter((order) => order.completedAt && new Date(order.completedAt).toDateString() === today);

  return {
    totalUsers: users.data?.length ?? 0,
    totalOrders: orderList.length,
    todayOrders: orderList.filter((order) => new Date(order.createdAt).toDateString() === today).length,
    totalIncome: completed.reduce((sum, order) => sum + order.amountTotal, 0),
    todayIncome: todayCompleted.reduce((sum, order) => sum + order.amountTotal, 0),
    walkerCount: (walkerAuth.data ?? []).filter((row) => row.walker_auth_status === WalkerAuthStatus.Approved).length,
    ownerCount: users.data?.filter((row) => row.role_type === 1 || row.role_type === 3).length ?? 0,
    activeOrders: orderList.filter((order) => [OrderStatus.Accepted, OrderStatus.WalkerArrived, OrderStatus.InService].includes(order.orderStatus)).length,
    completedOrders: completed.length,
    exceptionOrders: orderList.filter((order) => order.exceptionFlag || order.orderStatus === OrderStatus.ExceptionHandling).length,
    pendingPets: (pets.data ?? []).filter((row) => row.review_status === PetReviewStatus.PendingReview).length,
    pendingWalkers: (walkerAuth.data ?? []).filter((row) => row.walker_auth_status === WalkerAuthStatus.PendingReview).length
  };
}

export async function listAdminOrders(status: 'all' | `${OrderStatus}` = 'all'): Promise<AdminOrderBundle[]> {
  assertSupabaseConfigured();
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('order_status', Number(status));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return hydrateOrders((data ?? []).map(mapOrder));
}

export async function markAdminOrderException(_ownerUserId: ID, orderId: ID): Promise<void> {
  const { error } = await supabase.from('orders').update({ exception_flag: 1, order_status: OrderStatus.ExceptionHandling }).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function cancelAdminOrder(_ownerUserId: ID, orderId: ID): Promise<void> {
  const { error } = await supabase.from('orders').update({ order_status: OrderStatus.Cancelled, cancel_reason: '后台手动取消' }).eq('id', orderId);
  if (error) throw new Error(error.message);
}

export async function listAdminPets(status: 'all' | `${PetReviewStatus}` = 'all'): Promise<AdminPetRecord[]> {
  assertSupabaseConfigured();
  let query = supabase.from('pets').select('*').eq('is_deleted', 0).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('review_status', Number(status));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const pet = mapPet(row);
    return { ownerUserId: pet.ownerUserId, pet };
  });
}

export async function reviewAdminPet(_ownerUserId: ID, petId: ID, approved: boolean): Promise<void> {
  const { error } = await supabase
    .from('pets')
    .update({
      review_status: approved ? PetReviewStatus.Approved : PetReviewStatus.Rejected,
      risk_level: approved ? RiskLevel.A : RiskLevel.C,
      reject_reason: approved ? null : '资料或风险项不符合平台准入规则'
    })
    .eq('id', petId);
  if (error) throw new Error(error.message);
}

export async function listAdminComplaints(): Promise<AdminComplaintRecord[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const complaints = (data ?? []).map(mapComplaint);
  const orderIds = Array.from(new Set(complaints.map((item) => item.orderId)));
  const orders = orderIds.length
    ? await supabase.from('orders').select('*').in('id', orderIds)
    : { data: [], error: null };
  if (orders.error) throw new Error(orders.error.message);
  const orderMap = new Map((orders.data ?? []).map((row) => [String(row.id), mapOrder(row)]));
  return complaints.map((complaint) => ({
    ownerUserId: orderMap.get(complaint.orderId)?.ownerUserId ?? '',
    complaint,
    order: orderMap.get(complaint.orderId)
  }));
}

export async function updateAdminComplaintStatus(_ownerUserId: ID, complaintId: ID, status: ComplaintStatus): Promise<void> {
  const { error } = await supabase.from('complaints').update({ complaint_status: status }).eq('id', complaintId);
  if (error) throw new Error(error.message);
}

export async function listWalkerApplications(): Promise<WalkerApplication[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('walker_auth').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const auth = mapWalkerAuth(row);
    return {
      id: auth.id,
      userId: auth.userId,
      realName: row.real_name ?? `用户${auth.userId}`,
      schoolName: auth.schoolName,
      submittedAt: auth.createdAt,
      status: auth.walkerAuthStatus,
      examScore: auth.examScore ?? 0,
      rejectReason: auth.rejectReason
    };
  });
}

export async function reviewWalkerApplication(id: ID, approved: boolean): Promise<void> {
  const { error } = await supabase
    .from('walker_auth')
    .update({
      walker_auth_status: approved ? WalkerAuthStatus.Approved : WalkerAuthStatus.Rejected,
      reject_reason: approved ? null : '学生认证资料不完整',
      approved_at: approved ? new Date().toISOString() : null
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function hydrateOrders(orders: Order[]): Promise<AdminOrderBundle[]> {
  return Promise.all(
    orders.map(async (order) => {
      const [address, tracks, checkpoints, media, complaints] = await Promise.all([
        supabase.from('user_addresses').select('*').eq('id', order.addressId).maybeSingle(),
        supabase.from('order_tracks').select('*').eq('order_id', order.id),
        supabase.from('order_checkpoints').select('*').eq('order_id', order.id),
        supabase.from('order_media').select('*').eq('order_id', order.id),
        supabase.from('complaints').select('*').eq('order_id', order.id)
      ]);
      return {
        ownerUserId: order.ownerUserId,
        order,
        address: address.data ? mapAddress(address.data) : undefined,
        tracks: (tracks.data ?? []).map(mapTrack),
        checkpoints: (checkpoints.data ?? []).map(mapCheckpoint),
        media: (media.data ?? []).map(mapMedia),
        complaints: (complaints.data ?? []).map(mapComplaint)
      };
    })
  );
}
