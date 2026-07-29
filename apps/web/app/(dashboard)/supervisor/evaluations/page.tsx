'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import Alert from '@/src/components/ui/Alert';
import Modal from '@/src/components/ui/Modal';
import { createEvaluation, listAssignedStudentsForEvaluation, listEvaluationsForSupervisor, type EvaluationInput } from '@/src/services/evaluations';

const PAGE_SIZE = 20;
const EMPTY_FORM: EvaluationInput = {
  student_id: '',
  performance_score: null,
  feedback: '',
};

export default function SupervisorEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EvaluationInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<{ student_id: string; full_name: string; student_number: string; course: string }[]>([]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listEvaluationsForSupervisor(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setEvaluations(result.data!.evaluations);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!mounted) return;
      await load(page);
      const studentsResult = await listAssignedStudentsForEvaluation();
      if (mounted) setStudents(studentsResult.data ?? []);
    };
    fetchData();
    return () => { mounted = false; };
  }, [page, load]);

  async function handleSave() {
    setFormError('');
    setSaving(true);
    const result = await createEvaluation(form);
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setForm(EMPTY_FORM);
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evaluations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit supervisor evaluations for assigned students.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Evaluation</Button>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading evaluations...</div>
        ) : evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">⭐</span>
            <p className="text-sm">No evaluations yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Score</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Feedback</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {evaluations.map(e => (
                <tr key={e.evaluation_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{e.students?.users?.full_name}</p>
                    <p className="text-xs text-slate-400">{e.students?.student_number}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{e.performance_score ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-700">{e.feedback}</td>
                  <td className="px-5 py-4 text-slate-700">{e.evaluation_date}</td>
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

      <Modal title="New Evaluation" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Student</label>
          <select
            value={form.student_id}
            onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Select student</option>
            {students.map(s => <option key={s.student_id} value={s.student_id}>{s.full_name} — {s.student_number} ({s.course})</option>)}
          </select>
        </div>
        <Input label="Performance Score" type="number" value={form.performance_score?.toString() ?? ''} onChange={e => setForm(f => ({ ...f, performance_score: e.target.value ? Number(e.target.value) : null }))} />
        <Input label="Feedback" value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))} required />
        {formError && <Alert type="error" message={formError} />}
        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} loading={saving} className="flex-1">Save Evaluation</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
