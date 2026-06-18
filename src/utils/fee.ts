export function getPlatformFeeRate(): number {
  const raw = import.meta.env.VITE_PLATFORM_FEE_RATE;
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;

  return Math.min(Math.max(value, 0), 1);
}
