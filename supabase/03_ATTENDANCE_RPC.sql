-- AreWarin Tutor OS v2.4 | STEP 3 OF 3 | atomic attendance & hours
-- Run the ENTIRE file, including END; and the closing $attendance$;
begin;
create or replace function public.awt_record_class_attendance(
  p_enrollment_id uuid,
  p_session_id uuid,
  p_status text,
  p_hours numeric default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $attendance$
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

  select * into e from public.awt_enrollments where id=p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;
  if not public.awt_is_org_manager(e.organization_id) then raise exception 'Permission denied'; end if;

  select * into s from public.awt_class_sessions where id=p_session_id and organization_id=e.organization_id;
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
  from public.awt_attendance a
  where a.enrollment_id=p_enrollment_id and a.session_id=p_session_id;
  old_hours := coalesce(old_hours,0);
  signed_adjustment := old_hours - new_hours;

  select e.purchased_hours + coalesce((select sum(h.delta_hours) from public.awt_hour_transactions h where h.enrollment_id=e.id),0)
    into current_balance;

  if current_balance + signed_adjustment < 0 then
    raise exception 'Insufficient hours (remaining: %)', current_balance;
  end if;

  if existing_id is null then
    insert into public.awt_attendance(organization_id,enrollment_id,session_id,hours,status,created_by)
    values(e.organization_id,p_enrollment_id,p_session_id,new_hours,p_status,(select auth.uid()))
    returning id into saved_id;
  else
    update public.awt_attendance
    set hours=new_hours,status=p_status,created_by=(select auth.uid())
    where id=existing_id;
    saved_id := existing_id;
  end if;

  if signed_adjustment <> 0 then
    insert into public.awt_hour_transactions(organization_id,enrollment_id,delta_hours,reason,attendance_id,created_by)
    values(e.organization_id,p_enrollment_id,signed_adjustment,'Attendance adjustment',saved_id,(select auth.uid()));
  end if;
  return jsonb_build_object('attendance_id',saved_id,'remaining_hours',current_balance+signed_adjustment);
end;
$attendance$;
revoke all on function public.awt_record_class_attendance(uuid,uuid,text,numeric) from public;
grant execute on function public.awt_record_class_attendance(uuid,uuid,text,numeric) to authenticated;
commit;
