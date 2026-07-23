import { getAuthUser } from '@/src/services/auth';

export default async function DashboardPage() {
  const user = await getAuthUser();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="text-slate-500 mt-1">Welcome back, {user?.full_name}.</p>
    </div>
  );
}
