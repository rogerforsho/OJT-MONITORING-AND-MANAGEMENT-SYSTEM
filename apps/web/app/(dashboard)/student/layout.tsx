import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';

export const metadata: Metadata = {
  title: 'Student Portal',
};

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  if (!['Student', 'Coordinator', 'Admin'].includes(user.role) || user.account_status !== 'active') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
