-- ==============================================================================
-- DEMO SEED & REPAIR SCRIPT: Colegio de Montalban OJT System
-- Password for ALL demo accounts below is: Password123!
-- Compatible with Supabase GoTrue v2.x (auth.users + auth.identities)
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Enable Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- 2. Ensure Announcements Table Exists
create table if not exists announcements (
  announcement_id uuid primary key default uuid_generate_v4(),
  author_user_id uuid references users(user_id) on delete set null,
  title text not null,
  content text not null,
  target_role text not null default 'All',
  target_department text not null default 'All',
  created_at timestamptz not null default now()
);

-- 3. Update Trigger Function to Support Re-Seeding & ON CONFLICT
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'Student');

  insert into public.users (user_id, full_name, email, role, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    v_role,
    'pending'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;

  if v_role = 'Student' then
    insert into public.students (user_id, student_number, course, year_level, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'student_number', 'PENDING-' || substr(new.id::text, 1, 8)),
      coalesce(new.raw_user_meta_data->>'course', 'BSIT'),
      coalesce((new.raw_user_meta_data->>'year_level')::int, 4),
      'active'
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- 4. Clean up any existing demo entries in auth tables
delete from auth.identities where id in (
  '11111111-1111-4111-a111-111111111111',
  '22222222-2222-4222-a222-222222222222',
  '33333333-3333-4333-a333-333333333331',
  '33333333-3333-4333-a333-333333333332',
  '44444444-4444-4444-a444-444444444444',
  '55555555-5555-4555-a555-555555555551',
  '55555555-5555-4555-a555-555555555552'
);

delete from auth.users where id in (
  '11111111-1111-4111-a111-111111111111',
  '22222222-2222-4222-a222-222222222222',
  '33333333-3333-4333-a333-333333333331',
  '33333333-3333-4333-a333-333333333332',
  '44444444-4444-4444-a444-444444444444',
  '55555555-5555-4555-a555-555555555551',
  '55555555-5555-4555-a555-555555555552'
);

-- 5. Insert GoTrue-Compliant Auth Users
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, is_super_admin,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
values
  ('11111111-1111-4111-a111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"System Administrator","role":"Admin"}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('22222222-2222-4222-a222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coordinator@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Prof. Maria Santos","role":"Coordinator"}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('33333333-3333-4333-a333-333333333331', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'programhead.ics@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Alan Turing","role":"ProgramHead"}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('33333333-3333-4333-a333-333333333332', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'programhead.ibe@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Peter Drucker","role":"ProgramHead"}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('44444444-4444-4444-a444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'supervisor@techcorp.com', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Engr. Roberto Cruz","role":"Supervisor"}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('55555555-5555-4555-a555-555555555551', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.it@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Juan Dela Cruz","role":"Student","student_number":"2024-00101","course":"BSIT","year_level":4}', false, false, false, now(), now(), '', '', '', '', '', '', '', ''),
  ('55555555-5555-4555-a555-555555555552', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.ba@cdm.edu.ph', crypt('Password123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maria Clara","role":"Student","student_number":"2024-00202","course":"BSBA","year_level":4}', false, false, false, now(), now(), '', '', '', '', '', '', '', '');

-- 6. Insert Matching Identities
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
values
  ('11111111-1111-4111-a111-111111111111', '11111111-1111-4111-a111-111111111111', '{"sub":"11111111-1111-4111-a111-111111111111","email":"admin@cdm.edu.ph"}'::jsonb, 'email', 'admin@cdm.edu.ph', now(), now(), now()),
  ('22222222-2222-4222-a222-222222222222', '22222222-2222-4222-a222-222222222222', '{"sub":"22222222-2222-4222-a222-222222222222","email":"coordinator@cdm.edu.ph"}'::jsonb, 'email', 'coordinator@cdm.edu.ph', now(), now(), now()),
  ('33333333-3333-4333-a333-333333333331', '33333333-3333-4333-a333-333333333331', '{"sub":"33333333-3333-4333-a333-333333333331","email":"programhead.ics@cdm.edu.ph"}'::jsonb, 'email', 'programhead.ics@cdm.edu.ph', now(), now(), now()),
  ('33333333-3333-4333-a333-333333333332', '33333333-3333-4333-a333-333333333332', '{"sub":"33333333-3333-4333-a333-333333333332","email":"programhead.ibe@cdm.edu.ph"}'::jsonb, 'email', 'programhead.ibe@cdm.edu.ph', now(), now(), now()),
  ('44444444-4444-4444-a444-444444444444', '44444444-4444-4444-a444-444444444444', '{"sub":"44444444-4444-4444-a444-444444444444","email":"supervisor@techcorp.com"}'::jsonb, 'email', 'supervisor@techcorp.com', now(), now(), now()),
  ('55555555-5555-4555-a555-555555555551', '55555555-5555-4555-a555-555555555551', '{"sub":"55555555-5555-4555-a555-555555555551","email":"student.it@cdm.edu.ph"}'::jsonb, 'email', 'student.it@cdm.edu.ph', now(), now(), now()),
  ('55555555-5555-4555-a555-555555555552', '55555555-5555-4555-a555-555555555552', '{"sub":"55555555-5555-4555-a555-555555555552","email":"student.ba@cdm.edu.ph"}'::jsonb, 'email', 'student.ba@cdm.edu.ph', now(), now(), now());

-- 7. Repair Any Existing Users
update auth.users
set
  is_sso_user = coalesce(is_sso_user, false),
  is_anonymous = coalesce(is_anonymous, false),
  is_super_admin = coalesce(is_super_admin, false),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0);

-- 8. Create Public Users (active status)
insert into public.users (user_id, full_name, email, role, account_status, created_at, updated_at)
values
  ('11111111-1111-4111-a111-111111111111', 'System Administrator', 'admin@cdm.edu.ph', 'Admin', 'active', now(), now()),
  ('22222222-2222-4222-a222-222222222222', 'Prof. Maria Santos', 'coordinator@cdm.edu.ph', 'Coordinator', 'active', now(), now()),
  ('33333333-3333-4333-a333-333333333331', 'Dr. Alan Turing', 'programhead.ics@cdm.edu.ph', 'ProgramHead', 'active', now(), now()),
  ('33333333-3333-4333-a333-333333333332', 'Dr. Peter Drucker', 'programhead.ibe@cdm.edu.ph', 'ProgramHead', 'active', now(), now()),
  ('44444444-4444-4444-a444-444444444444', 'Engr. Roberto Cruz', 'supervisor@techcorp.com', 'Supervisor', 'active', now(), now()),
  ('55555555-5555-4555-a555-555555555551', 'Juan Dela Cruz', 'student.it@cdm.edu.ph', 'Student', 'active', now(), now()),
  ('55555555-5555-4555-a555-555555555552', 'Maria Clara', 'student.ba@cdm.edu.ph', 'Student', 'active', now(), now())
on conflict (user_id) do update set
  account_status = 'active',
  role = excluded.role,
  full_name = excluded.full_name,
  updated_at = now();

-- 9. Partner Company
insert into public.companies (company_id, company_name, address, contact_person, contact_email, contact_number, status, created_at, updated_at)
values
  ('66666666-6666-4666-a666-666666666666', 'TechCorp Solutions Philippines', 'Montalban Commercial Hub, Rodriguez, Rizal', 'Engr. Roberto Cruz', 'hr@techcorp.com', '0917-123-4567', 'active', now(), now())
on conflict (company_id) do update set
  company_name = excluded.company_name,
  status = 'active';

-- 10. Role Profiles
insert into public.admins (admin_id, user_id)
values (uuid_generate_v4(), '11111111-1111-4111-a111-111111111111')
on conflict (user_id) do nothing;

insert into public.coordinators (coordinator_id, user_id, department)
values (uuid_generate_v4(), '22222222-2222-4222-a222-222222222222', 'ICS & IBE')
on conflict (user_id) do update set
  department = excluded.department;

insert into public.program_heads (program_head_id, user_id, department_or_program)
values
  (uuid_generate_v4(), '33333333-3333-4333-a333-333333333331', 'ICS'),
  (uuid_generate_v4(), '33333333-3333-4333-a333-333333333332', 'IBE')
on conflict (user_id) do update set
  department_or_program = excluded.department_or_program;

insert into public.supervisors (supervisor_id, user_id, company_id, position)
values ('77777777-7777-4777-a777-777777777777', '44444444-4444-4444-a444-444444444444', '66666666-6666-4666-a666-666666666666', 'Senior Software Lead')
on conflict (user_id) do update set
  company_id = excluded.company_id,
  position = excluded.position;

insert into public.students (student_id, user_id, student_number, course, year_level, required_hours, status)
values
  ('88888888-8888-4888-a888-888888888881', '55555555-5555-4555-a555-555555555551', '2024-00101', 'BSIT', 4, 486, 'active'),
  ('88888888-8888-4888-a888-888888888882', '55555555-5555-4555-a555-555555555552', '2024-00202', 'BSBA', 4, 486, 'active')
on conflict (user_id) do update set
  status = 'active',
  required_hours = 486;

-- 11. Student Assignment
insert into public.student_assignments (assignment_id, student_id, company_id, supervisor_id, start_date, assignment_status, created_at)
values
  ('99999999-9999-4999-a999-999999999999', '88888888-8888-4888-a888-888888888881', '66666666-6666-4666-a666-666666666666', '77777777-7777-4777-a777-777777777777', current_date, 'active', now())
on conflict (assignment_id) do update set
  assignment_status = 'active';

-- 12. Initial Progress Records
insert into public.internship_progress (student_id, completed_hours, remaining_hours, progress_status, updated_at)
values
  ('88888888-8888-4888-a888-888888888881', 40, 446, 'in_progress', now()),
  ('88888888-8888-4888-a888-888888888882', 0, 486, 'not_started', now())
on conflict (student_id) do update set
  completed_hours = excluded.completed_hours,
  remaining_hours = excluded.remaining_hours,
  progress_status = excluded.progress_status;

-- 13. Sample Announcement
insert into public.announcements (announcement_id, author_user_id, title, content, target_role, target_department, created_at)
values
  (uuid_generate_v4(), '11111111-1111-4111-a111-111111111111', 'Welcome to OJT Academic Year 2026', 'Welcome to the Colegio de Montalban Cross-Platform OJT Monitoring System. Please ensure your pre-deployment documents and contact information are updated.', 'All', 'All', now())
on conflict do nothing;
