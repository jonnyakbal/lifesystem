import Link from 'next/link';
import type { ReactNode } from 'react';

// Moldura das páginas públicas de Termos e Privacidade: cores do tema (claro,
// escuro e Retrô), texto corrido em coluna de leitura e atalho entre as duas.
export function LegalPage({ title, updatedAt, current, children }: {
  title: string; updatedAt: string; current: 'termos' | 'privacidade'; children: ReactNode;
}) {
  return <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:px-8">
    <article className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm font-semibold text-primary hover:underline">LIFESYSTEM</Link>
      <h1 className="mt-6 font-display text-4xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
      <div className="mt-10 space-y-8 leading-7 text-foreground/85">{children}</div>
      <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
        {current === 'termos' ? <Link href="/privacidade" className="hover:text-foreground">Política de Privacidade</Link> : <Link href="/termos" className="hover:text-foreground">Termos de Serviço</Link>}
        <a href="mailto:jonnyakbal@gmail.com" className="hover:text-foreground">jonnyakbal@gmail.com</a>
      </footer>
    </article>
  </main>;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="text-lg font-semibold text-foreground">{title}</h2><div className="mt-2 space-y-3">{children}</div></section>;
}
