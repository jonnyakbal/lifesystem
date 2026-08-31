'use client';

// The Pilares content moved into Visão as a tab (item 9 of the queue —
// "unificar Visão + Pilares"). This route stays alive as a redirect so old
// bookmarks/links and the ⌘V/⌘P shortcuts both keep working.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PilaresRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/visao?tab=pilares'); }, [router]);
  return null;
}
