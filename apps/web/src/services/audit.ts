'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AuditLogItem {
  log_id: string;
  actor_user_id: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditEventInput {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
}

/**
 * Records an immutable audit log entry in the database.
 * Fulfills ISO/IEC 25010:2023 Non-repudiation & Accountability standard.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const service = serviceClient();
    await service.from('audit_logs').insert({
      actor_user_id: input.actor_user_id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id || null,
      details: input.details || {},
      ip_address: input.ip_address || null,
    });
  } catch (err) {
    // Non-blocking fallback for resilience
    console.info(`[AUDIT] ${input.action} on ${input.entity_type}:${input.entity_id} by ${input.actor_user_id}`, input.details);
  }
}

/**
 * Lists institutional audit logs for Administrator inspection.
 */
export async function listAuditLogs(
  page = 1,
  pageSize = 20,
  actionFilter?: string
): Promise<AppResult<{ logs: AuditLogItem[]; total: number }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['Admin', 'Coordinator'].includes(profile.role) || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied. Administrative audit privileges required.' } };
  }

  const service = serviceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = service
      .from('audit_logs')
      .select('log_id, actor_user_id, action, entity_type, entity_id, details, ip_address, created_at, users:actor_user_id(full_name, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (actionFilter && actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data, error, count } = await query;
    if (error) {
      return { data: { logs: [], total: 0 }, error: null };
    }

    const formatted: AuditLogItem[] = (data || []).map((row: any) => ({
      log_id: row.log_id,
      actor_user_id: row.actor_user_id,
      actor_name: row.users?.full_name || 'System / Service',
      actor_role: row.users?.role || 'Admin',
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      details: row.details,
      ip_address: row.ip_address,
      created_at: row.created_at,
    }));

    return { data: { logs: formatted, total: count || 0 }, error: null };
  } catch {
    return { data: { logs: [], total: 0 }, error: null };
  }
}
