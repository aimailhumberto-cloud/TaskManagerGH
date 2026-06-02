import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const apiKey = request.headers.get('x-api-key');
  return NextResponse.json({
    valid: true,
    key: apiKey,
    role: 'administrator',
  });
}
