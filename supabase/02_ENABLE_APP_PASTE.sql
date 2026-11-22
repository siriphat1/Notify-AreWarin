-- AreWarin Tutor OS: run AFTER the original schema.sql.
-- STEP 1: In Supabase Dashboard > Authentication > Users, create the teacher user first.
-- STEP 2: Replace ONLY the email below with that user's email.
-- STEP 3: Paste all this SQL in SQL Editor and click Run ONCE.
-- All data is accessible only to authenticated staff, scoped by organization.

alter table public.class_sessions add column if not exists cancel_reason text;

create or replace function public.is_org_manager(org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.organization_id = org
      and s.user_id = (select auth.uid())
      and s.role in ('owner','admin')
  )
$$;
revoke all on function public.is_org_manager(uuid) from public;
grant execute on function public.is_org_manager(uuid) to authenticated;

do $$
declare t text;
begin
  -- Only owners/admins can modify ordinary operational tables.
  foreach t in array array[
    'students','courses','enrollments','class_sessions','leave_requests','announcements','invoices'
  ] loop
    execute format('drop policy if exists manager_insert on public.%I',t);
    execute format('drop policy if exists manager_update on public.%I',t);
    execute format('create policy manager_insert on public.%I for insert to authenticated with check (public.is_org_manager(organization_id))',t);
    execute format('create policy manager_update on public.%I for update to authenticated using (public.is_org_manager(organization_id)) with check (public.is_org_manager(organization_id))',t);
  end loop;
end $$;

-- Never create browser-write policies for hour_transactions, attendance,
-- activation_codes, line_accounts or notification_jobs.
-- Attendance is saved with a secured atomic RPC below.
create or replace function public.record_class_attendance(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_status text,
  p_hours numeric default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
  s record;
  old_hours numeric := 0;
  new_hours numeric := 0;
  signed_adjustment numeric;
  current_balance numeric;
  existing_id uuid;
  saved_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  if p_status not in ('present','absent','excused') then raise exception 'Invalid attendance status'; end if;

  select * into e from public.enrollments where id=p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;
  if not public.is_org_manager(e.organization_id) then raise exception 'Permission denied'; end if;

  select * into s from public.class_sessions where id=p_session_id and organization_id=e.organization_id;
  if not found or s.course_id<>e.course_id then raise exception 'Session and enrollment do not match'; end if;
  if s.status='cancelled' then raise exception 'Cannot record cancelled session'; end if;

  if p_status='present' then
    new_hours := coalesce(p_hours, round((extract(epoch from (s.ends_at-s.starts_at))/3600)::numeric,2));
  else
    new_hours := 0;
  end if;
  if new_hours<0 or new_hours>round((extract(epoch from (s.ends_at-s.starts_at))/3600)::numeric,2) then
    raise exception 'Hours out of session range';
  end if;

  select a.id,a.hours into existing_id,old_hours
  from public.attendance a
  where a.enrollment_id=p_enrollment_id and a.session_id=p_session_id;
  old_hours := coalesce(old_hours,0);
  signed_adjustment := old_hours - new_hours;

  select e.purchased_hours + coalesce((select sum(h.delta_hours) from public.hour_transactions h where h.enrollment_id=e.id),0)
    into current_balance;

  if current_balance + signed_adjustment < 0 then
    raise exception 'Insufficient hours (remaining: %)', current_balance;
  end if;

  if existing_id is null then
    insert into public.attendance(organization_id,enrollment_id,session_id,hours,status,created_by)
    values(e.organization_id,p_enrollment_id,p_session_id,new_hours,p_status,(select auth.uid()))
    returning id into saved_id;
  else
    update public.attendance
    set hours=new_hours,status=p_status,created_by=(select auth.uid())
    where id=existing_id;
    saved_id := existing_id;
  end if;

  if signed_adjustment <> 0 then
    insert into public.hour_transactions(organization_id,enrollment_id,delta_hours,reason,attendance_id,created_by)
    values(e.organization_id,p_enrollment_id,signed_adjustment,'Attendance adjustment',saved_id,(select auth.uid()));
  end if;
  return jsonb_build_object('attendance_id',saved_id,'remaining_hours',current_balance+signed_adjustment);
end;
$$;
revoke all on function public.record_class_attendance(uuid,uuid,text,numeric) from public;
grant execute on function public.record_class_attendance(uuid,uuid,text,numeric) to authenticated;

-- Set up only the named, existing Auth user as owner. NO public owner-claim endpoint.
do $$
declare
  v_owner_email text := 'REPLACE_WITH_YOUR_EMAIL@example.com';  -- << REPLACE THIS LINE'S EMAIL
  v_owner_id uuid;
  v_org_id uuid;
begin
  if v_owner_email = 'REPLACE_WITH_YOUR_EMAIL@example.com' then
    raise exception 'Please replace REPLACE_WITH_YOUR_EMAIL@example.com with the email of your teacher account';
  end if;
  select id into v_owner_id from auth.users where lower(email) = lower(trim(v_owner_email)) limit 1;
  if v_owner_id is null then
    raise exception 'Teacher account not found. Create it in Authentication > Users first.';
  end if;
  select id into v_org_id from public.organizations where name='AreWarin Tutor' order by created_at limit 1;
  if v_org_id is null then
    insert into public.organizations(name) values ('AreWarin Tutor') returning id into v_org_id;
  end if;
  insert into public.staff_members(organization_id,user_id,role)
  values(v_org_id,v_owner_id,'owner')
  on conflict(organization_id,user_id) do update set role='owner';
  raise notice 'Owner assigned to AreWarin Tutor successfully.';
end $$;
