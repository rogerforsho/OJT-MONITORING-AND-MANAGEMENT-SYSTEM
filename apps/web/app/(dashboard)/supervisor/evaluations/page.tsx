'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import Modal from '@/src/components/ui/Modal';
import { Badge } from '@/src/components/ui/Badge';
import {
  createEvaluation, listAssignedStudentsForEvaluation, listEvaluationsForSupervisor,
  type EvaluationInput, type EvaluationRubricCriteria
} from '@/src/services/evaluations';

const PAGE_SIZE = 20;

const DEFAULT_CRITERIA: EvaluationRubricCriteria = {
  technical_competence: 23, // out of 25
  productivity_dependability: 18, // out of 20
  attendance_punctuality: 19, // out of 20
  communication_skills: 14, // out of 15
  work_ethics_professionalism: 18, // out of 20
};

export default function SupervisorEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [criteria, setCriteria] = useState<EvaluationRubricCriteria>(DEFAULT_CRITERIA);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<{ student_id: string; full_name: string; student_number: string; course: string }[]>([]);

  const computedTotalScore = Math.min(100, Math.max(0,
    (criteria.technical_competence || 0) +
    (criteria.productivity_dependability || 0) +
    (criteria.attendance_punctuality || 0) +
    (criteria.communication_skills || 0) +
    (criteria.work_ethics_professionalism || 0)
  ));

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
    if (!studentId) {
      setFormError('Please select a student trainee to evaluate.');
      return;
    }
    if (!feedback.trim()) {
      setFormError('Please provide qualitative feedback for the trainee.');
      return;
    }

    setSaving(true);
    const result = await createEvaluation({
      student_id: studentId,
      performance_score: computedTotalScore,
      feedback: feedback.trim(),
      criteria,
    });
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setStudentId('');
    setFeedback('');
    setCriteria(DEFAULT_CRITERIA);
    load(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function getScoreBadge(score: number | null) {
    if (score === null) return <span className="text-slate-400">—</span>;
    if (score >= 90) return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{score}% (Outstanding)</Badge>;
    if (score >= 80) return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-bold">{score}% (Very Satisfactory)</Badge>;
    if (score >= 75) return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold">{score}% (Satisfactory - Passed)</Badge>;
    return <Badge className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">{score}% (Needs Improvement)</Badge>;
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trainee Performance Evaluations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Submit competency ratings using the 5-dimension CHED practicum rubric.</p>
        </div>
        <Button
          onClick={() => { setStudentId(''); setFeedback(''); setCriteria(DEFAULT_CRITERIA); setFormError(''); setModalOpen(true); }}
          className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold"
        >
          + Rate Assigned Trainee
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
            <p className="text-xs text-slate-400 mt-1">Submit competency ratings for your assigned interns.</p>
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

      {/* 5-Dimension Rubric Evaluation Modal */}
      <Modal title="Trainee Performance Evaluation (5-Dimension Rubric)" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assigned Trainee</label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24]"
            >
              <option value="">Select assigned trainee</option>
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.full_name} — {s.student_number} ({s.course})
                </option>
              ))}
            </select>
          </div>

          {/* Rubric Dimension Sliders / Inputs */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">CHED Practicum Competency Rubric</h4>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>1. Technical Competence & Quality of Output (Max 25 pts)</span>
                <span className="font-bold text-[#0A3D24]">{criteria.technical_competence} / 25</span>
              </div>
              <input
                type="range" min="10" max="25"
                value={criteria.technical_competence}
                onChange={e => setCriteria(c => ({ ...c, technical_competence: Number(e.target.value) }))}
                className="w-full accent-[#0A3D24]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>2. Productivity & Dependability (Max 20 pts)</span>
                <span className="font-bold text-[#0A3D24]">{criteria.productivity_dependability} / 20</span>
              </div>
              <input
                type="range" min="8" max="20"
                value={criteria.productivity_dependability}
                onChange={e => setCriteria(c => ({ ...c, productivity_dependability: Number(e.target.value) }))}
                className="w-full accent-[#0A3D24]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>3. Attendance, Punctuality & Discipline (Max 20 pts)</span>
                <span className="font-bold text-[#0A3D24]">{criteria.attendance_punctuality} / 20</span>
              </div>
              <input
                type="range" min="8" max="20"
                value={criteria.attendance_punctuality}
                onChange={e => setCriteria(c => ({ ...c, attendance_punctuality: Number(e.target.value) }))}
                className="w-full accent-[#0A3D24]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>4. Communication & Teamwork (Max 15 pts)</span>
                <span className="font-bold text-[#0A3D24]">{criteria.communication_skills} / 15</span>
              </div>
              <input
                type="range" min="5" max="15"
                value={criteria.communication_skills}
                onChange={e => setCriteria(c => ({ ...c, communication_skills: Number(e.target.value) }))}
                className="w-full accent-[#0A3D24]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>5. Professionalism, Work Ethics & Initiative (Max 20 pts)</span>
                <span className="font-bold text-[#0A3D24]">{criteria.work_ethics_professionalism} / 20</span>
              </div>
              <input
                type="range" min="8" max="20"
                value={criteria.work_ethics_professionalism}
                onChange={e => setCriteria(c => ({ ...c, work_ethics_professionalism: Number(e.target.value) }))}
                className="w-full accent-[#0A3D24]"
              />
            </div>

            {/* Composite Score Card */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between mt-2">
              <span className="text-xs font-bold text-slate-800">Overall Calculated Rating:</span>
              <span className="text-base font-bold text-[#0A3D24]">{computedTotalScore}% ({
                computedTotalScore >= 90 ? 'Outstanding' :
                computedTotalScore >= 80 ? 'Very Satisfactory' :
                computedTotalScore >= 75 ? 'Satisfactory' : 'Needs Improvement'
              })</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Qualitative Feedback & Mentor Remarks</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              placeholder="Detail the trainee's technical strengths, key contributions, and areas for improvement..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24]"
              required
            />
          </div>

          {formError && <Alert type="error" message={formError} />}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold">
              Submit Official Evaluation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
