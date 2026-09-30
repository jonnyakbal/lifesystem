'use client';
import { useEffect, useState } from 'react';
import { categories as defaults } from '@/lib/finance-model';
import type { FinancialCategory } from '@/lib/financial-categories';
export function useCategoryCatalog() {
  const [catalog, setCatalog] = useState<FinancialCategory[]>([]);
  useEffect(() => { fetch('/api/financial-categories').then(response => response.ok ? response.json() : []).then(setCatalog).catch(() => undefined); }, []);
  return { catalog, categories: catalog.length ? Object.fromEntries(Object.keys(defaults).map(type => [type, catalog.filter(item => item.type === type && !item.archived).map(item => item.name)])) as typeof defaults : defaults };
}
