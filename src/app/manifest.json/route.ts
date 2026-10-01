import { getPublicManifest } from '@/lib/public-branding';

// Public install metadata only. Never read the user's authenticated preferences.
export function GET() {
  return Response.json(getPublicManifest(), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' },
  });
}
