import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import { RoleType, UserStatus, type LoginResponse, type SelectedRole, type User } from '../types';
import { mapUser, userToRow } from './mappers';

export interface PasswordAuthRequest {
  email: string;
  password: string;
}

export interface PhoneOtpRequest {
  phone: string;
}

export interface VerifyPhoneOtpRequest {
  phone: string;
  token: string;
}

export function isValidMobile(mobile: string): boolean {
  return /^1[3-9]\d{9}$/.test(mobile);
}

export function toChinaPhone(phone: string): string {
  return `+86${phone.replace(/\D/g, '').slice(0, 11)}`;
}

export async function sendLoginCode({ phone }: PhoneOtpRequest): Promise<{ expiresInSeconds: number }> {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signInWithOtp({ phone: toChinaPhone(phone) });
  if (error) throw new Error(error.message);
  return { expiresInSeconds: 60 };
}

export async function loginWithPhoneOtp({ phone, token }: VerifyPhoneOtpRequest): Promise<LoginResponse> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: toChinaPhone(phone),
    token,
    type: 'sms'
  });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('登录失败');
  const user = await ensureBusinessUser(data.user);
  return buildLoginResponse(user, data.session);
}

export async function loginWithPassword({ email, password }: PasswordAuthRequest): Promise<LoginResponse> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('登录失败');
  const user = await ensureBusinessUser(data.user);
  return buildLoginResponse(user, data.session);
}

export async function signUpWithPassword({ email, password }: PasswordAuthRequest): Promise<void> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('注册失败');

  if (data.session) {
    await supabase.auth.signOut();
  }
}

export async function getCurrentBusinessUser(): Promise<User | undefined> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const authUser = data.session?.user;
  if (!authUser?.id) return undefined;
  return ensureBusinessUser(authUser);
}

export async function selectUserRole(userId: string, role: SelectedRole): Promise<SelectedRole> {
  assertSupabaseConfigured();
  const roleType = role === 'walker' ? RoleType.Walker : RoleType.Owner;
  const [userUpdate, metadataUpdate] = await Promise.all([
    supabase.from('users').update({ role_type: roleType }).eq('id', userId),
    supabase.auth.updateUser({ data: { role } })
  ]);
  if (userUpdate.error) throw new Error(userUpdate.error.message);
  if (metadataUpdate.error) throw new Error(metadataUpdate.error.message);
  return role;
}

async function ensureBusinessUser(authUser: SupabaseUser): Promise<User> {
  const existing = await findBusinessUser(authUser.id);
  if (existing) return existing;

  const identity = getAuthIdentity(authUser);
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert(
      userToRow({
        authId: authUser.id,
        email: authUser.email ?? undefined,
        mobile: identity,
        nickname: getDefaultNickname(identity),
        avatarUrl: '',
        gender: 0,
        roleType: null,
        userStatus: UserStatus.Normal,
        registerSource: authUser.phone ? 'phone_otp' : 'email_password',
        lastLoginAt: now,
        isDeleted: false
      })
    )
    .select('*')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const retry = await findBusinessUser(authUser.id);
      if (retry) return retry;
    }
    throw new Error(insertError.message);
  }

  return mapUser(inserted);
}

async function findBusinessUser(authId: string): Promise<User | undefined> {
  const { data, error } = await supabase.from('users').select('*').eq('auth_id', authId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : undefined;
}

function buildLoginResponse(user: User, session: Session): LoginResponse {
  const selectedRole = getSelectedRole(user.roleType);
  return {
    token: {
      accessToken: session.access_token,
      tokenType: 'Bearer',
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : new Date(Date.now() + 3600_000).toISOString()
    },
    user,
    hasSelectedRole: Boolean(selectedRole),
    selectedRole
  };
}

function getSelectedRole(roleType?: RoleType): SelectedRole | undefined {
  if (roleType === RoleType.Walker) return 'walker';
  if (roleType === RoleType.Owner || roleType === RoleType.Dual) return 'owner';
  return undefined;
}

function getAuthIdentity(authUser: SupabaseUser): string {
  return authUser.phone || authUser.email || authUser.id;
}

function getDefaultNickname(identity: string): string {
  if (/^\+?86?1[3-9]\d{9}$/.test(identity)) return `用户${identity.slice(-4)}`;
  return identity.includes('@') ? identity.split('@')[0] || '用户' : '用户';
}
