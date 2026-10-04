import { getServiceClient } from '@/src/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const service = getServiceClient();
    // This table exists only after migration 028, which the web auth actions require.
    const { error } = await service
      .from('auth_rate_limits')
      .select('action', { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw error;
    const { data: bucket, error: bucketError } = await service.storage.getBucket('attendance-selfies');
    if (bucketError || bucket?.public !== false) throw bucketError || new Error('Selfie bucket is public');
    return Response.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
