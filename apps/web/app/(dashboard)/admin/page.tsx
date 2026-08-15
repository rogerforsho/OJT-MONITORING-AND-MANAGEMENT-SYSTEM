import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import { listAllUsers, getSystemOverview } from '@/src/services/admin';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/sign-in');

  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'Admin' || profile?.account_status !== 'active') {
    redirect('/dashboard');
  }

  const [usersResult, overviewResult] = await Promise.all([
    listAllUsers(1, 100),
    getSystemOverview(),
  ]);

  const initialUsers = usersResult.data?.users ?? [];
  const totalUsers = usersResult.data?.total ?? 0;
  const overview = overviewResult.data ?? {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    companiesCount: 0,
    attendanceCount: 0,
    roleBreakdown: {},
  };

  return <AdminClient initialUsers={initialUsers} totalUsers={totalUsers} overview={overview} />;
}
