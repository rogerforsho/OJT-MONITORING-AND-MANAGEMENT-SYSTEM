'use client';

import { useEffect, useState, useCallback } from 'react';
import Alert from '@/src/components/ui/Alert';
import Badge from '@/src/components/ui/Badge';
import Button from '@/src/components/ui/Button';
import Modal from '@/src/components/ui/Modal';
import { endAttendance, getCurrentAttendanceSession, listOwnAttendance, startAttendance } from '@/src/services/attendance';
import type { DbAttendance } from '@ojt/shared';

const PAGE_SIZE = 20;

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<DbAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSession, setActiveSession] = useState<DbAttendance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [selfieReference, setSelfieReference] = useState('manual-entry');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    const result = await listOwnAttendance(p, PAGE_SIZE);
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setRecords(result.data!.records);
    setTotal(result.data!.total);
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await getCurrentAttendanceSession();
    if (!result.error) setActiveSession(result.data?.record ?? null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (isMounted) {
        await load(page);
        await refreshSession();
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [page, load, refreshSession]);

  async function handleSave() {
    setFormError('');
    setSaving(true);
    const result = mode === 'in'
      ? await startAttendance({ selfie_path: selfieReference.trim() || 'manual-entry' })
      : await endAttendance(activeSession!.attendance_id, { selfie_path: selfieReference.trim() || 'manual-entry' });
    setSaving(false);
    if (result.error) { setFormError(result.error.message); return; }
    setModalOpen(false);
    setSelfieReference('manual-entry');
    await load(page);
    await refreshSession();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance History</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your time-in and time-out records for internship hours.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setMode('in'); setModalOpen(true); }} disabled={!!activeSession}>Clock In</Button>
          <Button variant="ghost" onClick={() => { setMode('out'); setModalOpen(true); }} disabled={!activeSession}>Clock Out</Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Attendance workflow</h2>
          <p className="mt-2 text-sm text-slate-600">Follow these steps each day to log your internship attendance and keep your supervisor updated.</p>
          <ol className="mt-4 space-y-3 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-900">1.</span> Clock in when you arrive at your assigned company.</li>
            <li><span className="font-semibold text-slate-900">2.</span> Clock out before leaving to complete the session.</li>
            <li><span className="font-semibold text-slate-900">3.</span> Your supervisor verifies your attendance.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Current status</h2>
          <p className="mt-2 text-sm text-slate-600">
            {activeSession
              ? 'You are currently clocked in. Please clock out when your session is finished.'
              : 'You are not currently clocked in. Use the Clock In button to start a new attendance session.'}
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Active session</p>
            <p className="mt-1">{activeSession ? 'Open and awaiting clock out.' : 'No active attendance session today.'}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-800">
        {activeSession ? 'You currently have an active attendance session for today.' : 'No active attendance session for today.'}
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

      <Modal title={mode === 'in' ? 'Clock In' : 'Clock Out'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Selfie reference</label>
          <input
            value={selfieReference}
            onChange={e => setSelfieReference(e.target.value)}
            placeholder="manual-entry"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-xs text-slate-400">This keeps the attendance flow moving while the mobile camera capture is being wired up.</p>
        </div>
        {formError && <Alert type="error" message={formError} />}
        <div className="flex gap-3 pt-1">
          <Button onClick={handleSave} loading={saving} className="flex-1">{mode === 'in' ? 'Clock In' : 'Clock Out'}</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
