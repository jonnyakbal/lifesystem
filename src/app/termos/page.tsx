import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Serviço | LIFESYSTEM',
  description: 'Termos de uso do LIFESYSTEM.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#070A1C] px-5 py-12 text-slate-100 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur sm:p-10">
        <Link href="/" className="text-sm font-semibold text-violet-300 hover:text-violet-200">LIFESYSTEM</Link>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Termos de Serviço</h1>
        <p className="mt-3 text-sm text-slate-400">Última atualização: 16 de setembro de 2026</p>

        <div className="mt-9 space-y-7 leading-7 text-slate-300">
          <section><h2 className="text-xl font-semibold text-white">Uso do serviço</h2><p className="mt-2">O LIFESYSTEM é uma ferramenta pessoal de organização. Você é responsável pelos dados que cria, pelas decisões tomadas a partir deles e pela segurança das credenciais de acesso à sua instância.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Integrações</h2><p className="mt-2">Integrações como Google Agenda dependem da sua autorização e das políticas do serviço integrado. Você pode revogar esse acesso a qualquer momento pela sua Conta Google.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Disponibilidade</h2><p className="mt-2">Buscamos manter o serviço disponível e seguro, mas integrações externas, rede e provedores de infraestrutura podem afetar o funcionamento temporariamente.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Alterações</h2><p className="mt-2">Podemos atualizar estes termos para refletir melhorias no produto ou mudanças legais. A versão atual estará sempre disponível nesta página.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Contato</h2><p className="mt-2">Fale com a equipe pelo e-mail <a className="text-violet-300 hover:text-violet-200" href="mailto:jonnyakbal@gmail.com">jonnyakbal@gmail.com</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
