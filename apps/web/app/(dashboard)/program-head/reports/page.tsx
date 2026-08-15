import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import { getDepartmentSummary, listCohortProgress } from '@/src/services/progress';
import DepartmentReportsClient from './DepartmentReportsClient';

export default async function ProgramHeadReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const [summaryRes, cohortRes] = await Promise.all([
    getDepartmentSummary(),
    listCohortProgress(1, 100),
  ]);

  const summary = summaryRes.data ?? {
    totalStudents: 0,
    activeTrainees: 0,
    completedTrainees: 0,
    totalRenderedHours: 0,
    departmentCounts: {
      ICS: { total: 0, completed: 0, hours: 0 },
      IBE: { total: 0, completed: 0, hours: 0 },
    },
  };

  const initialStudents = cohortRes.data?.students ?? [];

  return (
    <DepartmentReportsClient
      summary={summary}
      initialStudents={initialStudents}
    />
  );
}
