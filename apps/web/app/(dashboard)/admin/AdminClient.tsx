'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import Modal from '@/src/components/ui/Modal';
import {
  Users,
  Shield,
  Building,
  Clock,
  Megaphone,
  Check,
  X,
  AlertCircle,
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Key,
  Copy,
  CheckCheck,
} from '@/src/components/ui/Icons';
import {
  updateUserAccountStatus,
  createSystemUser,
  deleteSystemUser,
  adminResetUserPassword,
  listAllUsers,
  type UserManagementItem,
  type CreateSystemUserInput,
} from '@/src/services/admin';
import { createAnnouncement, listAnnouncements, deleteAnnouncement } from '@/src/services/announcements';
import type { DbAnnouncement } from '@ojt/shared';
import { listAuditLogs, type AuditLogItem } from '@/src/services/audit';
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

const PAGE_SIZE = 10;

const ROLE_TABS = [
  { id: 'all', label: 'All Roles' },
  { id: 'Student', label: 'Students' },
  { id: 'Supervisor', label: 'Supervisors' },
  { id: 'Coordinator', label: 'Coordinators' },
  { id: 'ProgramHead', label: 'Program Heads' },
  { id: 'Admin', label: 'Admins' },
] as const;

export default function AdminClient({ initialUsers, totalUsers: initialTotal, overview }: Props) {
  const [users, setUsers] = useState<UserManagementItem[]>(initialUsers);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tableLoading, setTableLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete User Modal State
  const [deleteTarget, setDeleteTarget] = useState<UserManagementItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Admin Direct Password Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserManagementItem | null>(null);
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [generatedPasswordResult, setGeneratedPasswordResult] = useState<string | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create Staff Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<CreateSystemUserInput>({
    full_name: '',
    email: '',
    password: '',
    role: 'Coordinator',
    department_or_program: 'ICS',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Announcement State
  const [anncTitle, setAnncTitle] = useState('');
  const [anncContent, setAnncContent] = useState('');
  const [anncDept, setAnncDept] = useState('All');
  const [anncLoading, setAnncLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<DbAnnouncement[]>([]);
  const [anncListLoading, setAnncListLoading] = useState(true);
  const [deleteAnncModalOpen, setDeleteAnncModalOpen] = useState(false);
  const [anncToDelete, setAnncToDelete] = useState<DbAnnouncement | null>(null);
  const [deleteAnncLoading, setDeleteAnncLoading] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const fetchUsers = useCallback(async (
    targetPage: number,
    targetRole: string,
    targetStatus: string,
    targetSearch: string
  ) => {
    setTableLoading(true);
    const res = await listAllUsers(targetPage, PAGE_SIZE, targetRole, targetStatus, targetSearch);
    setTableLoading(false);

    if (res.data) {
      setUsers(res.data.users);
      setTotalCount(res.data.total);
    }
  }, []);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
  }, [page, roleFilter, statusFilter, searchQuery, fetchUsers]);

  const loadAnnouncements = useCallback(async () => {
    setAnncListLoading(true);
    const res = await listAnnouncements();
    if (res.data) {
      setAnnouncements(res.data);
    }
    setAnncListLoading(false);
  }, []);

  useEffect(() => {
    loadAudit();
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function loadAudit() {
    setAuditLoading(true);
    const res = await listAuditLogs(1, 10);
    if (res.data?.logs) {
      setAuditLogs(res.data.logs);
    }
    setAuditLoading(false);
  }

  const handleDeleteAnnouncementClick = (annc: DbAnnouncement) => {
    setAnncToDelete(annc);
    setDeleteAnncModalOpen(true);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!anncToDelete) return;
    setDeleteAnncLoading(true);
    const res = await deleteAnnouncement(anncToDelete.announcement_id);
    setDeleteAnncLoading(false);
    setDeleteAnncModalOpen(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
    } else {
      setMsg({ type: 'success', text: `Announcement "${anncToDelete.title}" has been permanently removed.` });
      setAnncToDelete(null);
      loadAnnouncements();
      loadAudit();
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

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
      setMsg({ type: 'success', text: `User account status updated to ${newStatus}.` });
      loadAudit();
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    setDeleteError('');
    const res = await deleteSystemUser(deleteTarget.user_id);
    setDeleteLoading(false);

    if (res.error) {
      setDeleteError(res.error.message);
      return;
    }

    setMsg({
      type: 'success',
      text: `Successfully deleted account for ${deleteTarget.full_name} (${deleteTarget.email}).`,
    });
    setDeleteTarget(null);
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
    loadAudit();
  };
  const handleOpenResetPasswordModal = (u: UserManagementItem) => {
    setUserToReset(u);
    setCustomResetPassword(`CdM@${Math.floor(100000 + Math.random() * 900000)}!`);
    setGeneratedPasswordResult(null);
    setCopied(false);
    setResetModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    setCustomResetPassword(`CdM@${Math.floor(100000 + Math.random() * 900000)}!`);
  };

  const confirmAdminPasswordReset = async () => {
    if (!userToReset) return;
    setResetPasswordLoading(true);
    const res = await adminResetUserPassword(userToReset.user_id, customResetPassword);
    setResetPasswordLoading(false);

    if (res.error) {
      setMsg({ type: 'error', text: res.error.message });
    } else {
      const tempPw = res.data?.temporaryPassword || customResetPassword;
      setGeneratedPasswordResult(tempPw);
      setMsg({
        type: 'success',
        text: `Password for "${userToReset.full_name}" has been securely updated. Provide the temporary credentials to the user.`,
      });
      loadAudit();
    }
  };

  const handleCopyPassword = () => {
    if (generatedPasswordResult || customResetPassword) {
      navigator.clipboard.writeText(generatedPasswordResult || customResetPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    const res = await createSystemUser(staffForm);
    setCreateLoading(false);

    if (res.error) {
      setCreateError(res.error.message);
      return;
    }

    setMsg({
      type: 'success',
      text: `Successfully provisioned ${staffForm.role} account for ${staffForm.full_name}.`,
    });
    setCreateModalOpen(false);
    setStaffForm({
      full_name: '',
      email: '',
      password: '',
      role: 'Coordinator',
      department_or_program: 'ICS',
    });
    fetchUsers(page, roleFilter, statusFilter, searchQuery);
    loadAudit();
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
      setMsg({ type: 'success', text: 'Announcement broadcasted and alerts dispatched successfully!' });
      loadAnnouncements();
      loadAudit();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(totalCount, page * PAGE_SIZE);

  return (
    <div className="space-y-6 max-w-6xl p-8 page-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline mb-1.5 transition-colors cursor-pointer"
          >
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Administration</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage user accounts, provision academic staff, and broadcast campus announcements.
          </p>
        </div>
        <div>
          <Button
            onClick={() => { setCreateError(''); setCreateModalOpen(true); }}
            className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-sm cursor-pointer"
          >
            + Create Staff Account
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between gap-2 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.totalUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{overview.activeUsers} active accounts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{overview.pendingUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Awaiting verification</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.companiesCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active establishments</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recorded Shifts</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{overview.attendanceCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total verified logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Management Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">User Management & Status Control</h2>
              <p className="text-xs text-slate-500">
                Search, filter by role/status, activate, or permanently delete accounts.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 self-start sm:self-auto">
              Total {totalCount} account{totalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#0A3D24] focus:ring-1 focus:ring-[#0A3D24] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 outline-none focus:border-[#0A3D24] transition-colors cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {ROLE_TABS.map((tab) => {
                const isActive = roleFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleRoleChange(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0A3D24] text-[#FFCC00] shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Table */}
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
                  {tableLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">No users match the current criteria.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search query or role filter.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{u.full_name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs font-semibold">
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
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {u.account_status === 'pending' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 cursor-pointer"
                              onClick={() => handleStatusChange(u.user_id, 'active')}
                              disabled={loadingId === u.user_id}
                            >
                              Approve
                            </Button>
                          )}
                          {u.account_status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2.5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                              onClick={() => handleStatusChange(u.user_id, 'inactive')}
                              disabled={loadingId === u.user_id}
                            >
                              Deactivate
                            </Button>
                          )}
                          {u.account_status === 'inactive' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 cursor-pointer"
                              onClick={() => handleStatusChange(u.user_id, 'active')}
                              disabled={loadingId === u.user_id}
                            >
                              Reactivate
                            </Button>
                          )}
                          <button
                            title="Delete User"
                            onClick={() => { setDeleteError(''); setDeleteTarget(u); }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition-colors align-middle cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            {totalCount > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Showing <strong className="text-slate-700">{startIndex}</strong> to{' '}
                  <strong className="text-slate-700">{endIndex}</strong> of{' '}
                  <strong className="text-slate-700">{totalCount}</strong> users
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || tableLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-7 px-2 border-slate-200 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages || tableLoading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 px-2 border-slate-200 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Broadcast Announcement Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Broadcast Campus Announcement</h2>

          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Subject / Title</label>
                  <Input
                    placeholder="e.g. Practicum Orientation Schedule"
                    value={anncTitle}
                    onChange={(e) => setAnncTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Institute / Program</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900"
                    value={anncDept}
                    onChange={(e) => setAnncDept(e.target.value)}
                  >
                    <option value="All">All Departments (Campus-wide)</option>
                    <option value="ICS">Institute of Computing Studies (ICS)</option>
                    <option value="IBE">Institute of Business and Entrepreneurship (IBE)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Content</label>
                  <textarea
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900 min-h-[110px]"
                    placeholder="Enter the broadcast message for all system users..."
                    value={anncContent}
                    onChange={(e) => setAnncContent(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold cursor-pointer"
                  loading={anncLoading}
                >
                  <Megaphone className="w-4 h-4 mr-2" />
                  Publish Broadcast
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Announcements List & Deletion */}
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2.5 flex items-center justify-between">
              <span>Active Broadcasts ({announcements.length})</span>
              <button
                type="button"
                onClick={loadAnnouncements}
                className="text-xs font-bold text-[#0A3D24] hover:underline cursor-pointer"
              >
                Refresh
              </button>
            </h3>

            <Card className="border-slate-200/80 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {anncListLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading broadcasts...</div>
                ) : announcements.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active broadcasts currently posted.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                    {announcements.map((annc) => (
                      <div key={annc.announcement_id} className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-[#0A3D24] text-[#FFCC00] uppercase tracking-wider">
                              {annc.target_department === 'All' ? 'Campus-Wide' : `${annc.target_department} Dept`}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {new Date(annc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{annc.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{annc.content}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncementClick(annc)}
                          title="Permanently delete announcement"
                          className="text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* System Security & Audit Trail */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0A3D24]" />
            <h2 className="text-lg font-bold text-slate-900">System Activity & Security Audit Trail</h2>
          </div>
          <Button size="sm" variant="outline" onClick={loadAudit} disabled={auditLoading} className="text-xs h-7 cursor-pointer">
            Refresh Log
          </Button>
        </div>

        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {auditLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading audit records...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">No security audit events recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Administrative actions (account approvals, status changes, announcements, user deletions) are automatically logged.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Security Action</th>
                      <th className="px-4 py-3">Target Entity</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="font-semibold text-slate-800">{log.actor_name}</span>
                          <span className="text-[10px] text-slate-400 block">{log.actor_role}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 font-sans text-[11px]">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Delete User Confirmation */}
      <Modal
        title="Permanently Delete User Account"
        open={!!deleteTarget}
        onClose={() => { if (!deleteLoading) setDeleteTarget(null); }}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Warning: This action is permanent and irreversible.</p>
              <p className="text-red-700 leading-relaxed">
                Deleting this account will permanently revoke their access and remove their identity from Supabase Auth.
              </p>
            </div>
          </div>

          {deleteTarget && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">User Name:</span>
                <span className="font-bold text-slate-900">{deleteTarget.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email Address:</span>
                <span className="font-mono text-slate-700">{deleteTarget.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assigned Role:</span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {deleteTarget.role}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Current Status:</span>
                <span className="font-semibold text-slate-700 uppercase text-[10px]">
                  {deleteTarget.account_status}
                </span>
              </div>
            </div>
          )}

          {deleteError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {deleteError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={deleteLoading}
              onClick={() => setDeleteTarget(null)}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteLoading}
              onClick={handleDeleteUser}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Create Staff Account */}
      <Modal title="Provision Academic Staff Account" open={createModalOpen} onClose={() => setCreateModalOpen(false)}>
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Prof. Maria Santos"
            value={staffForm.full_name}
            onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
            required
          />

          <Input
            label="Institutional Email"
            type="email"
            placeholder="e.g. msantos@cdm.edu.ph"
            value={staffForm.email}
            onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
            required
          />

          <Input
            label="Temporary Password (Min. 8 characters)"
            type="password"
            placeholder="        "
            value={staffForm.password}
            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Account Role</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900"
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
              >
                <option value="Coordinator">OJT Coordinator</option>
                <option value="ProgramHead">Program Head</option>
                <option value="Admin">System Administrator</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Department / Institute</label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-900"
                value={staffForm.department_or_program}
                onChange={(e) => setStaffForm({ ...staffForm, department_or_program: e.target.value })}
              >
                <option value="ICS">Institute of Computing Studies (ICS)</option>
                <option value="IBE">Institute of Business and Entrepreneurship (IBE)</option>
              </select>
            </div>
          </div>

          {createError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {createError}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createLoading}
              className="flex-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold"
            >
              Create & Activate
            </Button>
          </div>
        </form>
      </Modal>
      {/* Admin Direct Password Reset Override Modal */}
      {resetModalOpen && userToReset && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 page-fade-in">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Direct Password Reset Override</h3>
                <p className="text-xs text-slate-500">Administrator Security Control</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs space-y-1">
              <p className="font-bold text-slate-800">{userToReset.full_name}</p>
              <p className="text-slate-600">{userToReset.email}</p>
              <p className="text-[10px] text-slate-400 pt-0.5">Role: <span className="font-bold uppercase text-[#0A3D24]">{userToReset.role}</span></p>
            </div>

            {!generatedPasswordResult ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Temporary Password</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[11px] font-bold text-[#0A3D24] hover:underline cursor-pointer"
                    >
                      🎲 Generate New
                    </button>
                  </div>
                  <Input
                    type="text"
                    value={customResetPassword}
                    onChange={(e) => setCustomResetPassword(e.target.value)}
                    placeholder="Enter minimum 8 characters..."
                    required
                  />
                  <p className="text-[11px] text-slate-400">
                    The user will be able to log in immediately and update this password in their Account Settings.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setResetModalOpen(false); setUserToReset(null); }}
                    disabled={resetPasswordLoading}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmAdminPasswordReset}
                    loading={resetPasswordLoading}
                    className="bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold cursor-pointer"
                  >
                    <Key className="w-4 h-4 mr-1.5" />
                    Apply Password Reset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 page-fade-in">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-900">
                    ✅ Password Reset Successfully Applied!
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Copy and provide these temporary login credentials to the user:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={generatedPasswordResult}
                      className="w-full font-mono font-bold text-sm bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-900 select-all outline-none"
                    />
                    <Button
                      size="sm"
                      onClick={handleCopyPassword}
                      className="shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                    >
                      {copied ? <CheckCheck className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => { setResetModalOpen(false); setUserToReset(null); setGeneratedPasswordResult(null); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white cursor-pointer font-bold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permanent Delete Announcement Confirmation Modal */}
      {deleteAnncModalOpen && anncToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 page-fade-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Broadcast Notice?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs space-y-1">
              <p className="font-bold text-slate-800">{anncToDelete.title}</p>
              <p className="text-slate-600 line-clamp-2">{anncToDelete.content}</p>
              <p className="text-[10px] text-slate-400 pt-1">
                Target: {anncToDelete.target_department === 'All' ? 'Campus-Wide' : anncToDelete.target_department} • {new Date(anncToDelete.created_at).toLocaleDateString()}
              </p>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Permanently deleting this announcement will remove it from all student, coordinator, and faculty dashboards across the system immediately.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDeleteAnncModalOpen(false); setAnncToDelete(null); }}
                disabled={deleteAnncLoading}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmDeleteAnnouncement}
                loading={deleteAnncLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Announcement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
