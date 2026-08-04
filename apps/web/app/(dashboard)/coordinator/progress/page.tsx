'use client';

import { useEffect, useState, useCallback } from 'react';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import { listProgressForCoordinator } from '@/src/services/progress';

export default function CoordinatorProgressPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, completed: 0, inProgress: 0, notStarted: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listProgressForCoordinator();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const data = result.data ?? [];
    setRows(data);
    setSummary({
      total: data.length,
      completed: data.filter((row: any) => row.progress_status === 'completed').length,
      inProgress: data.filter((row: any) => row.progress_status === 'in_progress').length,
      notStarted: data.filter((row: any) => row.progress_status === 'not_started').length,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Student Progress</h1>
        <p className="text-sm text-slate-500 mt-0.5">Monitor internship progress from verified attendance.</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total students</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-sm text-emerald-700">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{summary.completed}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-700">In progress</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{summary.inProgress}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <p className="text-sm text-slate-600">Not started</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.notStarted}</p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading progress...</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📈</span>
            <p className="text-sm">No progress data yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Course</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Completed</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Remaining</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Progress</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.student_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{row.full_name}</p>
                    <p className="text-xs text-slate-400">{row.student_number}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{row.course}</td>
                  <td className="px-5 py-4 text-slate-700">{row.completed_hours}</td>
                  <td className="px-5 py-4 text-slate-700">{row.remaining_hours}</td>
                  <td className="px-5 py-4 text-slate-700">{row.required_hours > 0 ? `${Math.round((row.completed_hours / row.required_hours) * 100)}%` : '0%'}</td>
                  <td className="px-5 py-4"><Badge status={row.progress_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
