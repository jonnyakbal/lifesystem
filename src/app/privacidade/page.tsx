import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Política de Privacidade | LIFESYSTEM',
  description: 'Como o LIFESYSTEM trata seus dados pessoais e integrações.',
};

// Texto descreve o sistema conferido no código em 04/11/2026 (docs/polimento-visual.md, P1–P8).
export default function PrivacyPage() {
  return <LegalPage title="Política de Privacidade" updatedAt="4 de novembro de 2026" current="privacidade">
    <LegalSection title="O que armazenamos">
      <p>O LIFESYSTEM guarda o que você cria nele: tarefas, projetos, notas, capturas, metas, registros financeiros, diário, conteúdos, editais e as revisões semanais. Esses dados existem para organizar o seu sistema pessoal e não são usados para outra finalidade.</p>
    </LegalSection>
    <LegalSection title="Dados de saúde">
      <p>Em Corpo & saúde ficam observações como sono, peso, água, refeições, movimento, energia e estresse. Pela LGPD, são dados pessoais sensíveis. Eles só entram por você, por propostas do agente Órion que você aprova na tela, ou pelo Apple Saúde, se você ligar essa integração. Nada disso é diagnóstico: são registros, e a falta de registro continua sendo desconhecida.</p>
      <p>A integração com o Apple Saúde usa uma automação do app Atalhos no seu iPhone e uma chave criada por você em Configurações → Integrações. Guardamos só o hash da chave; você pode trocá-la ou revogá-la a qualquer momento. O que entra fica marcado como medido pelo aparelho, separado dos seus relatos.</p>
    </LegalSection>
    <LegalSection title="Google Agenda">
      <p>Quando você conecta o Google Agenda, o LIFESYSTEM recebe permissão para ver e editar eventos. Consultamos os eventos da agenda principal no intervalo exibido para mostrar seus compromissos ao lado das tarefas, e criamos ou ajustamos eventos quando você pede (por exemplo, ao reservar um bloco de foco ou converter uma captura em evento). O token de acesso é guardado criptografado no servidor. Os eventos consultados não são gravados nos nossos arquivos de dados, nem vendidos ou compartilhados com anunciantes.</p>
    </LegalSection>
    <LegalSection title="Inteligência artificial">
      <p>Algumas funções enviam a um modelo de IA o texto necessário para responder: o Copiloto, a análise e a busca de editais, o diagnóstico e a Central de conteúdo. Usamos modelos gratuitos oferecidos por OpenRouter, Groq, Mistral, Cloudflare Workers AI e OpenCode, e cada envio vale só para aquela resposta. O que a IA devolve é sugestão: nada muda nos seus dados sem a sua ação.</p>
    </LegalSection>
    <LegalSection title="Agentes Hermes">
      <p>Os agentes do Hermes rodam num servidor próprio do titular do LIFESYSTEM e acessam áreas específicas por chaves dedicadas. Eles podem conversar com você no Escritório, no Telegram ou no WhatsApp. Quando um agente quer mudar algo (registrar um treino, criar uma tarefa), ele prepara uma proposta, que só vale depois que você aprova na tela; cada mudança aplicada deixa um recibo.</p>
    </LegalSection>
    <LegalSection title="Onde os dados ficam">
      <p>Os dados ficam no servidor de hospedagem do LIFESYSTEM (Hostinger) ou num banco Cloudflare D1, com uma cópia de segurança feita a cada publicação de nova versão. O acesso exige login, e as rotas usadas por agentes e aparelhos exigem chaves próprias.</p>
    </LegalSection>
    <LegalSection title="Compartilhamento">
      <p>Não vendemos dados pessoais e não os compartilhamos com anunciantes. Serviços externos (Google, provedores de IA, Telegram/WhatsApp) recebem só o necessário para a ação que você pediu.</p>
    </LegalSection>
    <LegalSection title="Seus direitos">
      <p>Você pode corrigir e excluir itens dentro do aplicativo, exportar as áreas principais em Configurações → Dados, revogar a chave do Apple Saúde em Configurações → Integrações e revogar o Google nas permissões da sua Conta Google. Para dúvidas, acesso ou exclusão completa, escreva para jonnyakbal@gmail.com.</p>
    </LegalSection>
  </LegalPage>;
}
