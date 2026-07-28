'use client';

import { useEffect, useState, useCallback } from 'react';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import Modal from '@/src/components/ui/Modal';
import {
  listCompanies, createCompany, updateCompany, setCompanyStatus,
  type CompanyInput, type CompanyWithSupervisors,
} from '@/src/services/companies';

const EMPTY_FORM: CompanyInput = {
  company_name: '', address: '', contact_person: '', contact_email: '', contact_number: '',
};

const PAGE_SIZE = 20;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithSupervisors[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyWithSupervisors | null>(null);
  const [form, setForm] = useState<CompanyInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listCompanies(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setCompanies(result.data!.companies);
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(company: CompanyWithSupervisors) {
    setEditing(company);
    setForm({
      company_name: company.company_name,
      address: company.address,
      contact_person: company.contact_person,
      contact_email: company.contact_email,
      contact_number: company.contact_number,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError('');
    setSaving(true);
    const result = editing
      ? await updateCompany(editing.company_id, form)
      : await createCompany(form);
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    load(page);
  }

  async function handleToggleStatus(company: CompanyWithSupervisors) {
    const next = company.status === 'active' ? 'inactive' : 'active';
    const result = await setCompanyStatus(company.company_id, next);
    if (result.error) { setError(result.error.message); return; }
    load(page);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} company{total !== 1 ? 'ies' : 'y'} registered</p>
        </div>
        <Button onClick={openCreate}>+ Add Company</Button>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="text-4xl mb-3">🏢</span>
            <p className="text-sm">No companies yet. Add one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Company</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Contact Person</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Supervisors</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {companies.map(c => (
                <tr key={c.company_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{c.company_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.address}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{c.contact_person}</td>
                  <td className="px-5 py-4 text-slate-500">{c.contact_email}</td>
                  <td className="px-5 py-4 text-slate-700">{c.supervisors?.length ?? 0}</td>
                  <td className="px-5 py-4"><Badge status={c.status} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleToggleStatus(c)}
                        className={c.status === 'active' ? 'text-red-500 hover:bg-red-50' : ''}
                      >
                        {c.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? 'Edit Company' : 'Add Company'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <Input label="Company Name" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
        <Input label="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
        <Input label="Contact Person" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} required />
        <Input label="Contact Email" type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} required />
        <Input label="Contact Number" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} required />
        {formError && <Alert type="error" message={formError} />}
        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} loading={saving} className="flex-1">{editing ? 'Save Changes' : 'Add Company'}</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
