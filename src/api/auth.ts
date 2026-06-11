import type { Session } from '@supabase/supabase-js';
import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import { RoleType, UserStatus, type LoginResponse, type SelectedRole, type User } from '../types';
import { mapUser, userToRow } from './mappers';

export interface PasswordAuthRequest {
  email: string;
  password: string;
}

export function isValidMobile(mobile: string): boolean {
  return /^1[3-9]\d{9}$/.test(mobile);
}

export async function sendLoginCode(): Promise<{ expiresInSeconds: number }> {
  throw new Error('已切换为邮箱密码登录，无需发送验证码');
}

export async function loginWithCode({ email, password }: PasswordAuthRequest): Promise<LoginResponse> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('登录失败');
  const user = await ensureBusinessUser(data.user.id, email);
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
  if (!authUser?.id || !authUser.email) return undefined;
  return ensureBusinessUser(authUser.id, authUser.email);
}

export async function selectUserRole(userId: string, role: SelectedRole): Promise<SelectedRole> {
  assertSupabaseConfigured();
  const roleType = role === 'walker' ? RoleType.Walker : RoleType.Owner;
  const { error } = await supabase.from('users').update({ role_type: roleType }).eq('id', userId);
  if (error) throw new Error(error.message);
  return role;
}

async function ensureBusinessUser(authId: string, email: string): Promise<User> {
  const { data: existing, error: selectError } = await supabase.from('users').select('*').eq('auth_id', authId).maybeSingle();
  if (selectError) throw new Error(selectError.message);
  if (existing) return mapUser(existing);

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert(
      userToRow({
        authId,
        email,
        mobile: email,
        nickname: email.split('@')[0] || '用户',
        avatarUrl: '',
        gender: 0,
        userStatus: UserStatus.Normal,
        registerSource: 'pwa',
        lastLoginAt: now,
        isDeleted: false
      })
    )
    .select('*')
    .single();
  if (insertError) throw new Error(insertError.message);
  return mapUser(inserted);
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
