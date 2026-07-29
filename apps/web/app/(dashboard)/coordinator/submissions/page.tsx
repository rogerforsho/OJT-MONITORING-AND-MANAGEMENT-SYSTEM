'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { listReportsForCoordinator, reviewReport } from '@/src/services/reports';

export default function CoordinatorSubmissionsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listReportsForCoordinator(p, 20);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setReports(result.data!.reports);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  async function handleReview(report_id: string, status: 'reviewed' | 'approved' | 'rejected') {
    setReviewingId(report_id);
    const result = await reviewReport(report_id, status, remarks);
    setReviewingId(null);
    if (result.error) { setError(result.error.message); return; }
    setRemarks('');
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Submissions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review student reports and requirements.</p>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading submissions...</div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📁</span>
            <p className="text-sm">No submissions found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Type</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Remarks</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map(r => (
                <tr key={r.report_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{r.students?.users?.full_name}</p>
                    <p className="text-xs text-slate-400">{r.students?.student_number}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{r.report_type}</td>
                  <td className="px-5 py-4 text-slate-700">{r.status}</td>
                  <td className="px-5 py-4 text-slate-700">{r.remarks ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" onClick={() => handleReview(r.report_id, 'approved')} loading={reviewingId === r.report_id}>Approve</Button>
                      <Button variant="ghost" onClick={() => handleReview(r.report_id, 'rejected')} className="text-red-500 hover:bg-red-50">Reject</Button>
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
