import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const expectedRef = 'qkxxiqozqmrsczawrtcp';
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing staging URL or server-only staging secret in apps/web/.env.staging.local.');
  process.exit(2);
}

const parsedUrl = new URL(url);
if (parsedUrl.hostname !== `${expectedRef}.supabase.co`) {
  console.error(`Refusing to run: URL is not the approved staging project (${expectedRef}).`);
  process.exit(2);
}

const users = [
  { slug: 'admin', role: 'Admin', name: 'QA Admin' },
  { slug: 'coordinator', role: 'Coordinator', name: 'QA Coordinator' },
  { slug: 'program-head-ics', role: 'ProgramHead', name: 'QA Program Head ICS', department: 'ICS' },
  { slug: 'program-head-ibe', role: 'ProgramHead', name: 'QA Program Head IBE', department: 'IBE' },
  { slug: 'supervisor', role: 'Supervisor', name: 'QA Supervisor' },
  { slug: 'student-ics', role: 'Student', name: 'QA Student ICS', course: 'BSIT', studentNumber: 'QA-ICS-2026-001' },
  { slug: 'student-ibe', role: 'Student', name: 'QA Student IBE', course: 'BSBA', studentNumber: 'QA-IBE-2026-001' },
].map((user) => ({
  ...user,
  email: `qa-${user.slug}-20261010@example.com`,
  password: randomBytes(24).toString('base64url'),
}));

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const madeUsers = [];
const studentIds = [];
let companyId;

function unwrap(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function removeRows(table, column, values) {
  if (!values.length) return;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error) console.error(`Cleanup warning (${table}): ${error.message}`);
}

if (!apply) {
  console.log(`Staging target verified: ${expectedRef}`);
  console.log('Would create 7 isolated QA users, role profiles, one synthetic company, two assignments, progress rows, and two schedule requests.');
  console.log('No requests were sent. Review this script, then rerun with --apply to create the fixtures.');
  process.exit(0);
}

try {
  const existing = unwrap('List Auth users', await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }));
  const existingEmails = new Set((existing.users || []).map((user) => user.email?.toLowerCase()));
  const collisions = users.filter((user) => existingEmails.has(user.email.toLowerCase()));
  if (collisions.length) {
    throw new Error(`QA accounts already exist (${collisions.map((user) => user.email).join(', ')}). Refusing to overwrite or delete them.`);
  }

  for (const user of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.name,
        // The database's BEFORE INSERT Auth guard runs before custom app_metadata
        // is reliably available. Supply valid synthetic enrollment fields for all
        // QA identities so staff-account creation passes that guard as well.
        course: user.course || 'BSIT',
        year_level: 4,
        ...(user.studentNumber ? { student_number: user.studentNumber } : {}),
      },
    });
    if (error) throw new Error(`Create ${user.role} Auth user: ${error.message}`);
    madeUsers.push({ ...user, id: data.user.id });

    // Apply trusted role metadata after Auth has inserted the user, then reconcile
    // the application profile. The signup trigger may have provisioned a temporary
    // Student row while the BEFORE INSERT guard was evaluating the new identity.
    unwrap(`Set ${user.role} Auth role`, await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { ...data.user.app_metadata, role: user.role },
    }));
    unwrap(`Activate ${user.email}`, await supabase.from('users').update({
      role: user.role,
      account_status: 'active',
    }).eq('user_id', data.user.id));
    if (user.role !== 'Student') {
      unwrap(`Remove temporary student profile for ${user.email}`,
        await supabase.from('students').delete().eq('user_id', data.user.id));
    }
  }

  const bySlug = Object.fromEntries(madeUsers.map((user) => [user.slug, user]));
  unwrap('Create admin profile', await supabase.from('admins').insert({ user_id: bySlug.admin.id }));
  unwrap('Create coordinator profile', await supabase.from('coordinators').insert({ user_id: bySlug.coordinator.id, department: 'ICS & IBE' }));
  unwrap('Create ICS program-head profile', await supabase.from('program_heads').insert({ user_id: bySlug['program-head-ics'].id, department_or_program: 'ICS' }));
  unwrap('Create IBE program-head profile', await supabase.from('program_heads').insert({ user_id: bySlug['program-head-ibe'].id, department_or_program: 'IBE' }));

  const company = unwrap('Create synthetic company', await supabase.from('companies').insert({
    company_name: 'QA Staging Company',
    address: 'Synthetic staging address, Rodriguez, Rizal',
    contact_person: bySlug.supervisor.name,
    contact_email: bySlug.supervisor.email,
    contact_number: '0000000000',
    status: 'active',
    latitude: 14.7315,
    longitude: 121.1394,
    geofence_radius_meters: 150,
    geofence_enabled: false,
  }).select('company_id').single());
  companyId = company.company_id;

  const supervisor = unwrap('Create supervisor profile', await supabase.from('supervisors').insert({
    user_id: bySlug.supervisor.id,
    company_id: companyId,
    position: 'QA Staging Supervisor',
  }).select('supervisor_id').single());

  const students = [];
  for (const slug of ['student-ics', 'student-ibe']) {
    const user = bySlug[slug];
    const student = unwrap(`Find ${user.role} profile`, await supabase.from('students')
      .select('student_id').eq('user_id', user.id).single());
    studentIds.push(student.student_id);
    unwrap(`Set ${user.slug} profile`, await supabase.from('students').update({
      student_number: user.studentNumber,
      course: user.course,
      year_level: 4,
      required_hours: 486,
      status: 'active',
    }).eq('student_id', student.student_id));
    students.push({ ...user, studentId: student.student_id });
  }

  const assignmentRows = students.map((student) => ({
    student_id: student.studentId,
    company_id: companyId,
    supervisor_id: supervisor.supervisor_id,
    start_date: new Date().toISOString().slice(0, 10),
    assignment_status: 'active',
  }));
  const assignments = unwrap('Create synthetic assignments', await supabase.from('student_assignments')
    .insert(assignmentRows).select('assignment_id,student_id'));

  unwrap('Create progress records', await supabase.from('internship_progress').insert(students.map((student) => ({
    student_id: student.studentId,
    completed_hours: 0,
    remaining_hours: 486,
    progress_status: 'not_started',
  }))));

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  unwrap('Create schedule requests', await supabase.from('practicum_schedules').insert(students.map((student) => ({
    student_id: student.studentId,
    company_id: companyId,
    work_modality: 'on_site',
    work_days: [1, 2, 3, 4, 5],
    time_in: '08:00',
    time_out: '17:00',
    lunch_break_minutes: 60,
    lunch_break_start: '12:00',
    daily_hours: 8,
    weekly_hours: 40,
    start_date: startDate,
    end_date: endDate,
    status: 'pending',
    student_notes: 'Synthetic QA schedule request for staging workflow tests.',
  }))));

  const credentialsPath = join(tmpdir(), `cdm-ojt-staging-qa-accounts-${Date.now()}.txt`);
  const credentialText = [
    'STAGING QA ACCOUNTS — synthetic test identities only',
    `Project: ${expectedRef}`,
    'These passwords are random and unique. Store this file securely and delete it after testing.',
    '',
    ...madeUsers.map((user) => `${user.role}${user.department ? ` (${user.department})` : ''}\t${user.email}\t${user.password}`),
    '',
  ].join('\n');
  await writeFile(credentialsPath, credentialText, { flag: 'wx' });
  console.log('Created 7 synthetic accounts, role profiles, one company, two active assignments, progress rows, and two pending schedule requests.');
  console.log('Passwords were written to a local file in your Windows temp folder; they were not printed.');
  console.log(`Credentials file: ${credentialsPath}`);
  console.log('These accounts are email-confirmed for test sign-in. Test email confirmation separately with a new student signup and inspect Mailtrap.');
} catch (error) {
  console.error(`Staging fixture setup stopped: ${error.message}`);
  await removeRows('practicum_schedules', 'student_id', studentIds);
  await removeRows('student_assignments', 'student_id', studentIds);
  await removeRows('work_schedules', 'company_id', companyId ? [companyId] : []);
  if (companyId) {
    const { error: companyError } = await supabase.from('companies').delete().eq('company_id', companyId);
    if (companyError) console.error(`Cleanup warning (company): ${companyError.message}`);
  }
  for (const user of [...madeUsers].reverse()) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) console.error(`Cleanup warning (${user.email}): ${deleteError.message}`);
  }
  process.exitCode = 1;
}
