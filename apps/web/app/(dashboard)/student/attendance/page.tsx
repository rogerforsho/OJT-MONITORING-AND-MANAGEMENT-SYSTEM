'use client';

import { useEffect, useState, useCallback } from 'react';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import Button from '@/src/components/ui/Button';
import { listOwnAttendance } from '@/src/services/attendance';
import type { DbAttendance } from '@ojt/shared';

const PAGE_SIZE = 20;

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<DbAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listOwnAttendance(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setRecords(result.data!.records);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Attendance History</h1>
        <p className="text-sm text-slate-500 mt-0.5">{total} record{total !== 1 ? 's' : ''}</p>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm">No attendance records yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Date</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Time In</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Time Out</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Late</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Verification</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map(r => (
                <tr key={r.attendance_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{r.attendance_date}</td>
                  <td className="px-5 py-4 text-slate-700">
                    {r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                      <span className="text-amber-500 text-xs font-medium">Pending Time Out</span>
                    )}
                  </td>
                  <td className="px-5 py-4"><Badge status={r.late_status} /></td>
                  <td className="px-5 py-4"><Badge status={r.verification_status} /></td>
                  <td className="px-5 py-4"><Badge status={r.sync_status} /></td>
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
            <Button variant="ghost" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
