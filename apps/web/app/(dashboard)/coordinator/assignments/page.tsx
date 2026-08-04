'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import Input from '@/src/components/ui/Input';
import {
  listAssignments, createAssignment, updateAssignmentStatus,
  listStudentsForAssignment, listSupervisorsForCompany,
  type AssignmentDetail,
} from '@/src/services/assignments';
import { listCompanies } from '@/src/services/companies';

const PAGE_SIZE = 20;

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [students, setStudents] = useState<{ student_id: string; student_number: string; full_name: string; course: string }[]>([]);
  const [companies, setCompanies] = useState<{ company_id: string; company_name: string }[]>([]);
  const [supervisors, setSupervisors] = useState<{ supervisor_id: string; full_name: string; position: string }[]>([]);

  const [form, setForm] = useState({
    student_id: '', company_id: '', supervisor_id: '', start_date: '', end_date: '',
  });

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listAssignments(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setAssignments(result.data!.assignments);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (isMounted) {
        await load(page);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [page, load]);

  async function openCreate() {
    setForm({ student_id: '', company_id: '', supervisor_id: '', start_date: '', end_date: '' });
    setFormError('');
    setSupervisors([]);

    const [studentsRes, companiesRes] = await Promise.all([
      listStudentsForAssignment(),
      listCompanies(1, 100),
    ]);
    setStudents(studentsRes.data ?? []);
    setCompanies((companiesRes.data?.companies ?? []).filter(c => c.status === 'active').map(c => ({ company_id: c.company_id, company_name: c.company_name })));
    setModalOpen(true);
  }

  async function handleCompanyChange(company_id: string) {
    setForm(f => ({ ...f, company_id, supervisor_id: '' }));
    if (!company_id) { setSupervisors([]); return; }
    const result = await listSupervisorsForCompany(company_id);
    setSupervisors(result.data ?? []);
  }

  async function handleSave() {
    setFormError('');
    setSaving(true);
    const result = await createAssignment({
      student_id: form.student_id,
      company_id: form.company_id,
      supervisor_id: form.supervisor_id,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
    });
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    load(page);
  }

  async function handleStatusChange(assignment_id: string, status: 'active' | 'completed' | 'cancelled') {
    const result = await updateAssignmentStatus(assignment_id, status);
    if (result.error) { setError(result.error.message); return; }
    load(page);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} assignment{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}>+ New Assignment</Button>
      </div>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">🔗</span>
            <p className="text-sm">No assignments yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Student</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Company</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Supervisor</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Start Date</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignments.map(a => (
                <tr key={a.assignment_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{a.students?.users?.full_name}</p>
                    <p className="text-xs text-slate-400">{a.students?.student_number} · {a.students?.course}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{a.companies?.company_name}</td>
                  <td className="px-5 py-4">
                    <p className="text-slate-700">{a.supervisors?.users?.full_name}</p>
                    <p className="text-xs text-slate-400">{a.supervisors?.position}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{a.start_date}</td>
                  <td className="px-5 py-4"><Badge status={a.assignment_status} /></td>
                  <td className="px-5 py-4">
                    {a.assignment_status === 'active' && (
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => handleStatusChange(a.assignment_id, 'completed')}>Complete</Button>
                        <Button variant="ghost" onClick={() => handleStatusChange(a.assignment_id, 'cancelled')} className="text-red-500 hover:bg-red-50">Cancel</Button>
                      </div>
                    )}
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
            <Button variant="ghost" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* New Assignment Modal */}
      <Modal title="New Assignment" open={modalOpen} onClose={() => setModalOpen(false)}>
        {/* Student */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Student</label>
          <select
            value={form.student_id}
            onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Select student</option>
            {students.map(s => (
              <option key={s.student_id} value={s.student_id}>
                {s.full_name} — {s.student_number} ({s.course})
              </option>
            ))}
          </select>
        </div>

        {/* Company */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Company</label>
          <select
            value={form.company_id}
            onChange={e => handleCompanyChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Select company</option>
            {companies.map(c => (
              <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
            ))}
          </select>
        </div>

        {/* Supervisor */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Supervisor</label>
          <select
            value={form.supervisor_id}
            onChange={e => setForm(f => ({ ...f, supervisor_id: e.target.value }))}
            disabled={!form.company_id}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          >
            <option value="">Select supervisor</option>
            {supervisors.map(s => {
  // Gracefully fallback to nested object format if the service uses the users join table
  const displayName = s.full_name || (s as any).users?.full_name || 'Unnamed Supervisor';
  
  return (
    <option key={s.supervisor_id} value={s.supervisor_id}>
      {displayName} — {s.position}
    </option>
  );
})}
          </select>
          {form.company_id && supervisors.length === 0 && (
            <p className="text-xs text-amber-600">No supervisors found for this company.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
          <Input label="End Date (optional)" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
        </div>

        {formError && <Alert type="error" message={formError} />}

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} loading={saving} className="flex-1">Create Assignment</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
