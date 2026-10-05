import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const smtpConfig = await dbService.getSMTPConfig();
    const aiConfig = await dbService.getAIConfig();
    return NextResponse.json({ smtpConfig: { ...smtpConfig, pass: '', hasPassword: !!smtpConfig.pass }, aiConfig: { ...aiConfig, apiKey: '', hasApiKey: !!aiConfig.apiKey } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { host, port, user, pass, endpoint, apiKey, activeModel } = body;

    if (host !== undefined && port !== undefined) {
      if (!host || isNaN(Number(port))) {
        return NextResponse.json({ error: 'SMTP Host and Port are mandatory' }, { status: 400 });
      }
      const current = await dbService.getSMTPConfig();
      const updated = {
        ...current,
        host,
        port: Number(port),
        user: user !== undefined ? String(user).trim() : current.user,
        pass: pass !== undefined ? String(pass) : current.pass,
      };
      await dbService.updateSMTPConfig(updated);
      return NextResponse.json({ success: true, smtpConfig: { ...updated, pass: '', hasPassword: !!updated.pass } });
    } else if (endpoint !== undefined) {
      const updated = {
        endpoint: String(endpoint).trim(),
        apiKey: String(apiKey || '').trim(),
        activeModel: String(activeModel || '').trim()
      };
      await dbService.updateAIConfig(updated);
      return NextResponse.json({ success: true, aiConfig: { ...updated, apiKey: '', hasApiKey: !!updated.apiKey } });
    }

    return NextResponse.json({ error: 'Invalid config payload' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
