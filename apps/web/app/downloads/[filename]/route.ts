import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const GITHUB_RELEASES_URL =
  'https://github.com/rogerforsho/OJT-MONITORING-AND-MANAGEMENT-SYSTEM/releases';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.toLowerCase().includes('cdm') || filename.toLowerCase().endsWith('.exe')) {
    // Check if compiled desktop installer exists locally in desktop dist or public/downloads
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'downloads', filename),
      path.join(process.cwd(), '..', 'desktop', 'dist', filename),
      path.join(process.cwd(), '..', 'desktop', 'dist', 'CdM-OJT-Portal-Setup-1.0.0.exe'),
      path.join(process.cwd(), '..', 'desktop', 'dist', 'CdM OJT Portal Setup 1.0.0.exe'),
    ];

    for (const localPath of possiblePaths) {
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const fileStream = fs.createReadStream(localPath);
        // @ts-expect-error Next.js streaming response from readable stream
        return new NextResponse(fileStream, {
          headers: {
            'Content-Type': 'application/vnd.microsoft.portable-executable',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': stats.size.toString(),
          },
        });
      }
    }

    return NextResponse.redirect(GITHUB_RELEASES_URL, 302);
  }

  return new NextResponse('File not found', { status: 404 });
}
