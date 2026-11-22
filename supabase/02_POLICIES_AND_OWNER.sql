-- AreWarin Tutor OS v2.4 | STEP 2 OF 3 | RLS policies and manager account
-- FIRST change the teacher email in the last DO $owner$ block near the end.
-- This file changes only public.awt_* objects and awt_* functions.
begin;
create function public.awt_is_org_staff(org uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.awt_staff_members s where s.organization_id=org and s.user_id=(select auth.uid())) $$;
revoke all on function public.awt_is_org_staff(uuid) from public;
grant execute on function public.awt_is_org_staff(uuid) to authenticated;
drop policy if exists staff_read_org on public.awt_organizations;
create policy staff_read_org on public.awt_organizations
for select to authenticated using (public.awt_is_org_staff(id));
drop policy if exists staff_read on public.awt_staff_members;
create policy staff_read on public.awt_staff_members for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_students;
create policy staff_read on public.awt_students for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_courses;
create policy staff_read on public.awt_courses for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_enrollments;
create policy staff_read on public.awt_enrollments for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_class_sessions;
create policy staff_read on public.awt_class_sessions for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_attendance;
create policy staff_read on public.awt_attendance for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_hour_transactions;
create policy staff_read on public.awt_hour_transactions for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_leave_requests;
create policy staff_read on public.awt_leave_requests for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_announcements;
create policy staff_read on public.awt_announcements for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_invoices;
create policy staff_read on public.awt_invoices for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_line_accounts;
create policy staff_read on public.awt_line_accounts for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_notification_jobs;
create policy staff_read on public.awt_notification_jobs for select to authenticated using (public.awt_is_org_staff(organization_id));
drop policy if exists staff_read on public.awt_audit_logs;
create policy staff_read on public.awt_audit_logs for select to authenticated using (public.awt_is_org_staff(organization_id));
-- activation_codes: server-only; no client SELECT policy.
create or replace function public.awt_is_org_manager(org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.awt_staff_members s
    where s.organization_id = org
      and s.user_id = (select auth.uid())
      and s.role in ('owner','admin')
  )
$$;
revoke all on function public.awt_is_org_manager(uuid) from public;
grant execute on function public.awt_is_org_manager(uuid) to authenticated;
drop policy if exists manager_insert on public.awt_students;
create policy manager_insert on public.awt_students for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_students;
create policy manager_update on public.awt_students for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_courses;
create policy manager_insert on public.awt_courses for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_courses;
create policy manager_update on public.awt_courses for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_enrollments;
create policy manager_insert on public.awt_enrollments for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_enrollments;
create policy manager_update on public.awt_enrollments for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_class_sessions;
create policy manager_insert on public.awt_class_sessions for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_class_sessions;
create policy manager_update on public.awt_class_sessions for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_leave_requests;
create policy manager_insert on public.awt_leave_requests for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_leave_requests;
create policy manager_update on public.awt_leave_requests for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_announcements;
create policy manager_insert on public.awt_announcements for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_announcements;
create policy manager_update on public.awt_announcements for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_insert on public.awt_invoices;
create policy manager_insert on public.awt_invoices for insert to authenticated
with check (public.awt_is_org_manager(organization_id));
drop policy if exists manager_update on public.awt_invoices;
create policy manager_update on public.awt_invoices for update to authenticated
using (public.awt_is_org_manager(organization_id))
with check (public.awt_is_org_manager(organization_id));
grant select on public.awt_staff_members to authenticated;
grant select on public.awt_students to authenticated;
grant select on public.awt_courses to authenticated;
grant select on public.awt_enrollments to authenticated;
grant select on public.awt_class_sessions to authenticated;
grant select on public.awt_attendance to authenticated;
grant select on public.awt_hour_transactions to authenticated;
grant select on public.awt_leave_requests to authenticated;
grant select on public.awt_announcements to authenticated;
grant select on public.awt_invoices to authenticated;
grant select on public.awt_line_accounts to authenticated;
grant select on public.awt_notification_jobs to authenticated;
grant select on public.awt_audit_logs to authenticated;
grant select on public.awt_organizations to authenticated;
grant insert, update on public.awt_students to authenticated;
grant insert, update on public.awt_courses to authenticated;
grant insert, update on public.awt_enrollments to authenticated;
grant insert, update on public.awt_class_sessions to authenticated;
grant insert, update on public.awt_leave_requests to authenticated;
grant insert, update on public.awt_announcements to authenticated;
grant insert, update on public.awt_invoices to authenticated;

-- Change only the following example email to your REAL teacher Auth email.
do $owner$
declare
  v_owner_email text := 'arewarin.biology@gmail.com';
  v_owner_id uuid;
  v_org_id uuid;
begin
  if v_owner_email = 'REPLACE_WITH_YOUR_EMAIL@example.com' then
    raise exception 'Edit the v_owner_email line to your teacher login email before running.';
  end if;
  select id into v_owner_id from auth.users
  where lower(email)=lower(trim(v_owner_email)) limit 1;
  if v_owner_id is null then
    raise exception 'Teacher account not found. Create it in Authentication > Users first.';
  end if;
  select id into v_org_id from public.awt_organizations
  where name='AreWarin Tutor' order by created_at limit 1;
  if v_org_id is null then
    insert into public.awt_organizations(name) values('AreWarin Tutor')
    returning id into v_org_id;
  end if;
  insert into public.awt_staff_members(organization_id,user_id,role)
  values(v_org_id,v_owner_id,'owner')
  on conflict(organization_id,user_id) do update set role='owner';
end $owner$;
commit;
-- Done: teacher can log in to Manager. Run 03_ATTENDANCE_RPC.sql for hour logging.
