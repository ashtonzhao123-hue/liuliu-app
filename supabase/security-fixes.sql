-- ============================================================================
-- 遛遛 (liuliu.app) — 安全加固迁移
-- 对应漏洞: A-01, A-02, A-03, A-04, A-05, A-08
-- 运行方式: 在 Supabase SQL Editor 中执行
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A-01: 订单状态转换触发器 — 阻止终态回退 + 防倒退
-- 注意: 不强制 30→40→50→60 严格线性，因 owner 端模拟流程会跳过部分状态
-- ----------------------------------------------------------------------------
create or replace function public.enforce_order_status_transition()
returns trigger as $$
declare
  terminal_statuses constant int[] := array[70, 80];  -- Completed, Cancelled
  -- 正向状态流：后面的状态号必须 >= 前面的（除非回退到终态）
  ordered_statuses constant int[] := array[10, 20, 30, 40, 50, 60, 70, 80, 90];
begin
  -- 终态不可回退到非终态（管理员标记 ExceptionHandling 除外）
  if old.order_status = any(terminal_statuses) then
    if new.order_status not in (70, 80, 90) then
      raise exception '已完成或已取消的订单不可再修改状态';
    end if;
  end if;

  -- 已取消(80)不可改为任何其他状态
  if old.order_status = 80 and new.order_status != 80 then
    raise exception '已取消的订单不可恢复';
  end if;

  -- 已完成(70)只能改为异常处理(90)
  if old.order_status = 70 and new.order_status not in (70, 90) then
    raise exception '已完成的订单不可回退';
  end if;

  -- 防止服务中(50)回退到更早状态（若从50来，只能去60/70/80/90）
  if old.order_status = 50 and new.order_status not in (50, 60, 70, 80, 90) then
    raise exception '服务中的订单不可回退到之前的状态';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists order_status_transition_trigger on public.orders;
create trigger order_status_transition_trigger
  before update of order_status on public.orders
  for each row
  when (pg_trigger_depth() < 1)
  execute function public.enforce_order_status_transition();


-- ----------------------------------------------------------------------------
-- A-02: reviews INSERT 策略 — 增加订单参与 + 完成状态校验
-- ----------------------------------------------------------------------------
drop policy if exists "reviews_insert_from_self" on public.reviews;
create policy "reviews_insert_from_self"
on public.reviews for insert
with check (
  reviews.from_user_id <> reviews.to_user_id
  -- from_user 必须是自己
  and exists (
    select 1 from public.users u
    where u.id = reviews.from_user_id and u.auth_id = auth.uid()
  )
  -- from_user 必须是该订单的 owner
  and exists (
    select 1 from public.orders o
    join public.users u on u.id = o.owner_id
    where o.id = reviews.order_id
      and u.auth_id = auth.uid()
  )
  -- to_user 必须是该订单的 walker
  and exists (
    select 1 from public.orders o
    where o.id = reviews.order_id
      and o.walker_id = reviews.to_user_id
  )
  -- 订单必须是已完成状态
  and exists (
    select 1 from public.orders o
    where o.id = reviews.order_id
      and o.order_status = 70
  )
  -- 同一订单同一用户只能评价一次
  and not exists (
    select 1 from public.reviews r
    where r.order_id = reviews.order_id
      and r.from_user_id = reviews.from_user_id
  )
);


-- ----------------------------------------------------------------------------
-- A-03: complaints INSERT 策略 — 增加订单关联校验
-- ----------------------------------------------------------------------------
drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own"
on public.complaints for insert
with check (
  -- 投诉人必须是自己
  exists (
    select 1 from public.users u
    where u.id = complaints.complainant_user_id and u.auth_id = auth.uid()
  )
  -- 投诉人必须是该订单的 owner 或 walker
  and exists (
    select 1 from public.orders o
    join public.users u on u.id in (o.owner_id, o.walker_id)
    where o.id = complaints.order_id
      and u.auth_id = auth.uid()
  )
);


-- ----------------------------------------------------------------------------
-- A-04: orders INSERT 触发器 — 关联数据合法性校验
-- ----------------------------------------------------------------------------
create or replace function public.validate_order_insert()
returns trigger as $$
begin
  -- pet 必须存在、属于 owner、已审核通过、风险等级为 A
  if not exists (
    select 1 from public.pets
    where id = new.pet_id
      and user_id = new.owner_id
      and review_status = 2   -- Approved
      and risk_level = 1      -- A 级
      and is_deleted = false
  ) then
    raise exception '宠物未通过审核或不属于你，无法创建订单';
  end if;

  -- address 必须存在且属于 owner
  if not exists (
    select 1 from public.user_addresses
    where id = new.address_id
      and user_id = new.owner_id
      and is_deleted = false
  ) then
    raise exception '地址不存在或不属于你，无法创建订单';
  end if;

  -- 金额必须为正数
  if new.amount_total <= 0 then
    raise exception '订单金额必须大于0';
  end if;

  -- platform_commission + walker_income 必须等于 amount_total（防篡改）
  -- 不强制具体费率，由业务层配置
  if new.platform_commission + new.walker_income != new.amount_total then
    raise exception '平台佣金与服务者收入之和必须等于订单总额';
  end if;

  -- 佣金和收入必须为非负数
  if new.platform_commission < 0 or new.walker_income < 0 then
    raise exception '佣金和收入不能为负数';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists validate_order_insert_trigger on public.orders;
create trigger validate_order_insert_trigger
  before insert on public.orders
  for each row
  execute function public.validate_order_insert();


-- ----------------------------------------------------------------------------
-- A-05: 默认地址原子设置函数 — 解决 TOCTOU 竞态
-- ----------------------------------------------------------------------------
create or replace function public.set_default_address(
  p_user_id uuid,
  p_address_id uuid
) returns void as $$
begin
  -- 在单个事务中原子完成 "清除旧默认 + 设置新默认"
  update public.user_addresses
    set is_default = 0
    where user_id = p_user_id and is_default = 1;

  update public.user_addresses
    set is_default = 1
    where id = p_address_id and user_id = p_user_id;

  if not found then
    raise exception '地址不存在或不属于你';
  end if;
end;
$$ language plpgsql security definer;


-- ----------------------------------------------------------------------------
-- A-08: walker_auth UPDATE 触发器 — 阻止普通用户修改敏感字段
-- ----------------------------------------------------------------------------
create or replace function public.restrict_walker_auth_update()
returns trigger as $$
begin
  -- admin 可以改任意字段
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return new;
  end if;

  -- 普通用户不能修改以下敏感字段
  if new.walker_auth_status != old.walker_auth_status then
    raise exception '不能自行修改认证状态';
  end if;
  if new.walker_service_status != old.walker_service_status then
    raise exception '不能自行修改服务状态';
  end if;
  if new.walker_level != old.walker_level then
    raise exception '不能自行修改服务等级';
  end if;
  if new.exam_status != old.exam_status then
    raise exception '不能自行修改考试状态';
  end if;
  if new.exam_score is distinct from old.exam_score then
    raise exception '不能自行修改考试成绩';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists restrict_walker_auth_update_trigger on public.walker_auth;
create trigger restrict_walker_auth_update_trigger
  before update on public.walker_auth
  for each row
  execute function public.restrict_walker_auth_update();


-- ----------------------------------------------------------------------------
-- walker_verification UPDATE 触发器 — 同样阻止用户修改审核状态
-- ----------------------------------------------------------------------------
create or replace function public.restrict_walker_verification_update()
returns trigger as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return new;
  end if;

  if new.status != old.status then
    raise exception '不能自行修改认证状态';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists restrict_walker_verification_update_trigger on public.walker_verification;
create trigger restrict_walker_verification_update_trigger
  before update on public.walker_verification
  for each row
  execute function public.restrict_walker_verification_update();
