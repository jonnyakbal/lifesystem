import { ISSUER, OAUTH_PATH, openBotOAuthConfig } from '@/lib/mcp/openbot-oauth';
import { oauthJson } from '@/lib/mcp/openbot-oauth-http';

export function GET() {
  const config = openBotOAuthConfig();
  if (!config) return oauthJson({ error: 'not_found' }, 404);
  const endpoints = ISSUER + OAUTH_PATH;
  return oauthJson({
    issuer: ISSUER,
    authorization_endpoint: endpoints + '/authorize',
    token_endpoint: endpoints + '/token',
    revocation_endpoint: endpoints + '/revoke',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: config.scopes,
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
  });
}
