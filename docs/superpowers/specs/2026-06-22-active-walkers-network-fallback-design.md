# 遛遛活跃供给与网络兜底设计

## 目标

以较低复杂度提升主人对附近服务供给的感知，并在浏览器断网或页面崩溃时给出明确恢复入口。不引入心跳、Realtime、轮询、请求拦截器或自动重试。

## 活跃遛遛侠统计

### 数据模型

在 `public.users` 增加可空字段 `walker_last_active_at timestamptz`，记录遛遛侠最近一次关键操作时间。

关键操作包括：

- 打开遛遛侠首页。
- 切换在线状态。
- 接受订单。
- 提交完单报告。

更新时间是附属行为。更新失败时仅记录警告，不阻塞在线切换、接单、完单和页面加载。

### 安全统计 RPC

新增 `public.get_active_walker_count()` RPC：

- 使用 `security definer` 并固定 `search_path = public`。
- 关联 `public.users` 与 `public.walker_auth`。
- 仅统计 `walker_last_active_at` 在最近 15 分钟内且 `walker_service_status = 1` 的用户。
- 只返回一个整数，不返回用户 ID、昵称或其他资料。
- 撤销 public/anon 执行权限，仅授权 `authenticated`。

采用 RPC 是因为现有 `users` 与 `walker_auth` RLS 只允许用户读取自己的记录，主人端不能安全地直接统计其他遛遛侠。

### 前端 API 与展示

`getActiveWalkerCount()` 调用 RPC，并转换为：

- `plenty`：3 人及以上。
- `few`：1 至 2 人。
- `none`：0 人或查询失败。

主人首页与宠物、地址、订单数据并行加载统计结果。在“找人遛”CTA 下显示对应文案。查询失败静默回退到 `none`，不弹 Toast，不阻塞首页。

## 网络断开兜底

新增 `NetworkBanner`：

- 初始状态读取 `navigator.onLine`。
- 监听 `online` 与 `offline` 事件。
- 断网时在 `ErrorBoundary` 内、路由外显示绢白色提示条。
- 提供手动“重试”按钮，调用 `window.location.reload()`。
- 网络恢复后自动隐藏。

不拦截 fetch，不自动重试，不修改 Supabase 客户端行为。

## ErrorBoundary

保留现有类组件结构、错误捕获和刷新按钮，仅将说明文案补充为可能存在网络不稳定，并提示检查 WiFi 或流量。

## 视觉与动效

- 活跃提示使用墨灰正文和青碧状态点。
- 状态点只动画 `opacity` 与 `transform`，周期 2 秒，并尊重 `prefers-reduced-motion`。
- 断网提示条使用绢白背景与赭石文字，重试按钮触摸目标至少 44px。
- 不使用 emoji 作为网络图标，保持现有宋式视觉语言简洁克制。

## 文件范围

- 新增 `supabase/add-walker-active-at.sql`。
- 修改 `src/types/index.ts`、`src/api/mappers.ts`。
- 修改 `src/api/walker.ts`，增加非阻塞活跃时间更新 helper 并接入关键操作。
- 修改 `src/api/owner.ts`，增加 RPC 查询封装。
- 修改 `src/pages/owner/OwnerHomePage.tsx` 与 `src/pages/walker/WalkerHomePage.tsx`。
- 新增 `src/components/NetworkBanner.tsx`。
- 修改 `src/components/ErrorBoundary.tsx`、`src/App.tsx`、`src/styles.css`。

不实现此前尚未落地的角色引导和 PWA 安装提示方案。

## 验证

- SQL 可重复执行，RPC 权限正确且只返回计数。
- 四类遛遛侠关键操作触发活跃时间更新，更新失败不影响主流程。
- 主人首页正确显示 `plenty`、`few`、`none` 三种状态。
- 网络断开/恢复时提示条显示与隐藏正确，重试按钮可用。
- ErrorBoundary 仅改变文案。
- `npm.cmd run build` 通过。

