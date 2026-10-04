import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/auth/sign-in', '/auth/register', '/auth/pending', '/auth/reset-password', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
  // Keep HTTPS enforcement for deployed hosts while allowing local next start.
  if (
    process.env.NODE_ENV === 'production' && !isLoopback &&
    request.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // Load balancer probes must not depend on a user session.
  if (path === '/health' || path === '/ready') return supabaseResponse;
  
  // Public routes: root landing page, credential verification, public downloads, and auth screens
  const isPublic = 
    path === '/' || path === '/robots.txt' || path === '/sitemap.xml' ||
    path.startsWith('/verify-certificate') ||
    path.startsWith('/downloads') ||
    PUBLIC_PATHS.some(p => path.startsWith(p));

  // If Supabase credentials are missing or default placeholder, allow public paths
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
    if (!isPublic) {
      return NextResponse.redirect(new URL('/auth/sign-in', request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  // Unauthenticated — redirect to sign in unless on public path
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  // Authenticated — redirect away from sign-in and register pages
  if (
    user &&
    (path === '/auth/sign-in' || path === '/auth/register')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Defense-in-Depth: Route-Level Role-Based Access Control (RBAC) Guard
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users').select('role, account_status').eq('user_id', user.id).single();
    if ((profileError || !profile || profile.account_status !== 'active') && !isPublic) {
      return NextResponse.redirect(new URL('/auth/pending', request.url));
    }
    const role = profile?.account_status === 'active' ? profile.role : null;
    const isRoleGuardedPath =
      path.startsWith('/admin') ||
      path.startsWith('/coordinator') ||
      path.startsWith('/supervisor') ||
      path.startsWith('/program-head') ||
      path.startsWith('/student');

    if (!role && isRoleGuardedPath) {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }

    if (path.startsWith('/admin') && role !== 'Admin') {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }
    if (path.startsWith('/coordinator') && !['Coordinator', 'Admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }
    if (path.startsWith('/supervisor') && !['CompanySupervisor', 'Supervisor', 'Admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }
    if (path.startsWith('/program-head') && !['ProgramHead', 'Admin'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }
    if (path.startsWith('/student') && role !== 'Student' && role !== 'Admin') {
      return NextResponse.redirect(new URL('/dashboard?reason=unauthorized', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
