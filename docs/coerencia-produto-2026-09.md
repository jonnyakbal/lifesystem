# LIFESYSTEM — coerência de produto e confiabilidade

## Objetivo

Uma pessoa deve conseguir passar por **capturar → decidir → planejar → executar → revisar** sem descobrir em qual dos muitos módulos uma ação se esconde. O visual astral é uma assinatura discreta. A informação, o tempo e a ação principal têm prioridade.

## Referências examinadas (25/09/2026)

| Produto | Padrão útil | Adaptação ao LIFESYSTEM |
| --- | --- | --- |
| ClickUp | Painel de tarefas sem data ao lado do calendário | Fila sem data visível em Planejar, com ação por toque e teclado além de arrastar. [Fonte](https://help.clickup.com/hc/en-us/articles/6308666892823-Intro-to-start-dates) |
| Todoist | Eventos externos aparecem junto às tarefas; sincronizar blocos com horário é opcional | Separar intenção de compromisso: data simples não cria evento; bloco só é exportado por escolha. [Fonte](https://www.todoist.com/help/articles/use-the-calendar-integration-rCqwLCt3G) |
| Sunsama | Planejamento guiado considera duração e carga diária antes do timeboxing | A semana mostra capacidade e pede decisões realistas, sem agendamento automático agressivo. [Fonte](https://help.sunsama.com/docs/getting-started/setting-up-your-account/) |
| Notion Calendar | Contexto de banco de dados junto do calendário, com controle de agendas visíveis | Origem e contexto de cada item ficam identificáveis; filtros de agenda simples. [Fonte](https://www.notion.com/help/manage-your-calendars-and-events) |

## Diagnóstico do código atual

1. `/planejar` contém apenas `PlanningWizard`: cria tarefa, conteúdo ou nota em sequência por pilar. No modo semana ou mês, os itens novos não recebem data. A semana e o backlog, por sua vez, estão escondidos numa das quatro visualizações de `/tarefas`.
2. `/tarefas` concentra quadro, lista, semana, mês, filtros, visões salvas, lote, etapas e formulário em um componente extenso. Sua barra de ferramentas exige muita decisão antes de agir.
3. A navegação dá peso semelhante a dezoito destinos. “Hoje”, “Planejar”, “Tarefas”, “Revisão” e “Hermes” formam um ciclo, mas aparecem dispersos.
4. O endpoint MCP tem escopos por chave, porém a tela Hermes informa apenas se `MCP_API_KEY` existe; uma configuração só com `MCP_API_KEYS` aparece falsamente como desconectada. “Configurado” não é “chamada recebida”.
5. O envoltório de log do MCP aguarda a gravação do log depois de executar a ferramenta. Se o log falha, o cliente recebe erro apesar de a escrita já ter acontecido; ao tentar novamente, pode duplicar dados.
6. As ferramentas MCP acessam `storage` diretamente, enquanto as rotas REST validam entradas e às vezes aplicam regras específicas. A paridade de domínio precisa ser corrigida por fluxo, começando por tarefas e finanças.

## Direção

### Ciclo único

- **Capturar:** entrada rápida, sem classificar demais.
- **Decidir:** converter em tarefa, nota, conteúdo, evento, financeiro ou projeto.
- **Planejar:** centro da semana, com fila sem data e compromissos; o ritual por pilar vira ação secundária de criação.
- **Executar:** Hoje mostra poucas prioridades e o próximo compromisso.
- **Revisar:** resolve pendências e preserva contexto para a próxima semana.

### Linguagem de interface

Uma ação primária por tela. Tipografia expressiva nos títulos, texto funcional claro, contraste forte, poucas cores de estado. A órbita deve aparecer em momentos de orientação e transição, não em cada cartão. No Planejar móvel, a fila sem data vem antes dos dias para facilitar a decisão; em Hoje, o dia vem primeiro. Desktop usa espaço para comparação simultânea.

### Dados e integração

Tarefas sem data são válidas. Data é prioridade do dia; horário e duração são reserva de tempo. Eventos Google são externos e somente leitura no primeiro espelho. Tarefas, finanças e conteúdos continuam tendo seus próprios registros e apenas projetam marcos no calendário. Cada escrita MCP deve usar as mesmas validações e invariantes do fluxo web. Auditoria jamais altera o resultado da operação principal.

### Bloqueio para abertura pública

O repositório remoto está público e contém versões antigas de arquivos JSON em `data/` (18 coleções além do README). Mesmo classificados como seed, esses arquivos precisam de auditoria de conteúdo antes de qualquer anúncio como projeto open source. Neste branch, os JSON foram retirados **apenas do índice Git**, permanecendo intactos no disco local; o `.gitignore` impede novos JSON nessa pasta. Uma instalação nova pode usar `npm run seed:demo` para criar pilares sintéticos. Isso não apaga o histórico remoto. Antes de publicar o branch, confirmar que a produção usa `LIFESYSTEM_DATA_DIR` externo e fazer backup; depois avaliar limpeza do histórico e rotação de eventuais segredos expostos. Não executar limpeza de histórico ou deploy sem uma janela de migração e verificação dos dados em produção.

## Execução por cortes verificáveis

1. **Confiabilidade MCP:** corrigir o registro de chamadas, status de conexão com últimos usos reais, contagem de ferramentas e instrução de escopo. Testes de autorização e de escrita seguida de falha no log.
2. **Centro de Planejar:** trazer semana e backlog para `/planejar`; deixar o ritual por pilar como modo opcional; garantir agendamento por toque, teclado e arrastar. Testar data, remoção de data e estados vazios em mobile.
3. **Simplificação de navegação:** mostrar o ciclo principal em destaque e módulos complementares em grupo recolhível, sem perder acesso nem esconder dados. Unificar rótulos e ações primárias.
4. **Camada de calendário:** implementar status de conta, desconexão e espelho somente leitura da agenda principal. O escopo `calendar.events` já inclui leitura de eventos; para listar outras agendas será preciso ampliar escopos. Depois vincular blocos criados pelo LIFESYSTEM para atualização segura.
5. **Paridade de domínio:** mover validação e regras comuns de REST/MCP para serviços compartilhados; revisar cada entidade e evitar CRUD genérico quando a ação tiver efeito financeiro, recorrente ou externo.
6. **Polimento por fluxo:** Início/Hoje, Caixa de entrada, Planejar/Tarefas, Conteúdo/Fontes, Financeiro, Projetos/Editais, Notas/Diário, Hermes/Configurações. Em cada fluxo: 390 e 1440 px, luz/escuro, teclado, carregamento/erro/vazio e resposta de gravação.

## Critério de pronto

- Planejar uma tarefa sem data em mobile requer uma ação clara e no máximo três decisões.
- Uma falha de auditoria MCP não torna uma mutação bem-sucedida em erro para o agente.
- A tela Hermes diferencia configuração local, último acesso real e falha recente.
- A navegação principal conta a história do ciclo de uso e reduz escolhas de primeira camada.
- Nenhum fluxo crítico depende exclusivamente de drag and drop, hover ou MCP.
- O build, tipos, lint, testes de domínio e um percurso manual mobile e desktop passam antes de publicação.

## Estado deste corte

Implementados: Planejar com semana e backlog, espelho Google somente leitura, navegação principal condensada, auditoria MCP que não altera o resultado da ferramenta, status distinguindo chave e atividade, paridade de atualização de tarefas e validação dos lançamentos e cadastros financeiros pelo MCP, fontes locais no build. Parcelas de faturas agora preservam `installments` nos dois canais. O protocolo MCP foi testado com cliente real em memória. O smoke test remoto no endpoint público autenticou com a chave local, descobriu 68 ferramentas e concluiu leituras de tarefas e do resumo financeiro sem imprimir dados. No Planejar móvel, os resumos levam diretamente à fila sem data ou aos dias da semana. A Home móvel põe ações do dia antes dos indicadores e encaminha tarefas sem data ao Planejar. Tarefas e Conteúdo mantêm filtros, visões salvas e edição de etapas em controles secundários; o botão de etapas das Tarefas volta a funcionar. O título de Conteúdo e os exemplos iniciais deixam de presumir projetos pessoais; categorias financeiras existentes continuam disponíveis. Os 53 testes funcionais passaram, as 18 rotas principais abriram em 390 e 1440 px sem erro de execução em 36 capturas, o build passou e o lint não tem erros (avisos antigos ainda existem). A conexão **do processo Hermes na VPS → produção** ainda exige uma chamada observada originada pelo próprio Hermes; o conector Hostinger retornou lista vazia de VPS e `HTTP 401` ao consultar a hospedagem.

O histórico MCP agora registra o `id` da credencial usada, sem registrar o segredo. Uma chave exclusiva para o Hermes permitirá reconhecer suas chamadas no painel; a chave legada continua indistinguível de qualquer outro cliente que a possua. Essa mudança é local até o deploy e a configuração de uma chave exclusiva na VPS.

Próximos cortes: unificar Semana/Calendário de Tarefas com Planejar; aplicar serviços de domínio aos outros tipos de escrita MCP; projetar capacidade por dia e vincular blocos de tempo opcionais ao Google; validar estados claro/escuro e gravações dos módulos secundários; confirmar o diretório persistente e um backup de produção antes de qualquer deploy; migrar dados versionados para fixtures seguras antes da abertura pública. Não confundir este corte validado com uma certificação do sistema inteiro.
