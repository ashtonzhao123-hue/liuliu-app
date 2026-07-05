alter table public.walker_auth
  add column if not exists id_card_url text,
  add column if not exists student_card_url text;

comment on column public.walker_auth.id_card_url is
  '身份证照片URL或Supabase Storage路径，用于留痕存档';

comment on column public.walker_auth.student_card_url is
  '学生证照片URL或Supabase Storage路径，用于留痕存档';

create or replace function public.restrict_walker_auth_update()
returns trigger as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return new;
  end if;

  if new.walker_auth_status != old.walker_auth_status then
    raise exception '不能自行修改认证状态';
  end if;

  if new.walker_service_status != old.walker_service_status
    and not (
      new.walker_service_status = 1
      and new.student_card_url is not null
      and new.student_card_url <> ''
    )
  then
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
