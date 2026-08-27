import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import SettingsClient from './SettingsClient';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function SettingsPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  const service = serviceClient();

  let extraDetails: {
    course?: string;
    studentNumber?: string;
    employeeNumber?: string;
    department?: string;
    companyName?: string;
  } = {
    employeeNumber: (user as any).employee_number || undefined,
  };

  if (user.role === 'Student') {
    const { data: student } = await supabase
      .from('students')
      .select('course, student_number')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (student) {
      extraDetails.course = student.course || undefined;
      extraDetails.studentNumber = student.student_number || undefined;
    }
  } else if (user.role === 'Coordinator') {
    extraDetails.department = 'Practicum Office / Coordinator';
  } else if (user.role === 'ProgramHead') {
    const { data: progHead } = await service
      .from('program_heads')
      .select('department_or_program')
      .eq('user_id', user.user_id)
      .maybeSingle();
    extraDetails.department = progHead?.department_or_program || 'ICS / IBE';
  } else if (user.role === 'Supervisor') {
    const { data: supervisor } = await service
      .from('supervisors')
      .select('companies(company_name)')
      .eq('user_id', user.user_id)
      .maybeSingle();
    extraDetails.companyName = (supervisor?.companies as any)?.company_name || 'Industry Partner';
  }

  return <SettingsClient user={user} extraDetails={extraDetails} />;
}
