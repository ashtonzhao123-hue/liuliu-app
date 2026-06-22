# Active Walkers And Network Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show owners a privacy-safe count of recently active available walkers and provide a lightweight offline recovery banner.

**Architecture:** Supabase stores the last walker activity timestamp and exposes only an aggregate count through a locked-down `security definer` RPC. Frontend walker actions update activity without blocking their primary operation, while the owner home consumes the aggregate and the app shell owns browser network-state messaging.

**Tech Stack:** React 18, TypeScript, antd-mobile, Zustand, Supabase/Postgres, Vite.

---

### Task 1: Add The Activity Column And Aggregate RPC

**Files:**
- Create: `supabase/add-walker-active-at.sql`

- [ ] **Step 1: Create an idempotent migration**

```sql
alter table public.users
  add column if not exists walker_last_active_at timestamptz default null;

comment on column public.users.walker_last_active_at is
  'Walker last activity timestamp, updated on key walker actions.';

create or replace function public.get_active_walker_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.users u
  join public.walker_auth wa on wa.user_id = u.id
  where u.walker_last_active_at > now() - interval '15 minutes'
    and wa.walker_service_status = 1;
$$;

revoke all on function public.get_active_walker_count() from public;
revoke all on function public.get_active_walker_count() from anon;
grant execute on function public.get_active_walker_count() to authenticated;
```

- [ ] **Step 2: Verify the migration in Supabase SQL Editor**

Run the migration, then run:

```sql
select public.get_active_walker_count();
select has_function_privilege('authenticated', 'public.get_active_walker_count()', 'execute');
select has_function_privilege('anon', 'public.get_active_walker_count()', 'execute');
```

Expected: count is a non-negative integer, authenticated privilege is `true`, anon privilege is `false`.

- [ ] **Step 3: Commit the database migration**

```powershell
git add supabase/add-walker-active-at.sql
git commit -m "feat: add active walker count rpc"
```

### Task 2: Map Walker Activity And Expose Frontend APIs

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/mappers.ts`
- Modify: `src/api/owner.ts`
- Modify: `src/api/walker.ts`

- [ ] **Step 1: Extend the `User` type and mapper**

Add to `User`:

```ts
walkerLastActiveAt?: string;
```

Add to `mapUser`:

```ts
walkerLastActiveAt: row.walker_last_active_at ?? undefined,
```

Add to `userToRow`:

```ts
walker_last_active_at: user.walkerLastActiveAt,
```

`userToRow` uses `stripUndefined`, so partial user updates leave the database timestamp untouched instead of clearing it.

- [ ] **Step 2: Add the privacy-safe owner API**

Append to `src/api/owner.ts`:

```ts
export interface ActiveWalkerInfo {
  count: number;
  level: 'plenty' | 'few' | 'none';
}

export async function getActiveWalkerCount(): Promise<ActiveWalkerInfo> {
  const { data, error } = await supabase.rpc('get_active_walker_count');
  if (error) {
    console.warn('Failed to get active walker count', error);
    return { count: 0, level: 'none' };
  }
  const count = Number(data ?? 0);
  return { count, level: count >= 3 ? 'plenty' : count >= 1 ? 'few' : 'none' };
}
```

- [ ] **Step 3: Add a non-blocking walker activity helper**

Add to `src/api/walker.ts`:

```ts
export function markWalkerActive(walkerUserId: ID): void {
  void supabase
    .from('users')
    .update({ walker_last_active_at: new Date().toISOString() })
    .eq('id', walkerUserId)
    .then(({ error }) => {
      if (error) console.warn('Failed to update walker activity', error);
    });
}
```

Call it after local status persistence, after a successful accept, and after a successful finish. Preserve each function's existing return value and error behavior.

- [ ] **Step 4: Run the build to catch type mismatches**

Run: `npm.cmd run build`

Expected: exit code `0`; a chunk-size warning is acceptable.

- [ ] **Step 5: Commit the data-layer changes**

```powershell
git add src/types/index.ts src/api/mappers.ts src/api/owner.ts src/api/walker.ts
git commit -m "feat: track recent walker activity"
```

### Task 3: Show Supply Visibility On Owner Home

**Files:**
- Modify: `src/pages/owner/OwnerHomePage.tsx`
- Modify: `src/pages/walker/WalkerHomePage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Load the aggregate beside existing owner data**

Import `getActiveWalkerCount` and `ActiveWalkerInfo`. Add state initialized to `{ count: 0, level: 'none' }`, then include the RPC call in the existing `Promise.all` so one render updates pets, addresses, orders, and active walkers together.

- [ ] **Step 2: Render the availability message below the primary CTA**

```tsx
<div className={`active-walker-hint ${activeWalkers.level === 'none' ? 'active-walker-hint--none' : ''}`}>
  {activeWalkers.level !== 'none' ? <span className="active-dot" aria-hidden="true" /> : null}
  <span>{getActiveWalkerMessage(activeWalkers)}</span>
</div>
```

Use a local pure helper returning the three approved messages for `plenty`, `few`, and `none`.

- [ ] **Step 3: Mark opening Walker Home as activity**

Import `markWalkerActive` and call it once in the existing `currentUser` effect before loading orders and stats. Do not await it.

- [ ] **Step 4: Add scoped visual styles**

Add `.active-walker-hint`, `.active-walker-hint--none`, `.active-dot`, `@keyframes active-pulse`, and a `prefers-reduced-motion: reduce` override. Animate only `opacity` and `transform`.

- [ ] **Step 5: Run the build**

Run: `npm.cmd run build`

Expected: exit code `0`.

- [ ] **Step 6: Commit the supply UI**

```powershell
git add src/pages/owner/OwnerHomePage.tsx src/pages/walker/WalkerHomePage.tsx src/styles.css
git commit -m "feat: show recently active walkers"
```

### Task 4: Add The Network Banner And Error Copy

**Files:**
- Create: `src/components/NetworkBanner.tsx`
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create the browser network-state component**

```tsx
import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline) return null;
  return (
    <div className="network-banner" role="status" aria-live="polite">
      <span>网络跑丢了，检查一下 WiFi 或流量？</span>
      <button className="network-banner__retry" type="button" onClick={() => window.location.reload()}>
        重试
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Mount it inside the global boundary**

Import `NetworkBanner` in `src/App.tsx` and render it as the first child inside `ErrorBoundary`, before `Routes`.

- [ ] **Step 3: Update only the ErrorBoundary explanatory sentence**

Replace the existing paragraph with:

```tsx
<p>请刷新后再试一次。如果一直这样，可能是网络不太稳定，检查一下 WiFi 或流量。</p>
```

- [ ] **Step 4: Add banner styles**

Add `.network-banner` and `.network-banner__retry` using the approved silk-white and ochre palette. Give the retry button `min-height: 44px` and preserve text wrapping on narrow screens.

- [ ] **Step 5: Verify browser state transitions**

Open the local app, toggle browser DevTools Network to Offline, and verify the banner appears. Restore Online and verify it disappears. Click Retry while offline and verify a reload is attempted.

- [ ] **Step 6: Commit the fallback UI**

```powershell
git add src/components/NetworkBanner.tsx src/components/ErrorBoundary.tsx src/App.tsx src/styles.css
git commit -m "feat: add offline recovery banner"
```

### Task 5: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite complete with exit code `0`.

- [ ] **Step 2: Check patch hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional prompt/temp files remain untracked.

- [ ] **Step 3: Review requirement coverage**

Confirm the migration exists, RPC is privacy-safe, all four walker actions mark activity, the owner has three message states, offline recovery works, ErrorBoundary structure is unchanged, and no heartbeat/realtime/auto-retry code was introduced.
