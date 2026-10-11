import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Keep these patterns aligned with course_department in migration 029.
const patterns = {
  ICS: ['BSIT', 'BSCS', 'BS-CPE', 'BSCPE', 'INFORMATION TECHNOLOGY', 'COMPUTER ENGINEERING', 'COMPUTER SCIENCE'],
  IBE: ['BSBA', 'BSENTREP', 'ENTREPRENEURSHIP', 'HUMAN RESOURCE', 'BSA', 'ACCOUNTANCY'],
};

export async function departmentScope(client: SupabaseClient, userId: string, role: string) {
  if (role !== 'ProgramHead') return { department: null, error: null };
  const { data, error } = await client.from('program_heads')
    .select('department_or_program').eq('user_id', userId).maybeSingle();
  const department = data?.department_or_program?.trim().toUpperCase();
  if (error || !['ICS', 'IBE'].includes(department)) {
    return { department: null, error: 'Your department assignment could not be verified. Contact an administrator.' };
  }
  return { department: department as 'ICS' | 'IBE', error: null };
}

export function restrictDepartment<T extends { or(filters: string): T; not(column: string, operator: string, value: string): T }>(query: T, department: 'ICS' | 'IBE' | null): T {
  if (!department) return query;
  query = query.or(patterns[department].map(pattern => `course.ilike.*${pattern}*`).join(','));
  // Match the database's ICS-first classification even for ambiguous legacy data.
  if (department === 'IBE') {
    for (const pattern of patterns.ICS) query = query.not('course', 'ilike', `%${pattern}%`);
  }
  return query;
}

export async function canManageDepartmentStudent(client: SupabaseClient, actorId: string, role: string, targetId: string, column: 'student_id' | 'user_id' = 'student_id') {
  if (role !== 'ProgramHead') return ['Coordinator', 'Admin'].includes(role);
  const scope = await departmentScope(client, actorId, role);
  if (scope.error || !scope.department) return false;
  const { data, error } = await restrictDepartment(client.from('students').select('student_id').eq(column, targetId), scope.department).maybeSingle();
  return !error && !!data;
}

export async function canManageDepartmentRecord(client: SupabaseClient, actorId: string, role: string, table: string, column: string, recordId: string) {
  if (role !== 'ProgramHead') return ['Coordinator', 'Admin'].includes(role);
  const { data, error } = await client.from(table).select('student_id').eq(column, recordId).maybeSingle();
  return !error && !!data && await canManageDepartmentStudent(client, actorId, role, data.student_id);
}
