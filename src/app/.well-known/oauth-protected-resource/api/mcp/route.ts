import { ISSUER, RESOURCE, openBotOAuthConfig } from '@/lib/mcp/openbot-oauth';
import { oauthJson } from '@/lib/mcp/openbot-oauth-http';

export function GET() {
  const config = openBotOAuthConfig();
  return config ? oauthJson({
    resource: RESOURCE,
    resource_name: 'LifeSystem',
    authorization_servers: [ISSUER],
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopes,
  }) : oauthJson({ error: 'not_found' }, 404);
}
