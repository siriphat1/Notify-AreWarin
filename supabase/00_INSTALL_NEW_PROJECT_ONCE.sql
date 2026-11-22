-- AREWARIN TUTOR OS — ONE-TIME NEW PROJECT SETUP
-- TARGET PROJECT: ihmiqtwclnqrezsnswfz
-- 1) Create the teacher account first in Supabase Authentication > Users.
-- 2) Find v_owner_email below, replace the example with your real teacher email.
-- 3) Run ONCE on a NEW EMPTY project, not on the previously configured database.
-- 4) If the tables already exist in this target project, do NOT run this file.
--    Instead run only 02_ENABLE_APP_PASTE.sql after editing its owner email.
-- This script creates tables and grants the named authenticated teacher owner access.
-- This transaction rolls back if the owner email is not configured or not found.

begin;

-- AreWarin Tutor OS foundation; run in a NEW Supabase project.
create extension if not exists pgcrypto;
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table public.staff_members(organization_id uuid references public.organizations on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','admin','tutor')), primary key(organization_id,user_id));
create table public.students(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade, student_code text not null, full_name text not null, created_at timestamptz default now(), unique(organization_id,student_code),unique(id,organization_id));
create table public.courses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,name text not null,default_hours numeric(8,2) not null check(default_hours>0),price numeric(12,2) not null default 0 check(price>=0),unique(id,organization_id));
create table public.enrollments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,course_id uuid not null,purchased_hours numeric(8,2) not null check(purchased_hours>0),created_at timestamptz default now(),foreign key(student_id,organization_id) references public.students(id,organization_id),foreign key(course_id,organization_id) references public.courses(id,organization_id),unique(id,organization_id));
create table public.class_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,course_id uuid not null,topic text not null,starts_at timestamptz not null,ends_at timestamptz not null,meeting_url text, status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),check(ends_at>starts_at),foreign key(course_id,organization_id) references public.courses(id,organization_id),unique(id,organization_id));
create table public.attendance(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,enrollment_id uuid not null,session_id uuid not null,hours numeric(8,2) not null check(hours>=0),status text not null check(status in ('present','absent','excused')),created_by uuid references auth.users,created_at timestamptz default now(),foreign key(enrollment_id,organization_id) references public.enrollments(id,organization_id),foreign key(session_id,organization_id) references public.class_sessions(id,organization_id),unique(enrollment_id,session_id));
create table public.hour_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,enrollment_id uuid not null,delta_hours numeric(8,2) not null check(delta_hours<>0),reason text not null,attendance_id uuid references public.attendance,created_by uuid references auth.users,created_at timestamptz default now(),foreign key(enrollment_id,organization_id) references public.enrollments(id,organization_id));
create table public.leave_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,session_id uuid not null,reason text not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz default now(),foreign key(student_id,organization_id) references public.students(id,organization_id),foreign key(session_id,organization_id) references public.class_sessions(id,organization_id));
create table public.announcements(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,title text not null,body text not null,created_at timestamptz default now());
create table public.invoices(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,amount numeric(12,2) not null check(amount>=0),due_date date not null,status text not null default 'unpaid' check(status in ('unpaid','paid','void')),foreign key(student_id,organization_id) references public.students(id,organization_id));
create table public.line_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,line_user_id text not null,linked_at timestamptz default now(),foreign key(student_id,organization_id) references public.students(id,organization_id),unique(organization_id,student_id),unique(organization_id,line_user_id));
create table public.activation_codes(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,code_hash text not null unique,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz default now(),foreign key(student_id,organization_id) references public.students(id,organization_id));
create table public.notification_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,student_id uuid not null,session_id uuid,kind text not null,scheduled_at timestamptz not null,status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),attempts int not null default 0,provider_message_id text,created_at timestamptz default now(),foreign key(student_id,organization_id) references public.students(id,organization_id),foreign key(session_id,organization_id) references public.class_sessions(id,organization_id));
create unique index notification_session_once on public.notification_jobs(student_id,session_id,kind) where session_id is not null and status <> 'cancelled';
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations on delete cascade,actor_id uuid references auth.users,action text not null,record_type text not null,record_id uuid,created_at timestamptz default now());
-- Strict foundation: all tables RLS-enabled; only organization staff may read ordinary records.
-- Writes should be implemented through verified server endpoints with explicit role checks and atomic transactions.
do $$ declare t text; begin foreach t in array array['organizations','staff_members','students','courses','enrollments','class_sessions','attendance','hour_transactions','leave_requests','announcements','invoices','line_accounts','activation_codes','notification_jobs','audit_logs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create function public.is_org_staff(org uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.staff_members s where s.organization_id=org and s.user_id=(select auth.uid())) $$;
revoke all on function public.is_org_staff(uuid) from public;
grant execute on function public.is_org_staff(uuid) to authenticated;
create policy staff_read_org on public.organizations for select to authenticated using(public.is_org_staff(id));
do $$ declare t text; begin foreach t in array array['staff_members','students','courses','enrollments','class_sessions','attendance','hour_transactions','leave_requests','announcements','invoices','line_accounts','notification_jobs','audit_logs'] loop execute format('create policy staff_read on public.%I for select to authenticated using(public.is_org_staff(organization_id))',t); end loop; end $$;
-- activation_codes deliberately has no client read policy (hashed secret); backend only.
-- IMPORTANT: Attendance + hour_transactions MUST be written atomically with row locking in server code.
-- NEVER expose the Supabase service_role key to browser code.

-- AUTHORIZATION / OWNER SETUP
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

commit;
