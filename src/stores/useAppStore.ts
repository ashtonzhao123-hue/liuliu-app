import { create } from 'zustand';
import { getCurrentBusinessUser, loginWithCode as signInWithPassword, selectUserRole, signUpWithPassword } from '../api/auth';
import { supabase } from '../lib/supabase';
import { RoleType, type AuthToken, type LoginRequest, type SelectedRole, type User } from '../types';

export type RoleMode = SelectedRole;

interface PasswordRequest {
  email: string;
  password: string;
}

interface AppState {
  roleMode: RoleMode;
  token?: AuthToken;
  currentUser?: User;
  hasSelectedRole: boolean;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  hydrateAuth: () => Promise<void>;
  setRoleMode: (roleMode: RoleMode) => void;
  loginWithCode: (request: LoginRequest & Partial<PasswordRequest>) => Promise<{ nextPath: string }>;
  signUpWithPassword: (request: PasswordRequest) => Promise<void>;
  selectRole: (role: SelectedRole) => Promise<string>;
  logout: () => Promise<void>;
}

function getRolePath(role: SelectedRole): string {
  return role === 'walker' ? '/walker' : '/owner';
}

function getSelectedRole(user?: User): SelectedRole | undefined {
  if (!user) return undefined;
  if (user.roleType === RoleType.Walker) return 'walker';
  if (user.roleType === RoleType.Owner || user.roleType === RoleType.Dual) return 'owner';
  return undefined;
}

function getRoleType(role: SelectedRole): RoleType {
  return role === 'walker' ? RoleType.Walker : RoleType.Owner;
}

function applyUserState(user?: User, token?: AuthToken) {
  const selectedRole = getSelectedRole(user);
  return {
    token,
    currentUser: user,
    roleMode: selectedRole ?? 'owner',
    hasSelectedRole: Boolean(selectedRole),
    isAuthenticated: Boolean(user),
    isAuthReady: true
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  roleMode: 'owner',
  token: undefined,
  currentUser: undefined,
  hasSelectedRole: false,
  isAuthenticated: false,
  isAuthReady: false,
  hydrateAuth: async () => {
    try {
      const user = await getCurrentBusinessUser();
      const { data } = await supabase.auth.getSession();
      const token = data.session
        ? {
            accessToken: data.session.access_token,
            tokenType: 'Bearer' as const,
            expiresAt: data.session.expires_at
              ? new Date(data.session.expires_at * 1000).toISOString()
              : new Date(Date.now() + 3600_000).toISOString()
          }
        : undefined;
      set(applyUserState(user, token));
    } catch {
      set({ isAuthReady: true });
    }
  },
  setRoleMode: (roleMode) => set({ roleMode }),
  loginWithCode: async (request) => {
    const response = await signInWithPassword({
      email: request.email ?? request.mobile,
      password: request.password ?? request.code
    });
    const selectedRole = response.selectedRole;
    set(applyUserState(response.user, response.token));
    return { nextPath: selectedRole ? getRolePath(selectedRole) : '/role-select' };
  },
  signUpWithPassword: async (request) => {
    await signUpWithPassword(request);
    set({
      token: undefined,
      currentUser: undefined,
      roleMode: 'owner',
      hasSelectedRole: false,
      isAuthenticated: false,
      isAuthReady: true
    });
  },
  selectRole: async (role) => {
    const { currentUser } = get();
    if (!currentUser) throw new Error('请先登录');
    await selectUserRole(currentUser.id, role);
    const nextUser: User = { ...currentUser, roleType: getRoleType(role), updatedAt: new Date().toISOString() };
    set({ currentUser: nextUser, roleMode: role, hasSelectedRole: true, isAuthenticated: true });
    return getRolePath(role);
  },
  logout: async () => {
    await supabase.auth.signOut();
    set({
      token: undefined,
      currentUser: undefined,
      roleMode: 'owner',
      hasSelectedRole: false,
      isAuthenticated: false,
      isAuthReady: true
    });
  }
}));
