export const STORAGE_KEYS = {
  authToken: 'liuliu.auth.token',
  currentUser: 'liuliu.auth.user',
  currentMobile: 'liuliu.auth.mobile',
  selectedRoles: 'liuliu.auth.selectedRoles',
  sentCodes: 'liuliu.auth.sentCodes'
} as const;

export function readJson<TValue>(key: string, fallback: TValue): TValue {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TValue) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<TValue>(key: string, value: TValue): void {
  localStorage.setItem(key, JSON.stringify(value));
}
