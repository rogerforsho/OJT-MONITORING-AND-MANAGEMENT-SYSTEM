'use client';

import { useEffect, useState, useCallback } from 'react';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import { getMyProgress } from '@/src/services/progress';

export default function StudentProgressPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getMyProgress();
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSummary(result.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Progress</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track your internship hours and completion status.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-sm text-slate-500">Completed Hours</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary?.completed_hours ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-sm text-slate-500">Remaining Hours</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary?.remaining_hours ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-sm text-slate-500">Status</p>
          <div className="mt-2"><Badge status={summary?.progress_status ?? 'not_started'} /></div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Progress workflow</h2>
          <p className="mt-2 text-sm text-slate-600">Your hours update as your attendance gets verified by your supervisor. Submit reports and keep tracking your completed requirements.</p>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-900">1.</span> Clock attendance in the Attendance page.</li>
            <li><span className="font-semibold text-slate-900">2.</span> Submit reports in the Reports page.</li>
            <li><span className="font-semibold text-slate-900">3.</span> Return here to see updated progress.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Student details</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Loading progress...</p>
          ) : summary ? (
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Student Number:</span> {summary.student_number}</p>
              <p><span className="font-medium text-slate-900">Course:</span> {summary.course}</p>
              <p><span className="font-medium text-slate-900">Required Hours:</span> {summary.required_hours}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No progress data available yet. Complete attendance entries and ask your supervisor to verify them.</p>
          )}
        </div>
      </div>
    </div>
  );
}
