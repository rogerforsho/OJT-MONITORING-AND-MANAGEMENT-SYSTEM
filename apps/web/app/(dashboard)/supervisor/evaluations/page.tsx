'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import Modal from '@/src/components/ui/Modal';
import { Badge } from '@/src/components/ui/Badge';
import { createEvaluation, listAssignedStudentsForEvaluation, listEvaluationsForSupervisor, type EvaluationInput } from '@/src/services/evaluations';

const PAGE_SIZE = 20;
const EMPTY_FORM: EvaluationInput = {
  student_id: '',
  performance_score: 90,
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
    if (!form.student_id) {
      setFormError('Please select a student to evaluate.');
      return;
    }
    if (!form.feedback?.trim()) {
      setFormError('Please provide qualitative feedback for the trainee.');
      return;
    }

    setSaving(true);
    const result = await createEvaluation({
      ...form,
      feedback: form.feedback.trim(),
    });
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setForm(EMPTY_FORM);
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function getScoreBadge(score: number | null) {
    if (score === null) return <span className="text-slate-400">—</span>;
    if (score >= 90) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{score}% (Excellent)</Badge>;
    if (score >= 80) return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-bold">{score}% (Very Satisfactory)</Badge>;
    if (score >= 75) return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold">{score}% (Satisfactory)</Badge>;
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">{score}% (Needs Improvement)</Badge>;
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trainee Performance Evaluations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit and review performance ratings and competency feedback for your assigned OJT interns.</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setModalOpen(true); }}>
          + New Evaluation
        </Button>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading evaluations...</div>
        ) : evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">⭐</span>
            <p className="text-sm font-semibold text-slate-700">No evaluations submitted yet</p>
            <p className="text-xs text-slate-400 mt-1">Submit performance ratings for your assigned interns.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">Student Trainee</th>
                <th className="text-left px-5 py-3.5">Performance Rating</th>
                <th className="text-left px-5 py-3.5">Supervisor Feedback</th>
                <th className="text-left px-5 py-3.5">Date Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluations.map(e => (
                <tr key={e.evaluation_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900">{e.students?.users?.full_name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{e.students?.student_number} • {e.students?.course}</p>
                  </td>
                  <td className="px-5 py-4">
                    {getScoreBadge(e.performance_score)}
                  </td>
                  <td className="px-5 py-4 text-slate-700 max-w-md">
                    <p className="line-clamp-2">{e.feedback}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs font-medium">
                    {new Date(e.evaluation_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
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

      {/* New Evaluation Modal */}
      <Modal title="Trainee Performance Evaluation" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assigned Trainee</label>
            <select
              value={form.student_id}
              onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="">Select trainee</option>
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.full_name} — {s.student_number} ({s.course})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Performance Score (0 - 100)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="50"
                max="100"
                value={form.performance_score ?? 90}
                onChange={e => setForm(f => ({ ...f, performance_score: e.target.value ? Number(e.target.value) : null }))}
                className="w-24 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-medium">
                {form.performance_score && form.performance_score >= 90 ? '🌟 Outstanding / Excellent' :
                 form.performance_score && form.performance_score >= 80 ? '👍 Very Satisfactory' :
                 form.performance_score && form.performance_score >= 75 ? '✔️ Satisfactory' : '⚠️ Needs Improvement'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Qualitative Feedback & Remarks</label>
            <textarea
              value={form.feedback}
              onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))}
              rows={4}
              placeholder="Detail the trainee's work ethics, technical competence, and attendance performance..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {formError && <Alert type="error" message={formError} />}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              Submit Evaluation
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
