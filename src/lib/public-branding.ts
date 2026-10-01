import { workspaceConfig } from './workspace-config';
import type { MetadataRoute } from 'next';

function publicLabel(value: unknown, fallback: string, maximum: number): string {
  if (typeof value !== 'string') return fallback;
  const label = value.trim();
  return label && label.length <= maximum && !/[\u0000-\u001f\u007f]/.test(label) ? label : fallback;
}

export function getPublicManifest(config: Record<string, unknown> = workspaceConfig): MetadataRoute.Manifest {
  const branding = getPublicBranding(config);
  return {
    name: branding.name,
    short_name: branding.name,
    description: branding.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#040614',
    theme_color: '#8B5CF6',
    orientation: 'portrait-primary',
    categories: ['productivity', 'lifestyle', 'business'],
    icons: [
      { src: branding.icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/solar-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/solar-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/solar-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

// Deliberate public projection: private workspace settings are never serialized.
// Icons remain local and fixed; arbitrary avatar/icon URLs are not accepted.
export function getPublicBranding(config: Record<string, unknown> = workspaceConfig) {
  return {
    name: publicLabel(config.name, workspaceConfig.name, 120),
    tagline: publicLabel(config.tagline, workspaceConfig.tagline, 200),
    icon: '/icons/solar.svg',
    appleIcon: '/icons/solar-apple.png',
  };
}
