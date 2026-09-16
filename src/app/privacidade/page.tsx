import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | LIFESYSTEM',
  description: 'Como o LIFESYSTEM trata seus dados pessoais e integrações.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#070A1C] px-5 py-12 text-slate-100 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur sm:p-10">
        <Link href="/" className="text-sm font-semibold text-violet-300 hover:text-violet-200">LIFESYSTEM</Link>
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-slate-400">Última atualização: 16 de setembro de 2026</p>

        <div className="mt-9 space-y-7 leading-7 text-slate-300">
          <section><h2 className="text-xl font-semibold text-white">O que armazenamos</h2><p className="mt-2">O LIFESYSTEM armazena os dados que você cria no aplicativo, como tarefas, notas, projetos, metas, registros financeiros, diário e capturas. Esses dados existem para organizar seu sistema pessoal.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Google Agenda</h2><p className="mt-2">Quando você conecta o Google Agenda, o LIFESYSTEM recebe permissão para criar e editar eventos na sua agenda principal apenas quando você escolhe converter uma captura em evento. O token de acesso é criptografado no servidor. Não lemos nem vendemos o conteúdo da sua agenda.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Uso e compartilhamento</h2><p className="mt-2">Não vendemos dados pessoais e não compartilhamos seus dados com anunciantes. Integrações externas só recebem os dados necessários para executar a ação que você solicitou.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Segurança e retenção</h2><p className="mt-2">Os dados são protegidos por autenticação e por controles de acesso no servidor. Você pode excluir itens dentro do aplicativo e revogar a conexão com o Google a qualquer momento nas permissões da sua Conta Google.</p></section>
          <section><h2 className="text-xl font-semibold text-white">Contato</h2><p className="mt-2">Para dúvidas sobre privacidade ou solicitação de exclusão, entre em contato pelo e-mail <a className="text-violet-300 hover:text-violet-200" href="mailto:jonnyakbal@gmail.com">jonnyakbal@gmail.com</a>.</p></section>
        </div>
      </article>
    </main>
  );
}
