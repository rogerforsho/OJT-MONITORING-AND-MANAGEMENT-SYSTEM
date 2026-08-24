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
  const { user, profile } = await getAuthUserWithRole();
  if (!user || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { data, error } = await service
    .from('announcements')
    .select('announcement_id, author_user_id, title, content, target_role, target_department, created_at')
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
  const targetRole = input.target_role?.trim() || 'All';
  const targetDept = input.target_department?.trim() || 'All';

  const { data, error } = await service
    .from('announcements')
    .insert({
      author_user_id: user.id,
      title: input.title.trim(),
      content: input.content.trim(),
      target_role: targetRole,
      target_department: targetDept,
    })
    .select()
    .single();

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to publish announcement.' } };

  // Fan out individual notification alerts to active recipients
  try {
    let usersQuery = service.from('users').select('user_id, role').eq('account_status', 'active');
    if (targetRole !== 'All') {
      usersQuery = usersQuery.eq('role', targetRole);
    }
    const { data: targetUsers } = await usersQuery;
    if (targetUsers && targetUsers.length > 0) {
      const notifPayload = targetUsers.map((u) => ({
        receiver_user_id: u.user_id,
        message: `📢 [Announcement] ${input.title.trim()}: ${input.content.trim().slice(0, 100)}${input.content.length > 100 ? '...' : ''}`,
        notification_date: new Date().toISOString(),
        status: 'unread',
      }));
      await service.from('notifications').insert(notifPayload);
    }
  } catch {
    // Non-blocking notification dispatch
  }

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
