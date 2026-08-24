'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import Alert from '@/src/components/ui/Alert';
import Modal from '@/src/components/ui/Modal';
import Badge from '@/src/components/ui/Badge';
import {
  listStudentReports, submitReport, STANDARD_REPORT_TYPES, type ReportInput
} from '@/src/services/reports';
import type { DbReport } from '@ojt/shared';

const PAGE_SIZE = 20;
const EMPTY_FORM: ReportInput = { report_type: 'weekly_journal', file_path: '', remarks: '' };

export default function StudentReportsPage() {
  const [reports, setReports] = useState<DbReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ReportInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listStudentReports(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setReports(result.data!.reports);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  async function handleSave() {
    setFormError('');
    if (!form.file_path.trim()) {
      setFormError('Please enter a valid document file path or URL.');
      return;
    }
    setSaving(true);
    const result = await submitReport(form);
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setForm(EMPTY_FORM);
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const approvedCount = reports.filter(r => r.status === 'approved').length;

  return (
    <div className="p-8 space-y-6 page-fade-in max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Practicum Document Clearance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit required institutional reports, journals, and clearance documents.</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold">
          + Upload Requirement
        </Button>
      </div>

      {/* Document Clearance Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Approved Documents</p>
          <h3 className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Officially signed off by Coordinator</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Submissions</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{total}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Includes revisions and journals</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Required Checklist</p>
          <h3 className="text-2xl font-bold text-[#0A3D24] mt-1">6 Items</h3>
          <p className="text-xs text-slate-400 mt-0.5">Standard CDM practicum checklist</p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading submissions...</div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📄</span>
            <p className="text-sm font-semibold text-slate-600">No reports submitted yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Upload Requirement" above to submit your first practicum document.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Document Type</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Review Status</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Faculty Feedback / Remarks</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Submitted Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map(r => (
                <tr key={r.report_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-800 capitalize">
                    {r.report_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600 text-xs">
                    {r.remarks ? (
                      <span className="bg-slate-50 p-1.5 rounded border border-slate-100 block max-w-sm">{r.remarks}</span>
                    ) : (
                      <span className="text-slate-400 italic">No remarks yet</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {new Date(r.submission_date).toLocaleDateString()}
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

      {/* Upload Requirement Modal */}
      <Modal title="Submit Practicum Requirement" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700">Official Requirement Category</label>
            <select
              value={form.report_type}
              onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24]"
            >
              {STANDARD_REPORT_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Document Storage File Path or Storage Key"
            placeholder="e.g. reports/student_123_weekly_journal_1.pdf"
            value={form.file_path}
            onChange={e => setForm(f => ({ ...f, file_path: e.target.value }))}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700">Submission Notes / Remarks (Optional)</label>
            <textarea
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24] min-h-[80px]"
              placeholder="Add any notes for your OJT Coordinator regarding this submission..."
              value={form.remarks ?? ''}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            />
          </div>

          {formError && <Alert type="error" message={formError} />}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold">
              Submit Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
