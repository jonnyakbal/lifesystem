import type { NextRequest } from 'next/server';
import { oauthJson, openBotAuthorizationPage, openBotOAuthPost } from '@/lib/mcp/openbot-oauth-http';

type Context = { params: Promise<{ operation: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { operation } = await context.params;
  return operation === 'authorize' ? openBotAuthorizationPage(request) : oauthJson({ error: 'not_found' }, 404);
}

export async function POST(request: NextRequest, context: Context) {
  return openBotOAuthPost(request, (await context.params).operation);
}
