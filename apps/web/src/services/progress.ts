'use server';

import { createClient } from '@/src/lib/supabase/server';
import type { AppResult } from '@ojt/shared';

export interface ProgressSummary {
  student_id: string;
  full_name: string;
  student_number: string;
  course: string;
  completed_hours: number;
  remaining_hours: number;
  progress_status: 'not_started' | 'in_progress' | 'completed';
  required_hours: number;
}

async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, user, profile };
}

export async function getMyProgress(): Promise<AppResult<ProgressSummary | null>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, student_number, course, required_hours')
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student profile.' } };
  }

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select('attendance_id, time_in, time_out, verification_status')
    .eq('student_id', student.student_id);

  if (attendanceError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };
  }

  const completedHours = (attendanceData ?? [])
    .filter((record: any) => record.verification_status === 'verified' && record.time_in && record.time_out)
    .reduce((total: number, record: any) => {
      const start = new Date(record.time_in).getTime();
      const end = new Date(record.time_out).getTime();
      const durationHours = Math.max(0, (end - start) / (1000 * 60 * 60));
      return total + durationHours;
    }, 0);

  const remainingHours = Math.max(0, student.required_hours - completedHours);
  const progress_status: 'not_started' | 'in_progress' | 'completed' =
    completedHours <= 0 ? 'not_started' : remainingHours <= 0 ? 'completed' : 'in_progress';

  const summary: ProgressSummary = {
    student_id: student.student_id,
    full_name: profile?.full_name ?? '',
    student_number: student.student_number,
    course: student.course,
    completed_hours: Number(completedHours.toFixed(2)),
    remaining_hours: Number(remainingHours.toFixed(2)),
    progress_status,
    required_hours: student.required_hours,
  };

  return { data: summary, error: null };
}

export async function listProgressForCoordinator(): Promise<AppResult<ProgressSummary[]>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile?.role ?? '') || profile?.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('student_id, student_number, course, required_hours, users!inner ( user_id, full_name )');

  if (studentsError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student progress.' } };
  }

  const studentIds = (students ?? []).map((student: any) => student.student_id);

  if (studentIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select('student_id, time_in, time_out, verification_status')
    .in('student_id', studentIds);

  if (attendanceError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };
  }

  const attendanceByStudent = new Map<string, any[]>();
  (attendanceData ?? []).forEach((record: any) => {
    const list = attendanceByStudent.get(record.student_id) ?? [];
    list.push(record);
    attendanceByStudent.set(record.student_id, list);
  });

  const progress = (students ?? []).map((student: any) => {
    const records = attendanceByStudent.get(student.student_id) ?? [];
    const completedHours = records
      .filter((record: any) => record.verification_status === 'verified' && record.time_in && record.time_out)
      .reduce((total: number, record: any) => {
        const start = new Date(record.time_in).getTime();
        const end = new Date(record.time_out).getTime();
        return total + Math.max(0, (end - start) / (1000 * 60 * 60));
      }, 0);

    const remainingHours = Math.max(0, student.required_hours - completedHours);
    const progress_status: 'not_started' | 'in_progress' | 'completed' =
      completedHours <= 0 ? 'not_started' : remainingHours <= 0 ? 'completed' : 'in_progress';

    return {
      student_id: student.student_id,
      full_name: student.users?.full_name ?? '',
      student_number: student.student_number,
      course: student.course,
      completed_hours: Number(completedHours.toFixed(2)),
      remaining_hours: Number(remainingHours.toFixed(2)),
      progress_status,
      required_hours: student.required_hours,
    } satisfies ProgressSummary;
  });

  return { data: progress, error: null };
}
