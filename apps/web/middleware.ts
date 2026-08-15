import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/auth/sign-in', '/auth/register', '/auth/pending', '/auth/reset-password', '/auth/callback'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p));

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

  // Authenticated — redirect away from auth pages (except reset-password, callback, and pending approval)
  if (
    user &&
    isPublic &&
    !path.startsWith('/auth/reset-password') &&
    !path.startsWith('/auth/callback') &&
    !path.startsWith('/auth/pending')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
