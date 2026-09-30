'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { getContinuations } from '@/lib/navigation';
import { workspaceConfig } from '@/lib/workspace-config';

export function WorkspaceContinuations() {
  const paths = getContinuations(usePathname(), workspaceConfig.hiddenModules);
  if (!paths.length) return null;

  return <nav className="work-heading-paths" aria-label="Continue pelo seu espaço">
    <span>Próximos caminhos</span>
    {paths.map(item => <Link key={item.href} href={item.href}>
      <item.icon size={14} strokeWidth={1.8} aria-hidden="true" />
      {item.title}
      <ArrowUpRight size={13} aria-hidden="true" />
    </Link>)}
  </nav>;
}
