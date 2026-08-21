'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    <div className="space-y-6 max-w-6xl p-8 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline mb-2 transition-colors cursor-pointer"
          >
            ← Return to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">System Administration</h1>
          <p className="text-sm text-slate-500 mt-1">Manage user account statuses, broadcast announcements, and monitor system health.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            📊 Return to Dashboard
          </Link>
          <Badge className="bg-slate-900 text-white border-0 px-3 py-1.5">Administrator Portal</Badge>
        </div>
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Partner Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.companiesCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active establishments</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Logs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.attendanceCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Recorded attendances</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Management Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">User Management & Status Control</h2>
            <span className="text-xs font-medium text-slate-500">Showing {users.length} users</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{u.full_name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            u.account_status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : u.account_status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {u.account_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {u.account_status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                            onClick={() => handleStatusChange(u.user_id, 'active')}
                            disabled={loadingId === u.user_id}
                          >
                            Approve
                          </Button>
                        )}
                        {u.account_status === 'active' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7 px-2"
                            onClick={() => handleStatusChange(u.user_id, 'inactive')}
                            disabled={loadingId === u.user_id}
                          >
                            Deactivate
                          </Button>
                        )}
                        {u.account_status === 'inactive' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => handleStatusChange(u.user_id, 'active')}
                            disabled={loadingId === u.user_id}
                          >
                            Reactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* System Announcements */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Broadcast Announcement</h2>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <Input
                  label="Announcement Title"
                  placeholder="e.g. System Maintenance Notice"
                  value={anncTitle}
                  onChange={(e) => setAnncTitle(e.target.value)}
                  required
                />

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Department</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900"
                    value={anncDept}
                    onChange={(e) => setAnncDept(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    <option value="ICS">Institute of Computing Studies (ICS)</option>
                    <option value="IBE">Institute of Business and Entrepreneurship (IBE)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Content</label>
                  <textarea
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900 min-h-[120px]"
                    placeholder="Enter the broadcast message for all system users..."
                    value={anncContent}
                    onChange={(e) => setAnncContent(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold"
                  loading={anncLoading}
                >
                  <Megaphone className="w-4 h-4 mr-2" />
                  Publish Broadcast
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
