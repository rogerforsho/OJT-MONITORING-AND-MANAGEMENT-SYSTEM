'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { Badge } from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import { listReportsForCoordinator, reviewReport, type ReportWithStudent } from '@/src/services/reports';
import { getSignedDocumentUrl } from '@/src/services/storage';

export default function CoordinatorSubmissionsPage() {
  const [reports, setReports] = useState<ReportWithStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingReport, setReviewingReport] = useState<ReportWithStudent | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all');

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

  async function handleOpenDocument(filePath: string, reportId: string) {
    setOpeningDocId(reportId);
    const result = await getSignedDocumentUrl(filePath, 120);
    setOpeningDocId(null);
    if (result.error || !result.data?.signedUrl) {
      alert(result.error?.message || 'Failed to generate document preview link.');
      return;
    }
    window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function submitDecision(status: 'approved' | 'rejected') {
    if (!reviewingReport) return;
    setSubmittingAction(true);
    const result = await reviewReport(reviewingReport.report_id, status, reviewRemarks);
    setSubmittingAction(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setReviewingReport(null);
    setReviewRemarks('');
    load(page);
  }

  const filteredReports = reports.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Requirement Submissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review practicum journals, pre-deployment credentials, and clearance documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'submitted', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#0A3D24] text-[#FFCC00] shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab === 'all' ? 'All Submissions' : tab}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading submissions...</div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📁</span>
            <p className="text-sm font-semibold text-slate-700">No submissions found</p>
            <p className="text-xs text-slate-400 mt-1">No documents match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3.5">Student Trainee</th>
                  <th className="text-left px-5 py-3.5">Document Requirement</th>
                  <th className="text-left px-5 py-3.5">Document File</th>
                  <th className="text-left px-5 py-3.5">Supervisor Endorsement</th>
                  <th className="text-left px-5 py-3.5">Coordinator Status</th>
                  <th className="text-right px-5 py-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map(r => (
                  <tr key={r.report_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{r.students?.users?.full_name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {r.students?.student_number} • {r.students?.course}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-800 capitalize">
                        {r.report_type.replace(/_/g, ' ')}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Submitted {new Date(r.submission_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {r.remarks && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-1.5 rounded mt-1 border border-slate-100">
                          <span className="font-bold text-slate-500">Student Note:</span> {r.remarks}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleOpenDocument(r.file_path, r.report_id)}
                        disabled={openingDocId === r.report_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#0A3D24] border border-emerald-200 hover:bg-emerald-100 text-xs font-bold transition-all cursor-pointer"
                      >
                        {openingDocId === r.report_id ? 'Opening...' : '📄 View Document'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {r.supervisor_feedback ? (
                        <div className="bg-emerald-50/70 border border-emerald-200 p-2 rounded-lg max-w-xs">
                          <p className="text-emerald-900 font-semibold">{r.supervisor_feedback}</p>
                          <span className="text-[10px] text-emerald-700 block mt-1">
                            ✓ Endorsed {r.supervisor_endorsed_at ? new Date(r.supervisor_endorsed_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No supervisor remarks</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={`text-xs font-bold ${
                        r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setReviewingReport(r);
                          setReviewRemarks(r.remarks || '');
                        }}
                        className="text-xs font-bold text-[#0A3D24] hover:bg-emerald-50"
                      >
                        Review / Sign Off →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Coordinator Sign-off Modal */}
      <Modal
        title={`Sign-off: ${reviewingReport?.students?.users?.full_name || 'Submission'}`}
        open={!!reviewingReport}
        onClose={() => setReviewingReport(null)}
        footer={
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="ghost"
              onClick={() => setReviewingReport(null)}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => submitDecision('rejected')}
                loading={submittingAction}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Reject Submission
              </Button>
              <Button
                onClick={() => submitDecision('approved')}
                loading={submittingAction}
                className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold"
              >
                Approve & Sign Off
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <p className="font-bold text-slate-800">
              Requirement: <span className="capitalize">{reviewingReport?.report_type.replace(/_/g, ' ')}</span>
            </p>
            <p className="text-slate-500">
              Student Number: <span className="font-mono">{reviewingReport?.students?.student_number}</span> ({reviewingReport?.students?.course})
            </p>
            {reviewingReport?.supervisor_feedback && (
              <p className="text-emerald-800 font-semibold pt-1 border-t border-slate-200">
                Mentor Endorsement: {reviewingReport.supervisor_feedback}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Coordinator Assessment Remarks
            </label>
            <textarea
              value={reviewRemarks}
              onChange={e => setReviewRemarks(e.target.value)}
              placeholder="Add feedback, reasons for revision, or clearance acknowledgement..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
