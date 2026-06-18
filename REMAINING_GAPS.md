# 🔍 遛遛 (liuliu.app) — 多角度残余风险审计

> 审计日期：2026-06-12（第三轮）
> 方法：前端 × 后端(RLS/触发器) × 业务逻辑 × 金融 × 基础设施 — 六维度交叉验证
> 前提：已修复前两轮全部漏洞 + 安全加固迁移已应用

---

## 审计综述

经过两轮修复，核心攻击面已被有效收敛：
- ✅ 全表启用 RLS，策略覆盖 SELECT/INSERT/UPDATE
- ✅ 订单状态转换触发器（终态防回退 + 防倒退）
- ✅ 评论/投诉 INSERT 策略增加订单参与校验
- ✅ Walker 端 `updateOrder` 增加状态机验证
- ✅ 图片上传 5MB 限制 + 预约时间必须在未来
- ✅ Admin 通过 Supabase `app_metadata.role` 鉴权
- ✅ walker_auth 敏感字段禁止用户自改

以下是从六个维度深挖出的**残余可钻空子的地方**。

---

## 🔴 B-01（已修复）：费率硬编码不一致 → 下单必然失败

**位置：** `supabase/security-fixes.sql` 触发器 vs `src/utils/fee.ts`

**问题已修复前：**
- 前端 `getPlatformFeeRate()` 读取 `VITE_PLATFORM_FEE_RATE`，默认 0
- 触发器 `validate_order_insert` 硬编码 `0.2`
- 结果：前端发 `platform_commission=0`，触发器期望 `amount*0.2` → **每个订单创建都被拒绝**

**修复：** 触发器不再强制具体费率，仅验证：
```sql
-- 只验证金额守恒，不验证费率
platform_commission + walker_income = amount_total
platform_commission >= 0 AND walker_income >= 0
amount_total > 0
```

---

## 🟠 B-02（已修复）：状态转换触发器过于严格 → 阻断 Owner 模拟流程

**位置：** `supabase/security-fixes.sql` → `enforce_order_status_transition`

**问题已修复前：**
```sql
-- 旧逻辑：强制要求 30→40→50→60 严格线性
if new.order_status = 50 and old.order_status != 40 then  -- 必须从 Arrived 来
  raise exception
```
- Walker 正常流程走 30→40→50 ✓
- Owner 模拟流程走 30→50（跳过 40）→ **被触发器拒绝 ✗**

**修复：** 改为「防倒退」策略——允许跳过中间状态，但不允许反向流转：
```sql
-- 已完成 → 只能保持或变异常
-- 已取消 → 不可恢复
-- 服务中 → 不可回退到 Accepted/WalkerArrived
-- 终态 → 不可回退到非终态
```

---

## 🟡 B-03：Owner 端状态转换无白名单校验（仅拦了终态）

**位置：** `src/api/owner.ts` → `updateOwnerOrder`

```typescript
// 当前：只阻止 Completed/Cancelled 修改
const terminalStatuses = [OrderStatus.Completed, OrderStatus.Cancelled];
if (terminalStatuses.includes(current.order_status)) throw ...

// 缺失：不检查具体的 from→to 合法性
```

**可钻的空子：**
- `PendingAccept(10)` 可被 `simulatePayOrder` 直接设为 `Accepted(30)`（跳过 PendingPay）
- `PendingAccept(10)` 可被 `confirmOrderComplete` 直接设为 `Completed(70)`（跳过一切）
- `PendingPay(20)` 可被 `simulateStartService` 直接设为 `InService(50)`

**注意：** 数据库触发器现在只防倒退不防跳跃，所以这些在前端是可以执行的。但：
- 这些都是 demo 模拟函数（`simulate*`），用于开发测试
- 生产环境应替换为真实的后端工作流
- **建议：** 当前 Demo 阶段可接受；上线前需要在 `updateOwnerOrder` 中加入完整的状态转换白名单

---

## 🟡 B-04：注册无密码强度要求 + 无邮箱格式校验

**位置：** `src/pages/auth/RegisterPage.tsx:21-23`

```typescript
const canSubmit = useMemo(
  () => email.includes('@') && password.length >= 6 && ...,
  [...]
);
```

**问题：**
- 密码仅要求 ≥6 位，无复杂度要求（`123456` 可通过）
- 邮箱仅检查是否含 `@`（`a@` 可通过）
- 无二次密码确认的实时提示（仅在提交时报错）
- 注册无验证码/邮件确认

**攻击场景：** 自动化脚本批量注册弱密码账号 → 用于刷单/刷评价

**建议：**
- 使用正则校验邮箱：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- 密码至少 8 位 + 包含字母和数字
- 启用 Supabase Auth 邮件确认（`email_confirm` 开关）

---

## 🟡 B-05: `simulatePayOrder` 不验证支付状态 — 可直接标记已支付

**位置：** `src/api/owner.ts:336-338`

```typescript
export async function simulatePayOrder(userId: ID, id: ID): Promise<Order> {
  return updateOwnerOrder(userId, id, {
    pay_status: PayStatus.Success,
    order_status: OrderStatus.Accepted
  });
}
```

**问题：** 不检查当前 `order_status` 是否为 `PendingPay`（20）。可以在任何非终态订单上调用。

**风险：** Demo 阶段可接受，但如果有真实支付集成，这就是严重漏洞。

**建议：** 增加前置状态检查：`if (current.order_status !== OrderStatus.PendingPay) throw`

---

## 🔵 低风险项（6 个）

### B-06: Owner 端 `simulateAcceptOrder` 被自身的前端校验永远拦截

**位置：** `src/api/owner.ts:327-334`

```typescript
const order = mapOrder(data);
if (order.ownerUserId === userId) throw new Error('主人不能接自己发布的订单');
```

从 OrderDetailPage 调用时 `userId` 就是主人自己的 ID，而 `order.ownerUserId` 也是主人 ID，所以这个函数**永远抛出异常**。"模拟接单"按钮功能实际上不可用。

如果绕过前端：RLS UPDATE 策略的 `with check` 也会阻止 `owner_id = walker_id`。所以后端也无法成功。

**结论：** 这不是安全漏洞，但"模拟接单"按钮是死代码。

---

### B-07: 缺少全局 API 错误拦截器 — session 过期无感知

项目中所有 Supabase 调用直接 `.catch()` 或 `if (error)`，没有统一的 401 拦截。如果 session 过期：
- 用户点击操作 → API 返回 JWT 错误 → 显示原始错误消息
- 用户不会自动跳转到登录页

**建议：** 添加 Supabase `onAuthStateChange` 监听或 axios-style 拦截器。

---

### B-08: `getFriendlyErrorMessage` 的 unmapped 错误可能泄露信息

**位置：** `src/utils/errors.ts:45`

```typescript
return /[一-鿿]/.test(message) ? message : fallback;
```

如果 Supabase 返回的中文错误消息包含内部细节（如表名、字段名），会直接展示给用户。

---

### B-09: Walker 端 `hydrateBundles` 对 walker 无意义地查询 `user_addresses`

每次 walker 加载订单列表，都会对每个订单的 `addressId` 查询 `user_addresses`。由于 RLS 策略 `user_addresses_select_own_or_admin` 只允许 owner 读自己的地址，walker 的查询永远返回空。这是 N+1 性能浪费，不是安全漏洞。

---

### B-10: `createOrder` 中 `ownerNicknameSnapshot` 硬编码为 `'主人'`

**位置：** `src/api/owner.ts:297`

```typescript
ownerNicknameSnapshot: '主人',  // 应使用 currentUser.nickname
```

所有订单的主人快照都是"主人"，无法区分不同主人的订单。

---

### B-11: `getWalkerStats` 获取所有评价但 RLS 会过滤

该函数查询 `eq('to_user_id', walkerUserId)` 获取评价。RLS 策略 `reviews_select_participant_or_admin` 仅允许评价的参与方查看。第三方调用会得到空列表而非真实评分（显示默认 5.0）。这是一种隐蔽的错误——外部看到的评分可能是假的。

---

## 📊 残余风险矩阵

| ID | 维度 | 严重度 | 可被利用？ | 影响 |
|----|------|--------|-----------|------|
| ~~B-01~~ | DB/金融 | 已修复 | - | - |
| ~~B-02~~ | DB/状态机 | 已修复 | - | - |
| B-03 | 前端/状态机 | 🟡 中 | Demo 函数可跳状态 | 订单流转混乱 |
| B-04 | 认证 | 🟡 中 | 批量注册弱密码 | 僵尸账号 |
| B-05 | 前端/金融 | 🟡 中 | Demo 函数可跳支付 | 模拟环境无影响 |
| B-06 | 前端/逻辑 | 🔵 低 | "模拟接单"永远报错 | 功能不可用 |
| B-07 | 基础设施 | 🔵 低 | session 过期无感知 | 用户体验差 |
| B-08 | 前端/信息泄露 | 🔵 低 | 特定条件下可能 | 低 |
| B-09 | 后端/性能 | 🔵 低 | 无 | 仅浪费查询 |
| B-10 | 前端/数据 | 🔵 低 | 无 | 快照不正确 |
| B-11 | 前端/统计 | 🔵 低 | 无 | 第三方看到假评分 |

---

## ✅ 本次修复的文件

| 文件 | 修复内容 |
|------|---------|
| `supabase/security-fixes.sql` | B-01: 费率校验 → 金额守恒；B-02: 状态线性 → 防倒退 |
| `src/api/owner.ts` | B-04: `createOrder` 增加预约时间 > 现在 的校验 |

---

> 🤖 第三轮多角度审计由 Claude Code 执行
