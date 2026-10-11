// This public URL must point to the same environment as EXPO_PUBLIC_SUPABASE_URL.
export function getWebPortalUrl(path: string): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (!configured) throw new Error('Account services are not configured. Contact your coordinator.');
  const base = new URL(configured);
  if (base.protocol !== 'https:' && !(typeof __DEV__ !== 'undefined' && __DEV__ && base.protocol === 'http:')) {
    throw new Error('Account services require a secure connection.');
  }
  return new URL(path, base.origin).toString();
}
