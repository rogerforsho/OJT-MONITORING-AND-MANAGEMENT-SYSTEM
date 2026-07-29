'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/src/components/ui/Alert';
import Button from '@/src/components/ui/Button';
import { listPendingStudents, updateStudentAccountStatus } from '@/src/services/auth';

type PendingStudent = {
  user_id: string;
  full_name: string;
  email: string;
  student_number: string;
  course: string;
  year_level: number;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function CoordinatorApprovalsPage() {
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(async (pageNumber: number) => {
    setLoading(true);
    setError('');

    const result = await listPendingStudents(pageNumber, PAGE_SIZE);
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setStudents(result.data?.students ?? []);
    setTotal(result.data?.total ?? 0);
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

  async function handleAction(user_id: string, status: 'active' | 'rejected') {
    setError('');
    setActionLoading(user_id);
    const result = await updateStudentAccountStatus(user_id, status);
    setActionLoading('');

    if (result.error) {
      setError(result.error.message);
      return;
    }

    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Student Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review and approve pending student registrations.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading pending students...</div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">✅</span>
            <p className="text-sm">No pending student registrations at the moment.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Course</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Year</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Requested</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map(student => (
                <tr key={student.user_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{student.full_name}</p>
                    <p className="text-xs text-slate-400">{student.student_number}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{student.email}</td>
                  <td className="px-5 py-4 text-slate-700">{student.course}</td>
                  <td className="px-5 py-4 text-slate-700">{student.year_level}</td>
                  <td className="px-5 py-4 text-slate-700">{new Date(student.created_at).toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => handleAction(student.user_id, 'rejected')}
                        loading={actionLoading === student.user_id}
                        className="text-red-500 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleAction(student.user_id, 'active')}
                        loading={actionLoading === student.user_id}
                      >
                        Approve
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
