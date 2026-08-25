import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getDepartmentSummary, listCohortProgress } from '@/src/services/progress';
import DepartmentReportsClient from './DepartmentReportsClient';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function ProgramHeadReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const service = serviceClient();

  const [{ data: profile }, { data: progHead }] = await Promise.all([
    service.from('users').select('role, account_status').eq('user_id', user.id).single(),
    service.from('program_heads').select('department_or_program').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profile || !['ProgramHead', 'Admin', 'Coordinator'].includes(profile.role) || profile.account_status !== 'active') {
    redirect('/dashboard');
  }

  const userDepartment = (progHead?.department_or_program || 'ICS').toUpperCase();
  const userRole = profile.role;

  const [summaryRes, cohortRes] = await Promise.all([
    getDepartmentSummary(),
    listCohortProgress(1, 200),
  ]);

  const summary = summaryRes.data ?? {
    totalStudents: 0,
    activeTrainees: 0,
    completedTrainees: 0,
    totalRenderedHours: 0,
    ics: {
      total: 0,
      completed: 0,
      hours: 0,
      bsit: { total: 0, active: 0, completed: 0, hours: 0 },
      bscpe: { total: 0, active: 0, completed: 0, hours: 0 },
    },
    ibe: {
      total: 0,
      completed: 0,
      hours: 0,
      bsbaHrm: { total: 0, active: 0, completed: 0, hours: 0 },
      bsEntrep: { total: 0, active: 0, completed: 0, hours: 0 },
    },
  };

  const initialStudents = cohortRes.data?.students ?? [];

  return (
    <DepartmentReportsClient
      summary={summary}
      initialStudents={initialStudents}
      userDepartment={userDepartment}
      userRole={userRole}
    />
  );
}