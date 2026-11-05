import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Termos de Serviço | LIFESYSTEM',
  description: 'Termos de uso do LIFESYSTEM.',
};

export default function TermsPage() {
  return <LegalPage title="Termos de Serviço" updatedAt="4 de novembro de 2026" current="termos">
    <LegalSection title="Uso do serviço">
      <p>O LIFESYSTEM é uma ferramenta pessoal de organização. Você é responsável pelos dados que cria, pelas decisões tomadas a partir deles e pela segurança das credenciais e chaves de acesso à sua instância.</p>
    </LegalSection>
    <LegalSection title="Agentes e inteligência artificial">
      <p>Respostas de IA e de agentes são sugestões. Nenhum agente muda seus dados por conta própria: mudanças passam por uma proposta que você aprova na tela, e cada mudança aplicada deixa um recibo. Registros de saúde não são diagnóstico nem orientação médica.</p>
    </LegalSection>
    <LegalSection title="Integrações">
      <p>Integrações como Google Agenda e Apple Saúde dependem da sua autorização e das políticas do serviço integrado. Você pode revogar o Google pela sua Conta Google e a chave do Apple Saúde em Configurações → Integrações.</p>
    </LegalSection>
    <LegalSection title="Disponibilidade">
      <p>Buscamos manter o serviço disponível e seguro, mas integrações externas, provedores de IA, rede e infraestrutura podem afetar o funcionamento temporariamente.</p>
    </LegalSection>
    <LegalSection title="Alterações">
      <p>Podemos atualizar estes termos para refletir melhorias no produto ou mudanças legais. A versão atual fica sempre nesta página, com a data da última atualização.</p>
    </LegalSection>
  </LegalPage>;
}
