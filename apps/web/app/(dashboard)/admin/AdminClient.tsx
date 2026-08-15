'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Users, Shield, Building, Clock, Megaphone, Check, X, AlertCircle } from '@/src/components/ui/Icons';
import { updateUserAccountStatus, type UserManagementItem } from '@/src/services/admin';
import { createAnnouncement } from '@/src/services/announcements';
import type { AccountStatus } from '@ojt/shared';

interface Props {
  initialUsers: UserManagementItem[];
  totalUsers: number;
  overview: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    companiesCount: number;
    attendanceCount: number;
    roleBreakdown: Record<string, number>;
  };
}

export default function AdminClient({ initialUsers, totalUsers, overview }: Props) {
  const [users, setUsers] = useState<UserManagementItem[]>(initialUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Announcement State
  const [anncTitle, setAnncTitle] = useState('');
  const [anncContent, setAnncContent] = useState('');
  const [anncDept, setAnncDept] = useState('All');
  const [anncLoading, setAnncLoading] = useState(false);

  const handleStatusChange = async (userId: string, newStatus: AccountStatus) => {
    setLoadingId(userId);
    setMsg(null);
    const result = await updateUserAccountStatus(userId, newStatus);
    setLoadingId(null);

    if (result.error) {
      setMsg({ type: 'error', text: result.error.message });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, account_status: newStatus } : u))
      );
      setMsg({ type: 'success', text: `User status updated to ${newStatus}.` });
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anncTitle.trim() || !anncContent.trim()) return;

    setAnncLoading(true);
    setMsg(null);
    const result = await createAnnouncement({
      title: anncTitle,
      content: anncContent,
      target_department: anncDept,
      target_role: 'All',
    });
    setAnncLoading(false);

    if (result.error) {
      setMsg({ type: 'error', text: result.error.message });
    } else {
      setAnncTitle('');
      setAnncContent('');
      setMsg({ type: 'success', text: 'Announcement broadcasted successfully!' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Administration</h1>
          <p className="text-sm text-slate-500 mt-1">Manage user account statuses, broadcast announcements, and monitor system health.</p>
        </div>
        <Badge className="bg-slate-900 text-white border-0 px-3 py-1">Administrator Portal</Badge>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.totalUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{overview.activeUsers} active accounts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.pendingUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Awaiting activation</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Host Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.companiesCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Registered partners</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Logs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.attendanceCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total sessions recorded</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Account Management Table (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" /> Account Management
            </h2>
            <Badge variant="outline" className="text-xs">{users.length} shown</Badge>
          </div>

          <Card className="border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{u.full_name || 'No Name'}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs bg-slate-50">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            u.account_status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs'
                              : u.account_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 text-xs'
                              : 'bg-red-50 text-red-700 border-red-200 text-xs'
                          }
                        >
                          {u.account_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.account_status !== 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loadingId === u.user_id}
                              onClick={() => handleStatusChange(u.user_id, 'active')}
                              className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            >
                              Activate
                            </Button>
                          )}
                          {u.account_status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loadingId === u.user_id}
                              onClick={() => handleStatusChange(u.user_id, 'inactive')}
                              className="h-7 px-2 text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Broadcast Announcement Form (1 col) */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" /> Broadcast Announcement
          </h2>

          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Title</label>
                  <Input
                    required
                    placeholder="e.g., OJT Orientation Schedule"
                    value={anncTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnncTitle(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Department</label>
                  <select
                    value={anncDept}
                    onChange={(e) => setAnncDept(e.target.value)}
                    className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800"
                  >
                    <option value="All">All Departments</option>
                    <option value="ICS">Institute of Computing Studies (ICS)</option>
                    <option value="IBE">Institute of Business & Entrepreneurship (IBE)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Content / Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter announcement details..."
                    value={anncContent}
                    onChange={(e) => setAnncContent(e.target.value)}
                    className="w-full text-sm rounded-md border border-slate-200 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={anncLoading}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white text-sm"
                >
                  {anncLoading ? 'Publishing...' : 'Publish Announcement'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
