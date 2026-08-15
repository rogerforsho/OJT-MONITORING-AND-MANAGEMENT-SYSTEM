'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult, DbAnnouncement } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, user, profile };
}

export interface AnnouncementInput {
  title: string;
  content: string;
  target_role?: string;
  target_department?: string;
}

export async function listAnnouncements(): Promise<AppResult<DbAnnouncement[]>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load announcements.' } };

  return { data: (data ?? []) as DbAnnouncement[], error: null };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AppResult<DbAnnouncement>> {
  if (!input.title?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Title is required.' } };
  if (!input.content?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Content is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin'].includes(profile?.role ?? '') || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { data, error } = await service
    .from('announcements')
    .insert({
      author_user_id: user.id,
      title: input.title.trim(),
      content: input.content.trim(),
      target_role: input.target_role?.trim() || 'All',
      target_department: input.target_department?.trim() || 'All',
    })
    .select()
    .single();

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to publish announcement.' } };

  return { data: data as DbAnnouncement, error: null };
}

export async function deleteAnnouncement(announcement_id: string): Promise<AppResult<null>> {
  if (!announcement_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Announcement ID is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin'].includes(profile?.role ?? '') || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { error } = await service
    .from('announcements')
    .delete()
    .eq('announcement_id', announcement_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to delete announcement.' } };

  return { data: null, error: null };
}
