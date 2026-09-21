import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { getDeploymentMapData } from '@/src/services/companies';
import DeploymentMapClient from '@/src/components/map/DeploymentMapClient';

export const metadata: Metadata = {
  title: 'Regional Deployment & Geofence Map',
};

export default async function DeploymentMapPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect('/auth/sign-in');
  }

  // Permitted supervisory roles: Coordinator, Program Head, Admin
  if (!['Coordinator', 'ProgramHead', 'Admin'].includes(user.role)) {
    redirect('/dashboard');
  }

  const result = await getDeploymentMapData();
  const companies = result.data?.companies ?? [];

  return (
    <DeploymentMapClient
      initialCompanies={companies}
      userRole={user.role}
    />
  );
}
