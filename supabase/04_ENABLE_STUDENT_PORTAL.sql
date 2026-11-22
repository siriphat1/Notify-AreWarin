-- AreWarin Tutor OS v2.6 — Student Portal (run AFTER 01, 02, 03)
-- Does not delete data or alter non-awt tables. Paste WHOLE file, then Run.
begin;

create table if not exists public.awt_student_accounts (
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid not null references public.awt_organizations(id) on delete cascade,
 student_id uuid not null unique,
 linked_at timestamptz not null default now(),
 foreign key (student_id, organization_id) references public.awt_students(id, organization_id)
);
create table if not exists public.awt_course_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.awt_organizations(id) on delete cascade,
 student_id uuid not null,
 enrollment_id uuid not null,
 request_type text not null check (request_type in ('renew','end')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 foreign key (student_id, organization_id) references public.awt_students(id, organization_id),
 foreign key (enrollment_id, organization_id) references public.awt_enrollments(id, organization_id)
);
create unique index if not exists awt_one_pending_course_request on public.awt_course_requests(enrollment_id) where status='pending';
alter table public.awt_student_accounts enable row level security;
alter table public.awt_course_requests enable row level security;

create or replace function public.awt_is_own_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $s$
 select exists(select 1 from public.awt_student_accounts a
 where a.auth_user_id=(select auth.uid()) and a.student_id=p_student_id);
$s$;
create or replace function public.awt_is_org_student(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $s$
 select exists(select 1 from public.awt_student_accounts a
 where a.auth_user_id=(select auth.uid()) and a.organization_id=p_org);
$s$;
create or replace function public.awt_has_course(p_course_id uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $s$
 select exists(select 1 from public.awt_enrollments e
 join public.awt_student_accounts a on a.student_id=e.student_id and a.organization_id=e.organization_id
 where a.auth_user_id=(select auth.uid()) and e.course_id=p_course_id and e.organization_id=p_org);
$s$;
revoke all on function public.awt_is_own_student(uuid), public.awt_is_org_student(uuid), public.awt_has_course(uuid,uuid) from public;
grant execute on function public.awt_is_own_student(uuid), public.awt_is_org_student(uuid), public.awt_has_course(uuid,uuid) to authenticated;

drop policy if exists student_account_select on public.awt_student_accounts;
create policy student_account_select on public.awt_student_accounts for select to authenticated
 using (auth_user_id=(select auth.uid()) or public.awt_is_org_manager(organization_id));
drop policy if exists student_read on public.awt_students;
create policy student_read on public.awt_students for select to authenticated using (public.awt_is_own_student(id));
drop policy if exists student_read on public.awt_courses;
create policy student_read on public.awt_courses for select to authenticated using (public.awt_has_course(id,organization_id));
drop policy if exists student_read on public.awt_enrollments;
create policy student_read on public.awt_enrollments for select to authenticated using (public.awt_is_own_student(student_id));
drop policy if exists student_read on public.awt_class_sessions;
create policy student_read on public.awt_class_sessions for select to authenticated using (public.awt_has_course(course_id,organization_id));
drop policy if exists student_read on public.awt_attendance;
create policy student_read on public.awt_attendance for select to authenticated using
 (exists(select 1 from public.awt_enrollments e where e.id=enrollment_id and e.organization_id=awt_attendance.organization_id and public.awt_is_own_student(e.student_id)));
drop policy if exists student_read on public.awt_hour_transactions;
create policy student_read on public.awt_hour_transactions for select to authenticated using
 (exists(select 1 from public.awt_enrollments e where e.id=enrollment_id and e.organization_id=awt_hour_transactions.organization_id and public.awt_is_own_student(e.student_id)));
drop policy if exists student_read on public.awt_leave_requests;
create policy student_read on public.awt_leave_requests for select to authenticated using (public.awt_is_own_student(student_id));
drop policy if exists student_create_leave on public.awt_leave_requests;
create policy student_create_leave on public.awt_leave_requests for insert to authenticated with check
 (status='pending' and public.awt_is_own_student(student_id) and exists(
 select 1 from public.awt_class_sessions s join public.awt_enrollments e
 on e.course_id=s.course_id and e.organization_id=s.organization_id
 where s.id=session_id and s.organization_id=awt_leave_requests.organization_id
 and s.status='scheduled' and s.starts_at>now() and e.student_id=awt_leave_requests.student_id));
drop policy if exists student_read on public.awt_announcements;
create policy student_read on public.awt_announcements for select to authenticated using (public.awt_is_org_student(organization_id));
drop policy if exists student_read on public.awt_invoices;
create policy student_read on public.awt_invoices for select to authenticated using (public.awt_is_own_student(student_id));
drop policy if exists course_request_read on public.awt_course_requests;
create policy course_request_read on public.awt_course_requests for select to authenticated
 using (public.awt_is_own_student(student_id) or public.awt_is_org_manager(organization_id));
drop policy if exists course_request_create on public.awt_course_requests;
create policy course_request_create on public.awt_course_requests for insert to authenticated with check
 (status='pending' and public.awt_is_own_student(student_id) and exists(select 1 from public.awt_enrollments e
 where e.id=enrollment_id and e.student_id=awt_course_requests.student_id and e.organization_id=awt_course_requests.organization_id
 and (e.purchased_hours + coalesce((select sum(h.delta_hours) from public.awt_hour_transactions h where h.enrollment_id=e.id),0)) <= 4));
drop policy if exists course_request_manage on public.awt_course_requests;
create policy course_request_manage on public.awt_course_requests for update to authenticated
 using (public.awt_is_org_manager(organization_id)) with check (public.awt_is_org_manager(organization_id));
grant select on public.awt_student_accounts, public.awt_course_requests to authenticated;
grant insert on public.awt_course_requests, public.awt_leave_requests to authenticated;
grant update on public.awt_course_requests to authenticated;

-- Generates a long random single-use code; only a manager may issue it.
create or replace function public.awt_create_student_invite(p_student_id uuid)
returns text language plpgsql security definer set search_path = '' as $invite$
declare v_org uuid; v_code text;
begin
 select organization_id into v_org from public.awt_students where id=p_student_id;
 if v_org is null or not public.awt_is_org_manager(v_org) then raise exception 'Not authorized'; end if;
 if exists(select 1 from public.awt_student_accounts where student_id=p_student_id) then raise exception 'Student already linked'; end if;
 update public.awt_activation_codes set expires_at=now() where student_id=p_student_id and used_at is null;
 v_code:=upper(replace(gen_random_uuid()::text,'-',''));
 insert into public.awt_activation_codes(organization_id,student_id,code_hash,expires_at)
 values(v_org,p_student_id,encode(sha256(convert_to(v_code,'UTF8')),'hex'),now()+interval '7 days');
 return 'AWT-'||v_code;
end;
$invite$;

-- Claims one invitation for one signed-in account (never trusts a supplied student ID).
create or replace function public.awt_claim_student_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $claim$
declare v_code text; v_id uuid; v_org uuid; v_student uuid;
begin
 if (select auth.uid()) is null then raise exception 'Login required'; end if;
 v_code:=upper(regexp_replace(btrim(coalesce(p_code,'')),'^AWT-','','i'));
 if v_code !~ '^[0-9A-F]{32}$' then raise exception 'Invalid code format'; end if;
 if exists(select 1 from public.awt_student_accounts where auth_user_id=(select auth.uid())) then raise exception 'Account already linked'; end if;
 select id,organization_id,student_id into v_id,v_org,v_student
 from public.awt_activation_codes
 where code_hash=encode(sha256(convert_to(v_code,'UTF8')),'hex') and used_at is null and expires_at>now()
 for update;
 if v_id is null then raise exception 'Code invalid, expired or used'; end if;
 insert into public.awt_student_accounts(auth_user_id,organization_id,student_id)
 values((select auth.uid()),v_org,v_student);
 update public.awt_activation_codes set used_at=now() where id=v_id;
 return jsonb_build_object('linked',true);
end;
$claim$;
revoke all on function public.awt_create_student_invite(uuid), public.awt_claim_student_invite(text) from public;
grant execute on function public.awt_create_student_invite(uuid), public.awt_claim_student_invite(text) to authenticated;
commit;
