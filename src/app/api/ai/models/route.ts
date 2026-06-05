import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const aiConfig = await dbService.getAIConfig();
    if (!aiConfig || !aiConfig.endpoint) {
      return NextResponse.json({ models: [] }); // return empty if not configured
    }

    const endpoint = aiConfig.endpoint.replace(/\/$/, ''); // strip trailing slash
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (aiConfig.apiKey) {
      headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
      headers['X-API-Key'] = aiConfig.apiKey;
    }

    // Attempt 1: Ollama native /api/tags
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
      const res = await fetch(`${endpoint}/api/tags`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.models)) {
          const models = data.models.map((m: any) => m.name);
          return NextResponse.json({ models });
        }
      }
    } catch (e) {
      console.warn("Failed fetching /api/tags from Ollama endpoint, attempting OpenAI compatibility path...", e);
    }

    // Attempt 2: OpenAI-compatible /v1/models
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${endpoint}/v1/models`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          const models = data.data.map((m: any) => m.id);
          return NextResponse.json({ models });
        }
      }
    } catch (e) {
      console.error("All Ollama endpoint fetch attempts failed:", e);
    }

    // Fallback: If connection fails but we want to return a list for testing/fallbacks
    return NextResponse.json({ 
      models: [], 
      warning: 'Could not connect to Ollama endpoint. Please check your URL/API Key and network availability.' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
