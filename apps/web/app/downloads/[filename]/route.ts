import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GITHUB_RELEASE_DOWNLOAD =
  'https://github.com/rogerforsho/OJT-MONITORING-AND-MANAGEMENT-SYSTEM/releases/download/v1.0.0/CdM-OJT-Portal-Setup-1.0.0.exe';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.toLowerCase().includes('cdm') || filename.toLowerCase().endsWith('.exe')) {
    return NextResponse.redirect(GITHUB_RELEASE_DOWNLOAD, 302);
  }

  return new NextResponse('File not found', { status: 404 });
}
