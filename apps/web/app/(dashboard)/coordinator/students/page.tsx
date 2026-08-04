'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/src/components/ui/Alert';
import Button from '@/src/components/ui/Button';
import { listActiveStudents } from '@/src/services/auth';
import { listAssignments } from '@/src/services/assignments';

type ActiveStudent = {
  user_id: string;
  full_name: string;
  email: string;
  student_number: string;
  course: string;
  year_level: number;
  account_status: string;
  created_at: string;
};

type AssignmentSummary = {
  assignment_id: string;
  assignment_status: string;
  start_date: string;
  end_date?: string | null;
  students: { student_number: string; course: string; year_level: number; users: { full_name: string; email: string } };
  companies: { company_name: string };
  supervisors: { position: string; users: { full_name: string; email: string } };
};

const PAGE_SIZE = 20;

export default function CoordinatorStudentsPage() {
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (pageNumber: number) => {
    setLoading(true);
    setError('');

    const [studentResult, assignmentResult] = await Promise.all([
      listActiveStudents(pageNumber, PAGE_SIZE),
      listAssignments(pageNumber, PAGE_SIZE),
    ]);
    setLoading(false);

    if (studentResult.error) {
      setError(studentResult.error.message);
      return;
    }

    setStudents(studentResult.data?.students ?? []);
    setTotal(studentResult.data?.total ?? 0);
    setAssignments(assignmentResult.data?.assignments ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (!active) return;
      await load(page);
    };

    fetchData();
    return () => { active = false; };
  }, [page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const assignmentByStudent = new Map(assignments.map(item => [item.students?.users?.full_name ?? '', item]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Students</h1>
        <p className="text-sm text-slate-500 mt-0.5">Active student accounts and their assigned details.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">👥</span>
            <p className="text-sm">No active students found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Course</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Placement</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map(student => {
                const assignment = assignmentByStudent.get(student.full_name);
                return (
                  <tr key={student.user_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-400">{student.student_number}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{student.email}</td>
                    <td className="px-5 py-4 text-slate-700">{student.course}</td>
                    <td className="px-5 py-4 text-slate-700">
                      {assignment ? `${assignment.companies?.company_name ?? 'Company'} • ${assignment.supervisors?.users?.full_name ?? 'Supervisor'}` : 'No active placement'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        assignment?.assignment_status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {assignment?.assignment_status ?? 'No assignment'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
