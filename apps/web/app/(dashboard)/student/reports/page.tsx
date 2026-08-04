'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import Alert from '@/src/components/ui/Alert';
import Modal from '@/src/components/ui/Modal';
import { listStudentReports, submitReport, type ReportInput } from '@/src/services/reports';

const PAGE_SIZE = 20;
const EMPTY_FORM: ReportInput = { report_type: '', file_path: '', remarks: '' };

export default function StudentReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
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
    setSaving(true);
    const result = await submitReport(form);
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setForm(EMPTY_FORM);
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit internship reports and requirements.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Report</Button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Report workflow</h2>
          <p className="mt-2 text-sm text-slate-600">Submit your progress and document your internship requirements here.</p>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-900">1.</span> Create a new report for each requirement.</li>
            <li><span className="font-semibold text-slate-900">2.</span> Keep your file path or attachments updated.</li>
            <li><span className="font-semibold text-slate-900">3.</span> Ask your supervisor to review and approve your submission.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Need help?</h2>
          <p className="mt-2 text-sm text-slate-600">If your report is not reviewed yet, check in with your supervisor and keep your file path details accurate.</p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">📁</span>
            <p className="text-sm">No reports submitted yet. Create your first report to begin tracking progress.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Type</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Remarks</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map(r => (
                <tr key={r.report_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{r.report_type}</td>
                  <td className="px-5 py-4 text-slate-700">{r.status}</td>
                  <td className="px-5 py-4 text-slate-700">{r.remarks ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-700">{new Date(r.submission_date).toLocaleDateString()}</td>
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

      <Modal title="New Report" open={modalOpen} onClose={() => setModalOpen(false)}>
        <Input label="Report Type" value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))} required />
        <Input label="File Path" value={form.file_path} onChange={e => setForm(f => ({ ...f, file_path: e.target.value }))} required />
        <Input label="Remarks" value={form.remarks ?? ''} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
        {formError && <Alert type="error" message={formError} />}
        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} loading={saving} className="flex-1">Submit Report</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
