-- AreWarin Tutor OS v2.4 | STEP 1 OF 3 | safe schema setup
-- Run this COMPLETE file first in Supabase SQL Editor (not just selected lines).
-- Only awt_* tables are touched; non-AreWarin tables like public.courses are untouched.
-- Existing tables are NOT dropped. This creates missing ones but does not migrate mismatched old definitions.
begin;
create extension if not exists pgcrypto;
create table if not exists public.awt_organizations(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz default now());
create table if not exists public.awt_staff_members(organization_id uuid references public.awt_organizations on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','admin','tutor')), primary key(organization_id,user_id));
create table if not exists public.awt_students(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.awt_organizations on delete cascade, student_code text not null, full_name text not null, created_at timestamptz default now(), unique(organization_id,student_code),unique(id,organization_id));
create table if not exists public.awt_courses(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,name text not null,default_hours numeric(8,2) not null check(default_hours>0),price numeric(12,2) not null default 0 check(price>=0),unique(id,organization_id));
create table if not exists public.awt_enrollments(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,course_id uuid not null,purchased_hours numeric(8,2) not null check(purchased_hours>0),created_at timestamptz default now(),foreign key(student_id,organization_id) references public.awt_students(id,organization_id),foreign key(course_id,organization_id) references public.awt_courses(id,organization_id),unique(id,organization_id));
create table if not exists public.awt_class_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,course_id uuid not null,topic text not null,starts_at timestamptz not null,ends_at timestamptz not null,meeting_url text, status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),check(ends_at>starts_at),foreign key(course_id,organization_id) references public.awt_courses(id,organization_id),unique(id,organization_id));
create table if not exists public.awt_attendance(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,enrollment_id uuid not null,session_id uuid not null,hours numeric(8,2) not null check(hours>=0),status text not null check(status in ('present','absent','excused')),created_by uuid references auth.users,created_at timestamptz default now(),foreign key(enrollment_id,organization_id) references public.awt_enrollments(id,organization_id),foreign key(session_id,organization_id) references public.awt_class_sessions(id,organization_id),unique(enrollment_id,session_id));
create table if not exists public.awt_hour_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,enrollment_id uuid not null,delta_hours numeric(8,2) not null check(delta_hours<>0),reason text not null,attendance_id uuid references public.awt_attendance,created_by uuid references auth.users,created_at timestamptz default now(),foreign key(enrollment_id,organization_id) references public.awt_enrollments(id,organization_id));
create table if not exists public.awt_leave_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,session_id uuid not null,reason text not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),created_at timestamptz default now(),foreign key(student_id,organization_id) references public.awt_students(id,organization_id),foreign key(session_id,organization_id) references public.awt_class_sessions(id,organization_id));
create table if not exists public.awt_announcements(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,title text not null,body text not null,created_at timestamptz default now());
create table if not exists public.awt_invoices(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,amount numeric(12,2) not null check(amount>=0),due_date date not null,status text not null default 'unpaid' check(status in ('unpaid','paid','void')),foreign key(student_id,organization_id) references public.awt_students(id,organization_id));
create table if not exists public.awt_line_accounts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,line_user_id text not null,linked_at timestamptz default now(),foreign key(student_id,organization_id) references public.awt_students(id,organization_id),unique(organization_id,student_id),unique(organization_id,line_user_id));
create table if not exists public.awt_activation_codes(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,code_hash text not null unique,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz default now(),foreign key(student_id,organization_id) references public.awt_students(id,organization_id));
create table if not exists public.awt_notification_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,student_id uuid not null,session_id uuid,kind text not null,scheduled_at timestamptz not null,status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),attempts int not null default 0,provider_message_id text,created_at timestamptz default now(),foreign key(student_id,organization_id) references public.awt_students(id,organization_id),foreign key(session_id,organization_id) references public.awt_class_sessions(id,organization_id));
create table if not exists public.awt_audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.awt_organizations on delete cascade,actor_id uuid references auth.users,action text not null,record_type text not null,record_id uuid,created_at timestamptz default now());
create unique index if not exists awt_notification_session_once
on public.awt_notification_jobs(student_id,session_id,kind)
where session_id is not null and status <> 'cancelled';
alter table public.awt_class_sessions add column if not exists cancel_reason text;
-- Safe default: RLS enabled before any client activity.
alter table public.awt_organizations enable row level security;
alter table public.awt_staff_members enable row level security;
alter table public.awt_students enable row level security;
alter table public.awt_courses enable row level security;
alter table public.awt_enrollments enable row level security;
alter table public.awt_class_sessions enable row level security;
alter table public.awt_attendance enable row level security;
alter table public.awt_hour_transactions enable row level security;
alter table public.awt_leave_requests enable row level security;
alter table public.awt_announcements enable row level security;
alter table public.awt_invoices enable row level security;
alter table public.awt_line_accounts enable row level security;
alter table public.awt_activation_codes enable row level security;
alter table public.awt_notification_jobs enable row level security;
alter table public.awt_audit_logs enable row level security;
commit;
-- Done: check Table Editor for awt_* tables. Then run 02_POLICIES_AND_OWNER.sql.
