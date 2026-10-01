import { test, expect } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getPublicBranding, getPublicManifest } from '../src/lib/public-branding';
import { workspaceConfig } from '../src/lib/workspace-config';
import { GET as publicManifest } from '../src/app/manifest.json/route';

test('public branding projects only presentation fields and fixed public icon URLs', () => {
  const branding = getPublicBranding({
    name: 'Espaço Aurora', tagline: 'Um pequeno avanço por dia',
    hiddenModules: ['/financeiro'], password: 'synthetic-private-marker',
    avatarUrl: 'javascript:alert(1)', icon: '//untrusted.example/icon.svg',
  });
  expect(branding).toEqual({ name: 'Espaço Aurora', tagline: 'Um pequeno avanço por dia', icon: '/icons/solar.svg', appleIcon: '/icons/solar-apple.png' });
  expect(JSON.stringify(branding)).not.toContain('synthetic-private-marker');
  expect(JSON.stringify(branding)).not.toContain('untrusted.example');
});

test('public branding trims labels, rejects invalid types and uses configured defaults', () => {
  expect(getPublicBranding({ name: '  Aurora  ', tagline: '  Dia a dia  ' })).toMatchObject({ name: 'Aurora', tagline: 'Dia a dia' });
  expect(getPublicBranding({ name: '', tagline: { private: true } })).toMatchObject({ name: workspaceConfig.name, tagline: workspaceConfig.tagline });
  expect(getPublicBranding({ name: 'x'.repeat(121), tagline: '\u0000' })).toMatchObject({ name: workspaceConfig.name, tagline: workspaceConfig.tagline });
});

test('brand labels remain text when rendered and never inject HTML', () => {
  const branding = getPublicBranding({ name: '<script>alert("brand")</script>', tagline: 'Texto & companhia' });
  const html = renderToStaticMarkup(createElement('h1', {}, branding.name));
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});

test('PWA manifest uses the public brand and preserves local install icons', () => {
  const manifest = getPublicManifest({ name: 'Espaço Aurora', tagline: 'Um pequeno avanço por dia', avatarUrl: 'https://untrusted.example/private.png' });
  expect(manifest).toMatchObject({ name: 'Espaço Aurora', short_name: 'Espaço Aurora', description: 'Um pequeno avanço por dia', start_url: '/', display: 'standalone' });
  expect(manifest.icons).toContainEqual({ src: '/icons/solar.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' });
  expect(manifest.icons).toContainEqual({ src: '/icons/solar-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  expect(JSON.stringify(manifest)).not.toContain('untrusted.example');
});

test('public manifest route returns presentation metadata without private workspace settings', async () => {
  const response = publicManifest();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/manifest+json');
  const manifest = await response.json();
  expect(manifest.name).toBe(workspaceConfig.name);
  expect(manifest.description).toBe(workspaceConfig.tagline);
  expect(manifest).not.toHaveProperty('hiddenModules');
  expect(manifest).not.toHaveProperty('avatarUrl');
});
