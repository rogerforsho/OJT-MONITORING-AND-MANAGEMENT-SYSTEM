import { uploadStudentIdCard } from '@/src/services/auth';
export const runtime = 'nodejs';
const MAX_BODY = 6 * 1024 * 1024;
export async function POST(request: Request) {
  const error = (message: string, status: number) => Response.json({ data: null, error: { code: 'VALIDATION_FAILURE', message } }, { status });
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return error('Expected a file upload.', 400);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return error('Upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) return error('Missing upload.', 400);
  const timeout = setTimeout(() => { void reader.cancel('Upload timed out.'); }, 15000);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return error('Upload is too large.', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
    const result = await uploadStudentIdCard(form);
    return Response.json(result, { status: result.error ? result.error.code === 'RATE_LIMITED' ? 429 : result.error.code === 'SERVER_FAILURE' ? 503 : 400 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch { return error('The upload could not be read. Please try again.', 400); }
  finally { clearTimeout(timeout); reader.releaseLock(); }
}
