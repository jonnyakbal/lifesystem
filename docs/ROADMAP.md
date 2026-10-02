# Roadmap e estado do LIFESYSTEM

Atualização: 02/10/2026. Este arquivo concentra o backlog atual. Planos e análises datados documentam a entrega da época; não são listas de pendências atuais.

## Cloudflare híbrido — 02/10 (branch `claude/serene-bell-usq5xy`, não publicado)

Decisão de Jonny: manter a hospedagem na Hostinger e adicionar banco e IA da Cloudflare. O código acrescenta `LIFESYSTEM_STORAGE=d1`, que guarda as coleções no D1 via REST com lease distribuído e gravação protegida por revisão. Acrescenta também o provedor Workers AI e os scripts de importação e exportação. O padrão continua sendo arquivo. Ledger de saúde, estação e uploads ficam fora do D1 nesta fase. A ativação depende de tokens e variáveis na Hostinger e da migração com backup; ainda não foi feita. Ver [Cloudflare D1 e Workers AI](cloudflare-d1-workers-ai.md).

## Profissional simplificado — 02/10 (branch `claude/serene-bell-usq5xy`)

Decisão de Jonny: o CRM é o Arco Leads e não é duplicado no LifeSystem. A tela `/profissional` passa de sete abas para três áreas em português simples:
- **Visão geral:** projetos por marca, o que falta informar e sugestões do Sirius;
- **Próximos passos:** trabalhos;
- **Aguardando você:** propostas e entregas para aprovar.

Outras mudanças:
- Contatos, oportunidades, prospecção e pautas antigos ficam em "Registros antigos", só para leitura e sem apagar nada. O topo da tela tem o atalho "Abrir Arco Leads".
- As metas passam a ser editáveis em `GET/PUT /api/professional/goals`, com revisão contra edição desatualizada.
- Etapas, tipos de aprovação e lacunas foram traduzidos. `counts.legacy` foi acrescentado à visão geral.
- **Contrato Sirius 1.0 intacto:** as ferramentas MCP de contato e oportunidade continuam existindo. Redirecionar essas operações ao Arco Leads é decisão das sessões Hermes e Arco CRM, ainda pendente.

## Estação interativa — 02/10 (branch `claude/serene-bell-usq5xy`, não publicado)

Pedido de Jonny: a estação deve parecer quase um jogo, sem botões mortos, com missões e voz. Entregue no código, ainda sem publicação:

1. **Controles:**
   - todo controle confirma o que fez com um aviso;
   - "Visão geral" mantém o modo atual;
   - o passeio orbital ficou visível e explica quando não pode iniciar;
   - teclas 1–6 escolhem a tripulação;
   - "Atualizar dados" mostra o horário da atualização e os filtros vazios se explicam.
2. **Chat (E1):** o polling não puxa mais o leitor para o fim e há o botão "Novas mensagens". Respostas longas abrem recolhidas, com "Ler tudo" e "Recolher". "Copiar" copia só o texto recebido e avisa quando a área de transferência recusa. Marcação HTML na resposta continua sendo texto.
3. **Procedência (E2):** a ficha mostra "referência local", "recebido da instalação", "aguardando confirmação de revisão" ou "sem sinal recente", com revisão e data de recebimento. Ela não fabrica horário de verificação. `catalogCurrent` continua igual para quem já o usa.
4. **Missões e decisões:**
   - a "Central de missões" mostra os pedidos reais de todos os agentes (`GET /api/hermes/office/chat?agentId=all`, com sessão);
   - mostra também as propostas pendentes do Órion e do Sirius, com revisão exata e aprovação pelas mesmas rotas das telas Corpo e Profissional; `external_action` continua bloqueada;
   - robôs e barra da tripulação mostram "em missão", "missão na fila" e "decisão pendente";
   - uma fonte que falha nunca aparece como zero.
5. **Voz:**
   - microfone por agente, pelo reconhecimento do navegador, opcional e com aviso de que o Chrome envia o áudio ao Google;
   - "Ouvir respostas" com voz do sistema e tom por agente; o robô aparece "♪ FALANDO";
   - a voz local no Hermes é [contrato proposto](contracts/office-voice-v1.md) para a sessão Hermes e não está implementada.

6. **Histórico e arquivamento (E3):**
   - `GET /api/hermes/office/chat/history` lista páginas estáveis por `(createdAt, id)`, ativas ou arquivadas, com cursor preso ao agente e ao tipo de histórico; aceita só sessão humana, nunca o token do publicador;
   - `POST` com `op: "archive"` exige a prévia (`expectedRevision`) e um `requestId` idempotente;
   - só conversas concluídas ou com falha são arquivadas, num segmento imutável `office-<hash>.archive-<id>.json`, que também entra nos backups de `*.json`;
   - um índice leve preserva retry por `clientId`, a cota de 100 por 24 h e recibos tardios idênticos;
   - fila, execução e interrompidos nunca são arquivados;
   - na interface: "Carregar conversas anteriores", "Ver arquivadas" e manutenção com prévia e confirmação na Central de missões.

Pendentes da estação: E4 (capacidades por contrato) e o feixe visual entre um agente e o destino de uma missão.

## Entrada para Claude na nuvem — 02/10

As pendências e instruções passam a ser publicadas por autorização de Jonny. Leia [continuidade cloud](CONTINUIDADE-CLAUDE-CLOUD.md) e [plano E1–E4 da estação](superpowers/plans/2026-10-02-office-lifesystem-followups.md). Conversa já publicada/testada: evolução de histórico/arquivamento, respostas longas, procedência das fichas e capacidades MCP continua pendente e não bloqueia a entrega anterior. Sessão LifeSystem cuida de código/UI/APIs; sessão Hermes pessoal cuida da VPS, configuração e consumidor. Não alterar Hermes Dona Maria ou Arco CRM.

O resumo técnico necessário do registro externo CONVERSA-ESCRITORIO.md foi internalizado na continuidade cloud; não depender do caminho local para essas tarefas. Evidências privadas, stash e runtime local não serão publicados, e sua ausência não bloqueia desenvolvimento/testes sintéticos das melhorias.

## Continuidade atual para Claude

Leia [o handoff completo](HANDOFF-CLAUDE.md) antes de executar: decisões do usuário, contratos MCP, critérios de aceite, evidências privadas e próximos passos estão consolidados nele. No início do repasse, main e origin/main estavam em `c42a2e5`; o [run 36928569715](https://github.com/jonnyakbal/lifesystem/actions/runs/36928569715) foi consultado pela API pública e estava concluído/success para esse HEAD. Isso certifica CI, não uma nova observação do deploy.

A conversa real com agentes no Escritório foi integrada por `92db730`; o [recibo da estação](office-chat-plan.md) registra publicação Hostinger e respostas de Sirius/Hermes no navegador. Esse fluxo é separado de aplicar propostas health/professional por credenciais dedicadas e executar jobs profissionais: esses pilotos operacionais continuam pendentes. Preservar a implementação mais recente; worktrees antigas não são a base atual.

Achado deste repasse: `src/lib/health/store.ts` ainda usa trava própria recuperada por idade, sem verificar dono/heartbeat. Investigar e reproduzir concorrência com operação longa antes de ampliar seu uso; não confundir a saúde com a trava geral reforçada. A candidata privada de saneamento baseada em `4ee5545` ficou desatualizada para o main atual e não deve ser aplicada ao remoto.

Na retomada local, antes de novas features, reconciliar alterações preexistentes no worktree `lifesystem-orion-action-bridge`: snapshot privado de 16 arquivos preservado, com 10 diferentes de main. Uma diferença não prova trabalho faltante; comparar a base e a evolução atual antes de integrar ou arquivar. Na nuvem, a reconciliação permanece com a sessão local e não bloqueia entregas independentes a partir de main. Localização e instruções no handoff.

## Execução do roadmap — revisão posterior de 01/10

Aplicação publicada em `8328c67`: Hostinger confirmou **Concluído / Atual** e o site mostrou a jornada editável em Carga e os campos de estrutura/esforço de tarefas. Validação local final: **352 testes passaram (8.7m)**, tipos/build aprovados, lint zero erros/avisos e auditoria npm zero vulnerabilidades. A candidata privada de saneamento foi atualizada para esse código; nenhuma reescrita do histórico remoto foi aplicada. Recibo e limites em [deploy de produção](deploy-producao.md).

O código desta revisão acrescenta subtarefas/dependências, esforço opcional em minutos e jornada configurável. A conclusão de recorrências gera a sucessora na mesma transação da tarefa, com identidade determinística e vínculo persistente. A exclusão verifica vínculos antes de remover o evento Google. O planejamento conserva data/hora/fuso de blocos existentes; a jornada define a grade e não reescreve seus instantes.

Storage passa a serializar gravações de todas as coleções entre processos cooperantes no mesmo host. Restauração e scanner de publicação foram ensaiados com dados sintéticos. Login/metadados/manifesto usam a projeção pública da marca. O lint global passou com zero erros e zero avisos; a CI passa a usar servidor de produção isolado, login sintético e zero retries.

Os pilotos Órion/Sirius validam contratos SDK, aprovação humana e recibos com identidade, sem agentes reais nem execução externa. As expansões de agenda têm [especificação incremental](agenda-expansion-contracts.md), mas **ainda não estão implementadas**. Veja [regras de produtividade](task-structure-capacity.md), [piloto](agent-pilot.md) e [registro de execução](roadmap-execution-2026-10-01.md). Publicação e suíte final são registradas separadamente no recibo de deploy.

## Entregue no código

| Área | O que existe | Limite atual |
| --- | --- | --- |
| Ciclo principal | Captura, conversão em sete destinos, Planejar, Hoje e revisão semanal | Revisão manual; não uma revisão automática por IA |
| Planejar | Fila sem data, semana, prioridades por dia, início/duração e jornada/fuso configuráveis | Um bloco por tarefa; disponibilidade depende da agenda principal carregada |
| Tarefas | Sete visões, subtarefas, dependências e esforço opcional; Carga compara esforço e jornada | Sem inferir esforço ausente ou tempo livre do Google em Carga; Gantt excluído pelo usuário |
| Datas | Dia planejado e prazo usam `dueDate`; bloco guarda metadados de horário | Sem segundo prazo independente |
| Google Agenda | Espelho da agenda principal; criar/mover/remover blocos próprios e adoção explícita | Atualização explícita; sem múltiplas agendas ou espelho de contas/conteúdos |
| Financeiro | Meses passados/futuros, previsto vs realizado, gráficos/insights, cadastros e faturas | Saldos manuais; faturas separadas; sem gerar recorrências automaticamente |
| MCP/Hermes | Escopos por identidade, validações compartilhadas, auditoria, heartbeat e recibos; relações/recorrência de tarefas compartilhadas com REST | Locks de coleção exigem escritores cooperantes no mesmo host; não substituem banco distribuído |
| Saúde/Órion | Contrato 1.2, contexto/observações, propostas/aprovações/recibos e ponte de tarefas/Planejar | Credencial exclusiva e transporte no Hermes ainda precisam de ativação verificada |
| Profissional/Sirius | Contrato incremental, propostas, aprovações e recibos no LifeSystem | Piloto de transporte real ainda não certificado; Hermes/Arco CRM não alterados |
| Escritório | Estação 3D/lista, telemetria pessoal e conversa real por perfil com fila/recibo | Conversa e telemetria não equivalem a execução de jobs profissionais; desempenho real ainda merece aferição |
| Interface | Navegação condensada, dock mobile, tema; marca pública coerente em login, metadados e PWA | Preferências privadas não são serializadas no manifesto |

## Registro histórico: tarefas e preparação da ativação

Em 01/10, o conjunto das sete visões de Tarefas foi publicado no código `8ce708d`. Hostinger confirmou **Concluído / Atual**, e a sessão autenticada pública abriu Foco e Carga. Foco oferece checklist, fila e conclusão explícita recuperável. Carga distribui prazos por dia/projeto/pilar e sinaliza sobreposições de blocos, com semana navegável e fila sem prazo. Não é estimativa de esforço nem disponibilidade livre. Tabela, Kanban e calendário permitem edição pelos contratos atuais; prazo com bloco passa por Planejar. Validação local: **68 testes aprovados (3.9m)**, tipos/build sem erros, lint 0 erros / 96 avisos existentes. Ver [registro de entrega](task-focus-load-delivery.md) e [recibo público](deploy-producao.md). Isso não certifica transporte Órion/Sirius nem resolve idempotência persistente de recorrências.

- Hoje separa título (abrir detalhes) de botão Concluir, oferece Desfazer e mantém Concluídas hoje com Reabrir.
- Tarefas oferece Em aberto/Concluídas/Todas, contagem real, busca incluindo concluídas e ordenação por conclusão recente.
- Etapas removidas continuam visíveis; etapas terminais personalizadas são reconhecidas sem reescrever dados.
- Recorrência lenta não bloqueia Reabrir e sua próxima ocorrência aparece sem reload. A revisão posterior acrescenta idempotência persistente no servidor; reabrir/reconcluir conserva a sucessora e sua exclusão não a recria silenciosamente.
- O smoke de saúde verifica contrato 1.2, catálogo exclusivo, escopos e schemas por duas chamadas de descoberta. Handshake sem ferramentas verificáveis não é sucesso. O perfil saúde não consulta registros pessoais.
- A integração operacional não foi certificada: conector Hostinger respondeu 401. Jonny informou a chave SSH, e a conexão somente leitura com a hospedagem foi confirmada; nenhuma configuração de produção foi substituída.

Estas correções ficam com recibo de publicação separado em `deploy-producao.md`; não confundir preparo local com ativação do Órion/Sirius.

Validação desta revisão (30/09): **47 testes passaram** em servidor isolado, cobrindo tarefas, conclusão/recuperação, recorrência lenta, planejamento/exclusão, smoke MCP e cinco telas em mobile/desktop. `npx tsc --noEmit` e build Webpack passaram. Lint: **0 erros, 96 avisos existentes**; os arquivos de código desta revisão não têm avisos. Revisão independente identificou quatro lacunas, corrigidas e cobertas antes da integração. Isso não substitui uma auditoria integral de acessibilidade nem o teste dos transportes reais dos agentes.

## Verificado na aplicação pública

Em 29/09, `/hermes` mostrou heartbeat `hermes-heartbeat` recente, estado Online, chamadas `hermes-mcp` e ausência de falhas recentes. **Test connection** no Hermes pessoal descobriu as ferramentas do servidor `lifesystem`. Nenhuma escrita financeira ou de Calendar foi feita nesta revisão.

Posteriormente, o hPanel autenticado confirmou `77419ac` como **Concluído / Atual** e a aplicação pública exibiu o novo controle de captura. O código de proteção financeira foi publicado nesse build e testado localmente com falhas sintéticas; nenhuma escrita financeira foi feita em produção. Ver [recibo da release](deploy-producao.md).

## Correções desta revisão

- Captura rápida preserva texto em falhas, oferece botão por toque, bloqueia envios concorrentes e atualiza a fila.
- Revisão semanal mostra erro recuperável e impede concluir uma revisão que não carregou.
- Criação financeira MCP usa identidade determinística por cliente/operação/chave, evitando duplicação quando o lançamento salva e o recibo falha.
- Auditoria Git cobre caminhos com conteúdo idêntico, sem ler ou imprimir valores.
- Playwright de revisão usa diretório temporário, porta dedicada e credenciais sintéticas; não reutiliza servidor de desenvolvimento.

A revisão foi integrada e publicada no build `77419ac`; o recibo Hostinger e a evidência da versão no site estão em [deploy de produção](deploy-producao.md).

Verificação histórica de 29/09: **140 testes passaram** em servidor novo com dados sintéticos; tipos e build passaram; lint teve **0 erros e 125 avisos existentes**. A revisão independente encontrou duas lacunas de isolamento no QA, ambas corrigidas. O smoke de 18 rotas não certifica todas as interações nem acessibilidade integral.

Na tentativa de publicação, `0adc054` passou na CI e falhou no Turbopack da Hostinger. O build passa a usar Webpack, foi removido um export inválido e sem uso na página inicial e `fast-uri` foi atualizado para 3.1.8. Verificação após a atualização: 140 testes passaram novamente; build Webpack e tipos passaram; auditoria npm sem vulnerabilidades. O recibo de produção permanece separado desses resultados locais.

## Prioridades reais

| Ordem | Pendência | Critério de conclusão |
| --- | --- | --- |
| P0 | Sanear histórico público e revisar documentação/imagens | [Auditoria de privacidade](privacidade-historico.md); autorizar reescrita após revisão da cópia preparada |
| P1 | Reforçar a trava própria do ledger de saúde | Reproduzir operação ativa longa/recuperação concorrente e preservar exclusão mútua; não remover trava ativa somente por idade |
| P1 | Conciliar o brief de saúde com a jornada de Planejar | Janela hoje fixa 08–20; definir regra compartilhada, atualizar contrato e testar dias/fuso/falhas sem inventar disponibilidade |
| P1 | Ativar credenciais/transportes Órion e Sirius | Testar cada identidade dedicada, contrato, proposta/aprovação/recibo; sem chave genérica nem mudança em Hermes nesta sessão |
| P1 | Manter verificação após cada release | Comparar SHA, recibo Hostinger e comportamento público; CI separada do deploy |
| P1 | Estação E1–E4 | [Plano incremental](superpowers/plans/2026-10-02-office-lifesystem-followups.md): leitura de respostas, procedência, histórico/arquivamento e capacidades, sem quebrar consumidor publicado |
| P2 | Ensaio operacional de backup privado real | Ferramenta e testes sintéticos concluídos; restaurar somente em destino isolado sem trocar runtime |
| P3 | Expansões de agenda especificadas | Implementar fases de [contratos v2](agenda-expansion-contracts.md): múltiplos blocos/agendas, overlays e sync; nenhuma dessas expansões foi certificada em produção |

Pedidos operacionais ainda sem certificação neste repasse: verificar cadastro/vínculos do edital LIC-SM 2027 antes de criar duplicatas; localizar a tarefa concluída por engano sem reabrir registros ao acaso; aferir acessibilidade/desempenho do Escritório. Detalhes, ordem e gates no [handoff](HANDOFF-CLAUDE.md).

Não há motivo demonstrado nesta revisão para migrar o banco ou acrescentar multiusuário. O foco continua no ciclo existente.

## Verificação reproduzível

```sh
npx playwright test --config playwright.readiness.config.ts
npx tsc --noEmit
npm run lint
npm run build
node scripts/audit-git-privacy.mjs
```

A auditoria retorna `1` quando encontra caminhos históricos de risco. É inventário de metadados, não certificação de ausência de segredos. Durante QA, configure `LIFESYSTEM_DATA_DIR` temporário também para o build, que respeita o backup pré-deploy.
