# 🎯 遛遛 (liuliu.app) — 攻击面深度审计

> 审计日期：2026-06-12
> 方法：白盒审计 — 结合前端代码 + Supabase RLS 策略逐条验证
> 攻击模型：已认证用户通过 Supabase REST API 直接调用（绕过前端代码）

---

## 审计范围

Supabase RLS 策略已覆盖全部 12 张业务表（[setup-liuliu-release.sql](supabase/setup-liuliu-release.sql) 第 73-84 行）。以下审计逐表验证 RLS 策略的完备性，并与前端 API 层的校验做交叉比对，寻找两层之间的 gap。

---

## 🔴 严重漏洞

### A-01: `orders` 表 UPDATE 策略无状态转换校验 — Walker 可重新打开已完成订单

**RLS 策略：** [setup-liuliu-release.sql:177-190](supabase/setup-liuliu-release.sql)
```sql
create policy "orders_update_participant_or_admin"
on public.orders for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid())
  or exists (select 1 from public.users u where u.id = orders.walker_id and u.auth_id = auth.uid())
)
with check (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.users u where u.id = orders.owner_id and u.auth_id = auth.uid())
    or exists (select 1 from public.users u where u.id = orders.walker_id and u.auth_id = auth.uid()))
  and (orders.walker_id is null or orders.owner_id <> orders.walker_id)
);
```

**问题：** `using` 和 `with check` 只验证了「调用者是否是该订单的 owner 或 walker」，**没有对新的 `order_status` 做任何合法性校验**。

**攻击方式（Walker 端）：**
```http
PATCH /rest/v1/orders?id=eq.<已完成的orderId>
Authorization: Bearer <walker的JWT>
Content-Type: application/json

{"order_status": 50, "start_time": "2026-06-12T00:00:00Z"}
```
Walker 可以将状态为 70 (Completed) 的已完成订单直接改回 50 (InService)。

**攻击链（完整利用）：**
1. Walker 正常接单 → 服务 → 主人确认完成 → 订单状态 = 70
2. Walker 调用 `finishWalkerService`（走 `walker.ts` 的 `updateOrder`，无状态检查）或直接 REST API
3. 订单回退到 PendingOwnerConfirm (60) → 主人重新确认 → 订单再次 Completed → Walker 可以**刷服务次数和收入**
4. 也可以再走一遍 Completed → InService → PendingOwnerConfirm → Completed 循环，无限刷评价和收入

**前端 gap：** `walker.ts:266-271` 的 `updateOrder` 函数没有状态机校验（与 owner 端 `updateOwnerOrder` 不同）：
```typescript
// walker.ts - NO status check!
async function updateOrder(orderId: ID, values: Record<string, any>): Promise<Order> {
  const { data, error } = await supabase.from('orders').update(values)
    .eq('id', orderId).select('*').single();
  // ...
}

// owner.ts - HAS status check ✅
async function updateOwnerOrder(userId: ID, id: ID, values: Record<string, any>): Promise<Order> {
  const terminalStatuses = [OrderStatus.Completed, OrderStatus.Cancelled];
  if (terminalStatuses.includes(current.order_status))
    throw new Error('已完成或已取消的订单不可再修改');
  // ...
}
```

**影响：** 刷单、刷评价、虚假收入统计。由于 `getWalkerStats` 按 Completed 状态统计收入，重复完成同一个订单会虚增收入数据。

---

### A-02: `reviews` 表 INSERT 策略无订单参与检查 — 任意用户可评价任意人

**RLS 策略：** [setup-liuliu-release.sql:235-241](supabase/setup-liuliu-release.sql)
```sql
create policy "reviews_insert_from_self"
on public.reviews for insert
with check (
  reviews.from_user_id <> reviews.to_user_id    -- ✅ 不能自评
  and exists (select 1 from public.users u
    where u.id = reviews.from_user_id and u.auth_id = auth.uid())  -- ✅ from_user 是自己
  -- ❌ 缺少：from_user 必须是该订单的 owner
  -- ❌ 缺少：订单必须是 Completed 状态
  -- ❌ 缺少：to_user 必须是该订单的 walker
);
```

**攻击方式：**
```http
POST /rest/v1/reviews
Authorization: Bearer <attacker的JWT>
Content-Type: application/json

{
  "order_id": "<任意orderId>",
  "from_user_id": "<attacker的userId>",
  "to_user_id": "<目标walker的userId>",
  "rating": 1,
  "punctual_score": 1,
  "attitude_score": 1,
  "pet_friendly_score": 1,
  "requirement_score": 1,
  "content": "恶意差评"
}
```

1. 攻击者可以给任意 walker 提交差评，不需要参与过该订单
2. 可以给同一个 orderId 提交多条评价
3. 可以给从未有过订单关系的 walker 评价

**前端 gap：** 前端 `submitReview` 有完整的校验（ownerUserId、Completed、walkerUserId），但 RLS 不提供兜底。

**影响：** 恶意刷差评攻击竞争对手。walker 的评分（`averageRating`）被任意操纵。

---

### A-03: `complaints` 表 INSERT 策略无订单关联检查 — 任意用户可发起投诉洪水

**RLS 策略：** [setup-liuliu-release.sql:207-212](supabase/setup-liuliu-release.sql)
```sql
create policy "complaints_insert_own"
on public.complaints for insert
with check (
  exists (select 1 from public.users u
    where u.id = complaints.complainant_user_id and u.auth_id = auth.uid())
  -- ❌ 只验证了 complainant 是自己
  -- ❌ 没有验证 complainant 是该订单的 owner 或 walker
);
```

**攻击方式：**
```http
POST /rest/v1/complaints
Authorization: Bearer <attacker的JWT>

{
  "order_id": "<任意orderId>",
  "complainant_user_id": "<attacker的userId>",
  "complaint_type": "其他",
  "content": "恶意投诉内容",
  "complaint_status": 0
}
```

1. 攻击者可对任意订单发起任意数量的投诉
2. 可淹没正常投诉，增加客服工作量（DoS）
3. 投诉的 `complaint_status` 可以直接设为 0 (Pending)，增加管理员处理负担

**影响：** 投诉洪水攻击，客服系统被淹没。

---

## 🟠 高危漏洞

### A-04: `orders` 表 INSERT 策略无关联数据合法性校验

**RLS 策略：** [setup-liuliu-release.sql:168-175](supabase/setup-liuliu-release.sql)
```sql
create policy "orders_insert_owner_or_admin"
on public.orders for insert
with check (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or exists (select 1 from public.users u
      where u.id = orders.owner_id and u.auth_id = auth.uid()))
  and (orders.walker_id is null or orders.owner_id <> orders.walker_id)
  -- ❌ 没有检查 pet_id 是否属于该 owner
  -- ❌ 没有检查 pet 是否已审核通过 (review_status = Approved)
  -- ❌ 没有检查 address_id 是否属于该 owner
  -- ❌ 没有检查 address 是否在服务范围内 (review_status = Valid)
  -- ❌ 没有检查 amount_total 等金额字段的合法性
);
```

**攻击方式：**
```http
POST /rest/v1/orders
Authorization: Bearer <attacker的JWT>

{
  "owner_id": "<attacker的userId>",
  "pet_id": "<别人未审核的petId>",
  "address_id": "<超出服务范围的addressId>",
  "amount_total": 0.01,
  "platform_commission": 0,
  "walker_income": 0.01,
  "order_status": 10,
  ...
}
```

1. 用未审核的宠物创建订单（绕过宠物审核流程）
2. 修改金额为任意值（0.01 元下单）
3. 超出服务范围的地址也能下单

**前端 gap：** `createOrder` 做了完整的 pet/address 校验，但 RLS 不兜底。

---

### A-05: `saveAddress` 和 `setDefaultAddress` 存在 TOCTOU 竞态

**文件：** [src/api/owner.ts:224-234](src/api/owner.ts) / [src/api/owner.ts:242-248](src/api/owner.ts)

```typescript
// saveAddress
if (input.isDefault) {
  await supabase.from('user_addresses').update({ is_default: 0 }).eq('user_id', userId);
  // ⚠️ 以下 insert/update 不是原子的
}
const query = id
  ? supabase.from('user_addresses').update(addressToRow(address)).eq('id', id)...
  : supabase.from('user_addresses').insert(addressToRow(address))...;

// setDefaultAddress
const clear = await supabase.from('user_addresses').update({ is_default: 0 }).eq('user_id', userId);
// ⚠️ 两个操作之间无事务
const setDefault = await supabase.from('user_addresses').update({ is_default: 1 }).eq('id', id)...;
```

**攻击方式：** 并发发送两个 `saveAddress` 请求，都带 `isDefault: 1`。由于 RLS 不限制 `is_default` 字段，两个操作可能交错执行，导致同一用户有多个 `is_default=1` 的地址。

**影响：** 数据不一致，可能导致订单关联了错误的默认地址。

---

## 🟡 中危漏洞

### A-06: PendingAccept 订单对全体已认证用户可见 — 地址快照泄露

**RLS 策略：** [setup-liuliu-release.sql:158-166](supabase/setup-liuliu-release.sql)
```sql
create policy "orders_select_participant_pending_or_admin"
on public.orders for select
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or (auth.uid() is not null and order_status = 10)    -- ← 任何已认证用户
  or exists (...owner...)                               -- owner
  or exists (...walker...)                              -- walker
);
```

**分析：** `order_status = 10` (PendingAccept) 的订单对**所有已认证用户**可见。这是接单大厅的功能需求，但同时暴露了：
- `address_snapshot` — 主人地址文本
- `pet_name_snapshot` — 宠物名
- `owner_nickname_snapshot` — 主人昵称
- `special_requirements` — 特殊要求

**攻击方式：** 注册账号 → 登录 → 轮询 `GET /rest/v1/orders?order_status=eq.10` → 获取所有待接单订单的地址快照列表。

**是否是问题：** 取决于业务判断。如果地址快照包含精确到门牌号的信息，则属于隐私泄露。

---

### A-07: Walker 端 `updateOrder` 无状态机校验

**文件：** [src/api/walker.ts:266-271](src/api/walker.ts)

```typescript
async function updateOrder(orderId: ID, values: Record<string, any>): Promise<Order> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.from('orders').update(values)
    .eq('id', orderId).select('*').single();
  if (error) throw new Error(error.message);
  return mapOrder(data);
}
```

与 owner 端不同，walker 端完全没有状态转换验证：
- 没有检查订单是否处于终态
- 没有验证新状态的合法性
- 没有阻止回退已完成/已取消的订单

这是 A-01 的前端实现侧对应问题。即使 RLS 修复了状态转换校验，前端也应该有一层防护。

---

### A-08: 用户可修改自己的 `walker_auth` 记录 — 自我提权风险

**RLS 策略：** [setup-liuliu-release.sql:346-356](supabase/setup-liuliu-release.sql)
```sql
create policy "walker_auth_update_own_or_admin"
on public.walker_auth for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u
    where u.id = walker_auth.user_id and u.auth_id = auth.uid())
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u
    where u.id = walker_auth.user_id and u.auth_id = auth.uid())
);
```

**问题：** 用户可以更新自己的 `walker_auth` 记录中的**任何字段**，包括：
- `walker_auth_status` — 可以把自己改成 Approved (2)
- `walker_service_status` — 可以把自己改成 Available (1)
- `walker_level` — 可以提升自己的等级
- `exam_score` — 可以改考试成绩

**攻击方式：**
```http
PATCH /rest/v1/walker_auth?user_id=eq.<attacker的userId>
Authorization: Bearer <attacker的JWT>

{"walker_auth_status": 2, "walker_service_status": 1}
```

即使没有通过审核，攻击者也可以将自己设为「已通过审核」状态。

**前端 gap：** 前端没有暴露 walker_auth 的自我编辑功能，但 RLS 允许。

**影响：** 绕过 walker 审核流程。

---

## 🔵 低风险项

### A-09: `users` 表无 DELETE 策略 = 默认拒绝

没有 DELETE 策略意味着没人能删除用户。应用程序使用 `is_deleted` 软删除，所以这是安全的。✅

### A-10: `walker_verification` UPDATE 策略允许用户改自己的审核状态

与 A-08 类似，用户可以通过 `walker_verification` 表修改自己的 `status` 字段为 `approved`。但该表似乎未被前端代码使用。

### A-11: Storage 策略只覆盖 `verification-images` bucket

[setup-liuliu-release.sql:406-441](supabase/setup-liuliu-release.sql)

只有 `verification-images` bucket 有 RLS 策略。如果将来添加其他 bucket（如 `order-photos`），需要记得配置策略。

---

## 📊 攻击面总览

| ID | 漏洞 | 层级 | 严重度 | 攻击前提 |
|----|------|------|--------|---------|
| **A-01** | orders UPDATE 无状态转换校验 | RLS | 🔴 严重 | 已认证 + 订单参与 (owner/walker) |
| **A-02** | reviews INSERT 无订单参与检查 | RLS | 🔴 严重 | 已认证 |
| **A-03** | complaints INSERT 无订单关联检查 | RLS | 🔴 严重 | 已认证 |
| **A-04** | orders INSERT 无关联数据合法性校验 | RLS | 🟠 高 | 已认证 |
| **A-05** | saveAddress/setDefaultAddress TOCTOU | 前端 | 🟠 高 | 已认证 + 并发请求 |
| **A-06** | PendingAccept 订单对全员可见 | RLS | 🟡 中 | 已认证 |
| **A-07** | walker updateOrder 无状态校验 | 前端 | 🟡 中 | 已认证 + walker 身份 |
| **A-08** | walker_auth 自我提权 | RLS | 🟡 中 | 已认证 |
| A-09~A-11 | 低风险项 | - | 🔵 低 | - |

---

## 🔧 修复方案

### A-01: orders UPDATE 增加 CHECK 约束（数据库级别）

```sql
-- 新增一个验证函数
create or replace function public.check_order_status_transition(
  old_status int,
  new_status int
) returns boolean as $$
begin
  -- 终态不可逆
  if old_status in (70, 80) and new_status not in (70, 80, 90) then
    return false;
  end if;
  -- 状态转换白名单...（按业务定义）
  return true;
end;
$$ language plpgsql immutable;

-- 在 orders 表上添加 CHECK 约束
alter table public.orders
  add constraint orders_status_transition_check
  check (check_order_status_transition(old_order_status, order_status));
```

> 注：PostgreSQL 的 CHECK 约束只能看到当前行，需要改用触发器来实现状态转换校验。

**实际方案：用触发器：**
```sql
create or replace function public.enforce_order_status_transition()
returns trigger as $$
begin
  if old.order_status in (70, 80) and new.order_status not in (70, 80, 90) then
    raise exception '不能修改已完成或已取消的订单状态';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger order_status_transition_trigger
  before update on public.orders
  for each row execute function public.enforce_order_status_transition();
```

### A-02: reviews INSERT 增加订单参与 + 订单状态校验

```sql
drop policy if exists "reviews_insert_from_self" on public.reviews;
create policy "reviews_insert_from_self"
on public.reviews for insert
with check (
  reviews.from_user_id <> reviews.to_user_id
  and exists (select 1 from public.users u
    where u.id = reviews.from_user_id and u.auth_id = auth.uid())
  -- 新增：from_user 必须是订单的 owner
  and exists (select 1 from public.orders o
    join public.users u on u.id = o.owner_id
    where o.id = reviews.order_id
      and u.auth_id = auth.uid()
      and o.order_status = 70)  -- 只有已完成订单才能评价
  -- 新增：to_user 必须是订单的 walker
  and exists (select 1 from public.orders o
    where o.id = reviews.order_id
      and o.walker_id = reviews.to_user_id)
);
```

### A-03: complaints INSERT 增加订单关联校验

```sql
drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own"
on public.complaints for insert
with check (
  exists (select 1 from public.users u
    where u.id = complaints.complainant_user_id and u.auth_id = auth.uid())
  -- 新增：投诉人必须是订单的 owner 或 walker
  and exists (
    select 1 from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = complaints.order_id
      and u.auth_id = auth.uid()
  )
);
```

### A-04: orders INSERT 增加关联数据校验（推荐用触发器）

```sql
create or replace function public.validate_order_insert()
returns trigger as $$
begin
  -- pet 必须属于 owner 且已通过审核
  if not exists (
    select 1 from public.pets
    where id = new.pet_id
      and user_id = new.owner_id
      and review_status = 2  -- Approved
      and risk_level = 1     -- A 级
      and is_deleted = false
  ) then
    raise exception '宠物未通过审核或不属于你';
  end if;
  -- address 必须属于 owner
  if not exists (
    select 1 from public.user_addresses
    where id = new.address_id
      and user_id = new.owner_id
      and is_deleted = false
  ) then
    raise exception '地址不存在或不属于你';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger validate_order_insert_trigger
  before insert on public.orders
  for each row execute function public.validate_order_insert();
```

### A-08: walker_auth UPDATE 限制用户可修改的字段

```sql
drop policy if exists "walker_auth_update_own_or_admin" on public.walker_auth;
create policy "walker_auth_update_own_or_admin"
on public.walker_auth for update
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from public.users u
    where u.id = walker_auth.user_id and u.auth_id = auth.uid())
)
with check (
  -- admin 可以改任何字段
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or (
    -- 普通用户只能改非敏感字段
    exists (select 1 from public.users u
      where u.id = walker_auth.user_id and u.auth_id = auth.uid())
    -- 用触发器来限制具体字段，或在这里加更多条件
  )
);
```

> 更简单的方案：用触发器阻止普通用户修改 `walker_auth_status`、`walker_service_status`、`walker_level`、`exam_score` 等敏感字段。

---

## 📋 RLS 策略对比矩阵

| 表 | SELECT | INSERT | UPDATE | DELETE | 安全评级 |
|----|--------|--------|--------|--------|---------|
| users | ✅ owner/admin | ✅ owner/admin | ✅ owner/admin | 默认拒绝 | ✅ 安全 |
| pets | ✅ owner/admin | ✅ owner/admin | ✅ owner/admin | 默认拒绝 | ✅ 安全 |
| user_addresses | ✅ owner/admin | ✅ owner/admin | ✅ owner/admin | 默认拒绝 | ✅ 安全 |
| **orders** | ✅ 参与者+公开 | ✅ owner/admin | ⚠️ 参与者可改任意状态 | 默认拒绝 | **⚠️ A-01** |
| **complaints** | ✅ 相关方可看 | ⚠️ 任意用户可创建 | ✅ admin only | 默认拒绝 | **⚠️ A-03** |
| **reviews** | ✅ 相关方可看 | ⚠️ 任意用户可创建 | 默认拒绝 | 默认拒绝 | **⚠️ A-02** |
| order_tracks | ✅ 参与者 | ✅ 指定walker | 默认拒绝 | 默认拒绝 | ✅ 安全 |
| order_checkpoints | ✅ 参与者 | ✅ 指定walker | 默认拒绝 | 默认拒绝 | ✅ 安全 |
| order_media | ✅ 参与者 | ✅ 参与者 | 默认拒绝 | 默认拒绝 | ✅ 安全 |
| **walker_auth** | ✅ 本人/admin | ✅ 本人/admin | ⚠️ 本人可改全部字段 | 默认拒绝 | **⚠️ A-08** |
| feedback | ✅ 本人/admin | ✅ 本人 | ✅ admin only | 默认拒绝 | ✅ 安全 |
| walker_verification | ✅ 本人/admin | ✅ 本人 | ✅ 本人/admin | 默认拒绝 | ⚠️ 用户可自改 status |

---

> 🤖 攻击面审计由 Claude Code 执行 — 方法：RLS 策略逐条 + 前端代码交叉验证
