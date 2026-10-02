# Continuidade LifeSystem para Claude — 01/10/2026

Atualização de 02/10: Jonny solicitou publicar as pendências para trabalhar no Claude na nuvem. A entrada atual é [CONTINUIDADE-CLAUDE-CLOUD](CONTINUIDADE-CLAUDE-CLOUD.md), com [plano das melhorias da estação](superpowers/plans/2026-10-02-office-lifesystem-followups.md). Este handoff preserva o snapshot local e as pendências gerais; afirmações abaixo de “sem commit/push” descrevem o repasse anterior, não a autorização atual. Caminhos do PC são referências históricas, não dependências para desenvolver na nuvem.

Pedido atual: consolidar esta sessão e deixar o próximo agente capaz de continuar sem perder demandas, repetir entregas ou sobrescrever trabalho. Este repasse altera documentação local; não publica código nem aciona sistemas externos. Leia também [AGENTS](../AGENTS.md) e [roadmap](ROADMAP.md). Reconfira o Git: este é um snapshot, não uma garantia de que outra sessão não avançou depois.

## 1. Começar pelo estado real

Checkout principal: `C:/dev/jonny/lifesystem`. No início deste repasse, árvore limpa, branch `main`, HEAD e `origin/main` em `c42a2e5b24ee915c744d4aa230695ea48dccff75`. As alterações documentais deste repasse ficam locais e precisam ser preservadas. Não usar reset/clean para obter uma árvore limpa.

```powershell
git status --short
git log -8 --oneline
git rev-parse HEAD
git rev-parse origin/main
git worktree list
```

Worktrees observados, todos mais antigos que main:

| Diretório | Branch / referência observada | Cuidado |
| --- | --- | --- |
| `C:/dev/jonny/lifesystem-agent-office` | `feat/agent-office`, `0660827` | Código do Escritório integrado; status mostra dois diretórios Python `__pycache__` não rastreados; verificar uso antes de limpar |
| `C:/dev/jonny/lifesystem-orion-action-bridge` | `chore/orion-activation-readiness`, `1404e52` | Há alterações locais de tarefas/UI/testes/docs; snapshot privado de 16 arquivos, 6 iguais e 10 diferentes do main. Não integrar em bloco nem descartar |
| `C:/dev/jonny/lifesystem-roadmap-hardening` | `feat/roadmap-hardening`, `1d0cf8f` | Contém análise privada ignorada; preservá-la fora do Git antes de arquivar |

Para desenvolvimento novo, partir do main atualizado, em checkout isolado quando o servidor pessoal estiver em uso. Verificar trabalho concorrente antes de integrar. Não atualizar dependências/build no checkout com `next dev` ativo: `.next` e `node_modules` são compartilhados por esse processo. Não encerrar todos os processos Node: vários pertencem a conectores e outras sessões.

**Primeiro passo na retomada local antes de novas features:** reconciliar, por diff de código e referência base, os arquivos pendentes no worktree Orion com as versões mais recentes de main. A diferença de hash não prova feature faltante: pode ser uma versão anterior já evoluída em main. A cópia privada contém arquivos completos, patch dos rastreados e manifesto de hashes; a pasta original foi preservada. Ver localização no suplemento. O worktree hardening está limpo para rastreados, mas conserva arquivos ignorados. Na nuvem, esses worktrees privados não existem: seguir a entrada cloud, desenvolver a partir de main e deixar a reconciliação local registrada sem bloquear melhorias independentes.

## 2. Evidência de entrega e produção

| Estado | Evidência e limite |
| --- | --- |
| Produtividade/confiabilidade | Aplicação `8328c67`: recibo Hostinger Concluído/Atual e observação pública de jornada em Carga e estrutura/esforço em Nova Tarefa. [Recibo](deploy-producao.md) |
| QA dessa rodada | 352 testes locais passaram em servidor de produção isolado, zero retries, tipos/build aprovados, lint zero erros/avisos e npm audit zero vulnerabilidades. Essa contagem pertence à rodada `8328c67`, não à suíte mais recente |
| Correção CI Linux | `4ee5545`: cache do Chromium do runner preservado; [run 36917946053](https://github.com/jonnyakbal/lifesystem/actions/runs/36917946053) concluído/success. `1d0cf8f` registra o recibo |
| Conversa real no Escritório | `316b981`, integrado por `92db730`; [plano/recibo](office-chat-plan.md) registra Hostinger concluído em 01/10 às 18:20 e respostas reais de Sirius e Hermes no Chrome, sem alteração de registros de negócio |
| Main atual | `c42a2e5` integra o recibo `0660827`. API pública do GitHub consultada durante este repasse: [run 36928569715](https://github.com/jonnyakbal/lifesystem/actions/runs/36928569715), HEAD exato acima, completed/success, atualizado `2026-10-01T21:39:06Z` |
| Limite de certificação | CI verde não prova deploy Hostinger. O recibo de conversa não certifica uso de todas as ferramentas health/professional por credenciais dedicadas, nem execução de jobs profissionais ou escrita Google real |

Não foi aberta novamente a produção nem repetida a suíte da aplicação para este repasse documental. Resultados antigos estão identificados como históricos. Um commit só de documentação pode disparar novo build quando enviado a main; não anunciar seu SHA como publicado sem verificar.

LifeSystem reside na hospedagem compartilhada Node.js da Hostinger. Hermes pessoal está na VPS, em instalação distinta. Build deve continuar `next build --webpack`; CI GitHub valida qualidade, integração nativa Hostinger publica após push normal a main. `401` do conector Hostinger não significa falha de deploy nem falta de SSH. Regras e passos: [deploy](deploy-producao.md).

## 3. Pedidos e decisões que devem sobreviver à troca de agente

- Prioridade do produto: produtividade, visualização e manipulação de tarefas. Sete visões já existem: Quadro, Lista, Semana, Calendário, Linha do tempo, Foco e Carga. **Não implementar Gantt**; foi excluído expressamente.
- Em Hoje, clicar no título/corpo abre a tarefa; concluir exige botão próprio. Preservar Desfazer, Concluídas hoje, Reabrir, busca e filtros Em aberto/Concluídas/Todas. O usuário perdeu uma tarefa concluída por engano e não lembrou o título: não houve identificação certificada dessa tarefa neste repasse; não reabrir registros ao acaso.
- O dia escolhido em Planejar é `dueDate`, o prazo da tarefa. `planning` guarda horário/fuso/sincronização, não um segundo prazo. Tarefa espelhada precisa remover o bloco próprio de modo confirmado antes de exclusão; oferecer caminho acessível em Planejar, evitando um beco sem saída.
- Design pode variar por tela, com densidade útil, tema/mobile/teclado preservados. Direção aprovada para agentes: observatório violeta, órbitas discretas e propostas para revisão. Não voltar ao amarelo global nem uniformizar tudo em grandes heros vazios. [Referências](product-reference-direction.md), [estudos](design-studies/workspace-directions.html).
- Financeiro: navegação mensal passada/futura; `pending/overdue` usa `dueDate || date`, `paid` usa `paidDate || date`. Previsto não entra em recebido/despesa paga/saldo realizado. Não gerar recorrências financeiras nem eliminar lançamentos por coincidência de descrição/valor. [Regra](financeiro-periodos.md).
- A reclamação sobre tabela de prospecção enviada por engano foi retirada; não usá-la como autorização para alterar Arco CRM.
- Demandas Órion/Sirius são incrementais e já têm código/contratos. Leia o que existe antes de recriar ferramentas. Não alterar Hermes ou Arco CRM nesta continuidade sem autorização nova que mude expressamente o escopo.

## 4. Sequência de trabalho e critérios de conclusão

Cada item deve terminar com evidência, documentos e status atualizado. Uma preparação pode ficar concluída sem sua ativação estar concluída. Não há necessidade demonstrada de migração de banco ou multiusuário para zerar estas pendências.

### P0 — preservar e preparar a privacidade do histórico

- [ ] Inventariar alterações, worktrees, arquivos privados ignorados e referências sem imprimir conteúdo pessoal. Preservar cópias privadas antes de qualquer limpeza.
- [ ] Revisar documentalmente/imagens e conteúdo histórico em ambiente privado. O scanner de caminhos não é auditoria completa de PII/segredos.
- [ ] Atualizar a candidata de saneamento a partir do HEAD atual e comparar arquivos retidos por caminho/modo/blob. A última candidata local é baseada em `4ee5545`, portanto está **desatualizada** para `c42a2e5`.
- [ ] Preparar referências exatas, recovery bundle verificado, escopo de branches/tags/PRs e janela para revisão humana. **Não fazer force-push por autorização genérica anterior**. Referências de forks/caches/PRs não são cobertas pela candidata de main.
- [ ] Somente após autorização específica, aplicar a reescrita aprovada e verificar referências/integração/deploy; arquivar worktrees apenas sem trabalho pendente e com arquivos ignorados preservados.

Fontes: [privacidade](privacidade-historico.md), [preparação](roadmap-privacy-preparation.md). Índice dos bundles e evidências fica no suplemento privado local, indicado na seção 8.

### P1 — confiabilidade de saúde e piloto real protegido

- [x] **Corrigido em 02/10 (branch `claude/serene-bell-usq5xy`):** `transactHealthLedger` passou a usar a trava geral (dono, heartbeat, recuperação de dono morto e confirmação de posse antes do commit) e migra com segurança a trava antiga, que era um diretório vazio. O roubo por idade foi reproduzido antes da correção em `tests/health-ledger-lock.spec.ts`. Contexto original: investigar `src/lib/health/store.ts`: a trava própria `.health-ledger.lock` remove diretório com mtime acima de 60s, sem identidade do dono/heartbeat. Isso difere de `src/lib/storage/collection-lock.ts`; uma operação longa pode perder a exclusão mútua. É achado de leitura, não falha reproduzida nem corrigida neste repasse.
- [ ] Criar regressões sintéticas para operação ativa longa, dois processos, dono morto, recuperação concorrente e falha entre persistência/recibo; avaliar reutilizar a trava geral preservando formato/datas e migração segura de trava antiga. Nunca remover trava ativa por idade apenas. [Limites de storage](storage-hardening.md).
- [ ] Conciliar a janela do brief de saúde com a jornada configurável: `getHealthDailyBrief` ainda calcula `freeIntervals(busy, 8 * 60, 20 * 60)` em `src/lib/health/service.ts`. O contrato declara 08–20, portanto não prometer que já segue as preferências de Planejar. Definir a projeção compartilhada, atualizar descrições/schema quando necessário e testar dias sem jornada, fuso e agenda indisponível antes de mudar a semântica.
- [ ] Acrescentar piloto HTTP local autenticado `/api/mcp`, incluindo middleware, catálogo e schemas por identidade, proposta, aprovação web, aplicação e recibo. O piloto SDK existente não cobre esse transporte. Manter negações de escopo, ator, payload/revisão e expiração.
- [ ] Verificar em produção descoberta/schema de cada credencial dedicada sem ler registros pessoais; testar escrita apenas com intenção concreta autorizada e leitura posterior. Preparar checklist/manifesta para a sessão Hermes quando a configuração depender dela; não editar o Hermes nesta sessão.
- [ ] Entregar nomes/schemas reais, escopos efetivos, versão, autorização/consentimento, paginação, erros e recibos. Não enviar valores de chaves. Não chamar a conversa Office de piloto profissional concluído.

Há isolamento por ator para aplicação/recibo; leituras do mesmo domínio pessoal são compartilhadas. Não prometer ACL de leitura por agente. Não implementar ACL nova silenciosamente sem decisão de produto. O adapter profissional continua declarado `contract-only`; job queued não significa Hermes executando.

### P1 — recibos e manutenção da publicação

- [ ] Para a próxima entrega de código, executar QA completo em checkout isolado; comparar HEAD enviado, CI, Hostinger e comportamento público. Preservar evidência sanitizada e separar cada resultado.
- [ ] Consolidar registros históricos sem apagar suas evidências. Se hPanel indisponível, verificar comportamento/assets públicos e declarar exatamente qual prova falta.
- [ ] Revisar desempenho/acessibilidade do Escritório em hardware real (30fps não aferidos no recibo antigo), fallback sem WebGL, teclado/mobile/reduced motion. Não repetir conversa real só para produzir outro recibo ou disparar inferência via polling.

### P2 — backup operacional e pedidos pessoais ainda não certificados

- [ ] Restauração sintética está concluída. Ensaio com backup privado real ainda não foi feito. Só avançar se houver autorização para acessar esse backup; destino vazio e isolado, fora de checkouts/runtime, sem apontar a aplicação para ele. Nenhum conteúdo deve aparecer em log/Git.
- [ ] Avaliar snapshot consistente/manifesto no produtor de backup em uma entrega própria: o backup atual copia arquivos, pode misturar instantes e não cria checksum original. Restore não converte isso em snapshot transacional. [Contrato](backup-restore.md).
- [ ] Conferir a demanda da Central de Editais LIC-SM 2027 antes de cadastrar: buscar registro/vínculos já existentes e evitar duplicação. Prazo principal 26/10/2026 às 17h; marcos sugeridos 15/10, 20/10 e 24/10. Detalhes privados e caminhos dos anexos estão no suplemento; cadastro/homologação não certificados neste repasse.
- [ ] Se houver tarefa de teste de integração ainda remanescente, localizar por identidade e vínculo; preparar remoção confirmada do próprio bloco/evento antes de excluir tarefa. Não apagar um evento alheio ou reabrir todas as concluídas para recuperar a tarefa desconhecida.

### P3 — agenda v2, por fases independentes

Implementar a [especificação incremental](agenda-expansion-contracts.md), não um bloco único:

1. **A, projeção:** auditar os overlays locais já existentes e criar projeção comum com filtros/permissões. Lembrete financeiro/editorial não reserva horas nem cria lançamentos/tarefas.
2. **B, blocos:** adicionar blocos extras em coleção própria; conservar `Task.planning` primário v1, revisões, recibos/idempotência, vínculos e proteção de exclusão. Sem migração destrutiva global.
3. **C, agendas:** catálogo e seleção; fallback agenda principal e reconfirmação OAuth somente se escopo realmente novo for necessário.
4. **D, espelhos:** outbox persistente, consentimento por campos/revisão, ETag/propriedade; revogação pausa próximos efeitos e expõe operações parciais.
5. **E, sync incremental:** separar syncToken de janela visual; publicar snapshot/token após todas as páginas; `410` invalida cache de sincronização, não registros próprios. Preservar recorrências/exceções e fim exclusivo de dia inteiro; limites/recomeço explícitos. Falha/parcial é desconhecido, nunca disponibilidade livre.
6. **F, worker:** opt-in, lease/backoff/orçamento e desligamento sem apagar eventos; decidir responsável operacional antes de ativar. Não criar cron/heartbeat paralelo em GitHub ou Hermes para contornar integração.

Múltiplos blocos/agendas, espelhos dos overlays, sync incremental e ferramentas v2 **não estão implementados só porque estão documentados**. Nomes candidatos não devem aparecer como ferramentas registradas. Faturas ficam fora do primeiro overlay financeiro para evitar dupla contagem.

### Melhorias contínuas depois dos itens concretos

- [ ] Fazer varredura funcional das rotas restantes, problemas reproduzíveis, navegação/atalhos, estados vazios/erro, ações e acessibilidade, priorizando produtividade. Registrar achados com rota, reprodução, impacto e teste; não tratar qualquer checkbox de plano antigo como feature faltante.
- [ ] Avaliar Fontes e especificações antigas contra o código atual antes de ampliar: parte da Central de Fontes já existe. Nenhum novo serviço, cron, scraping, envio a terceiros ou chamada paga de IA é exigido por este repasse.

## 5. Contratos MCP e aprovações existentes

Schemas são definidos no código e retornados pela descoberta; os documentos não substituem `get_*_schemas` do runtime. Nunca inventar campos nem copiar credenciais para exemplos.

| Domínio | Ferramentas registradas / contrato | Escopos dedicados |
| --- | --- | --- |
| Órion, 1.2 | `get_health_capabilities`, `get_health_schemas`, `get_health_context`, `get_health_daily_brief`, `list_health_observations`, `get_health_summary`, `get_health_receipt`, `propose_health_change`, `apply_health_change`, `record_health_observation`, `correct_health_observation` | `health:only`, `health:read`, `health:propose`, `health:apply` |
| Sirius, 1.0 | `query_professional`, `get_professional_schemas`, `get_professional_receipt`, `get_professional_diagnostics`, `propose_professional_change`, `batch_professional_proposals`, `apply_professional_proposal`, `submit_professional_artifact`, `report_professional_execution` | `professional:only`, `professional:read`, `professional:propose`, `professional:apply`, `professional:artifact`, `professional:execution` |

Órion: proposta expira em 24h, vincula operação/payload/hash/revisão; aprovação humana por sessão/origem em `/api/health/approval`. `record_health_observation` e `correct_health_observation` são aliases de **aplicação de proposta aprovada**, não recebem relato livre para autoaprovar. Propostas `record`, `correct`, `context`, `task_create`, `task_plan`; pilar/tarefa/contexto reais versionados. Nenhum consentimento recorrente ativo, sensor de despertar, registro automático de briefing ou diagnóstico. [Schemas/regras](integrations/orion-health-mcp.md).

Sirius: tipos `work_scope`, `record_change`, `deliverable`, `external_action`, validade sete dias; aprovação web `/api/professional/approval` com `{proposalId,revision,hash}`. Bearer/boolean/“sim” genérico não aprova. Artefato/Review não conclui negócio, recebe receita, publica conteúdo ou envia contato; external_action não possui executor. Projetos/marcas explícitos, sem associação fictícia nem acesso company. [Contrato](sirius-hermes-handoff.md).

Retry: mesma chave + mesmos campos recupera identidade/recibo; mesma chave com payload diferente conflita. Outra intenção legítima usa outra chave, mesmo com texto/valor iguais. Saúde+Task/Google pode atravessar arquivos e falhar parcialmente: não declarar transação distribuída; verificar recibo e repetir a mesma intenção. Consultas: saúde limite 1–100/cursor ID; profissional 1–50 (20 padrão)/cursor devolvido, lote até 20.

O piloto [agent-pilot](agent-pilot.md) passou em dois casos sintéticos SDK e handlers diretos. Não certifica HTTP/proxy/TLS/interface/agentes reais, Google ou executor profissional. Pesos sem data permanecem desconhecidos; médias usam só amostras, planejado não é treino realizado e falha Calendar devolve disponibilidade desconhecida.

Escritório: fila persistente via `/api/hermes/office/chat` e ponte `/commands`, separada da telemetria e dos jobs professional. Envio humano explícito, clientId idempotente, queued/claimed/running/completed/failed/interrupted, resultado persistido antes de reentrega; reinício não reexecuta automaticamente pedido retirado da fila. Cada perfil tem conversa própria. Credencial dedicada não chega ao navegador; nenhum envio WhatsApp/Telegram neste fluxo. [Plano e recibo](office-chat-plan.md).

## 6. Mapa de código para continuar sem duplicar implementações

| Área | Arquivos de entrada | Regressões existentes |
| --- | --- | --- |
| Tarefas/relações/recorrência | `src/lib/task-domain.ts`, `src/lib/task-stages.ts`, `src/lib/task-workload.ts`, `src/app/api/tasks/` | `tests/task-relationships*.spec.ts`, `task-recurrence.spec.ts`, `tasks-api.spec.ts`, `today-task-actions.spec.ts`, `task-rich-views.spec.ts`, `task-focus-load.spec.ts` |
| Planejar/fuso/jornada | `src/lib/task-planning.ts`, `task-planning-timezone.ts`, `planning-preferences.ts`, `src/app/api/planning-preferences/`, `src/app/api/tasks/[id]/planning/` | `tests/task-planning*.spec.ts`, `task-delete-planning.spec.ts`, `planning-capacity.spec.ts`, `task-workload.spec.ts`, `unified-agenda.spec.ts` |
| Financeiro | `src/lib/financial-period.ts`, `financial-validation.ts`, `financial-categories.ts`, `financial-insights.ts`, `src/lib/mcp/tools.ts`, `src/app/(dashboard)/financeiro/page.tsx` | `tests/financial-*.spec.ts`, `tests/mcp*.spec.ts` |
| Saúde | `src/lib/health/{schemas,service,store}.ts`, `src/lib/mcp/health.ts`, `src/app/api/health/` | `tests/health-*.spec.ts`, `agent-pilot.spec.ts` |
| Profissional | `src/lib/professional/`, `src/lib/mcp/professional.ts`, `src/app/api/professional/` | `tests/professional-*.spec.ts`, `agent-pilot.spec.ts` |
| Escritório/conversa | `src/lib/office/{store,chat-store,schema,auth,view}.ts`, `src/app/api/hermes/office/`, `integrations/hermes-office/` | `tests/office-{domain,api,ui}.spec.ts`; testes Python do pacote, sem alterar instalação externa |
| Storage/backup/privacidade | `src/lib/storage/{index,collection-lock}.ts`, `scripts/{backup-data,prebuild-backup,restore-backup,audit-git-privacy}.mjs`, `src/lib/public-branding.ts` | `tests/storage-concurrency.spec.ts`, `task-storage-lock.spec.ts`, `backup-restore.spec.ts`, `git-privacy-audit.spec.ts`, `branding.spec.ts` |

Regras a preservar: validar grafo inteiro atualizado para ciclos/vínculos; concluir só com dependências/filhos satisfeitos; recorrência atômica com sucessora estável, checklist resetado e sem clone de planning/parent/deps; reabrir/reconcluir não duplica, sucessora apagada não ressuscita. Exclusão valida vínculos antes do efeito Google. Jornada é capacidade bruta configurável, não livre Google; esforço ausente fica desconhecido, não zero estimado. Instantes/fuso de blocos existentes não mudam ao mudar a jornada.

Trava geral: escritores cooperantes no mesmo host/disco, dono PID/host/token e heartbeat; não substitui banco distribuído. Saúde e Escritório possuem stores próprios: não presumir que todos usam o mecanismo geral. Confirmar cada um antes de estender garantias.

## 7. Verificação de cada entrega de código

Ler [CI](ci-readiness.md), `.github/workflows/ci.yml`, configs e scripts antes de executar. Dependências observadas: Next `^16.3.8`, React `19.2.8`, Playwright `^1.62.1`; respeitar lockfile e guias em `node_modules/next/dist/docs/`.

```powershell
npm ci
node --test scripts/playwright-ci-setup.test.mjs
npx tsc --noEmit
npm run lint -- --max-warnings=0
npm run build
npx playwright install chromium
npx playwright test --config=playwright.ci.config.ts
```

**Antes do build**, apontar DATA/UPLOAD/BACKUP para pastas temporárias vazias e excluir credenciais externas herdadas do ambiente do processo; fixtures de autenticação/MCP/Office são sintéticas, conforme workflow/config. Não carregar `.env` pessoal. O config Playwright não isola retroativamente o prebuild. QA usa produção na porta 3107, um worker, zero retries, sem reusar servidor. `npm test` padrão usa desenvolvimento 3000 e não substitui esse gate.

Para teste novo, reproduzir falha relevante antes da correção e confirmar regressões relacionadas. Não esconder falhas com filtros/retries/timeouts globais. Não repassar `XDG_CACHE_HOME` temporário do servidor aos workers: instalação e worker precisam usar o mesmo cache Chromium do runner. Em Windows, tipos/build usaram limite de heap de 1536MB; 768MB foi insuficiente para tsc. Ajustar somente no processo da tarefa se necessário.

Registrar comando, exit code, contagem, duração e limitações. Incluir interfaces mobile/desktop, teclado, temas, erro/retry e proteção de cliques de conclusão para mudanças de UI. Testes Google devem usar mock; operação externa real é outra etapa autorizada. Para docs apenas, validar links/caminhos, consistência e `git diff --check`; não declarar suíte da aplicação repetida.

## 8. Evidências privadas e acesso futuro

Suplemento local, **fora do Git**: `C:/dev/jonny/lifesystem-task-qa-evidence/HANDOFF-CLAUDE-PRIVADO-2026-10-01.md`. Ele aponta logs, bundles, análise ignorada, demanda original Órion e detalhes da Central de Editais. Não copiar esses arquivos, dados pessoais ou imagens para commits públicos. A inexistência do suplemento em outro computador significa evidência local indisponível, não autorização para fabricar seus dados.

Se Jonny pedir acesso ao Hermes/VPS em uma próxima demanda, testar primeiro o alias SSH local `vps`, conforme `C:/dev/jonny/hermes/ACESSO-VPS.md`; não pedir credenciais de novo nem contornar verificação de host. Diagnóstico autorizado inicial: `ssh -o BatchMode=yes -o ConnectTimeout=12 vps "docker ps --format '{{.Names}} {{.Status}}'"`. Só instalação pessoal `hermes-agent-7faz-hermes-agent-1`; **nunca alterar/reiniciar `hermes-agent-tunm-hermes-agent-1`**. Antes de alteração autorizada, reler Compose/mounts/dados sem imprimir variáveis/tokens. Esse procedimento não concede autorização para alterar Hermes durante o trabalho LifeSystem.

## 9. Como fechar a próxima rodada

Entregar: problema resolvido e comportamento resultante; arquivos alterados; testes reais e limitações; contratos MCP/scopes/approval/receipt afetados; estado local/Git/produção com SHA e evidência separados; pendências remanescentes com próximo passo. Atualizar este handoff e roadmap. Não marcar “roadmap zerado” enquanto os gates acima estiverem abertos, nem usar tarefas preparatórias concluídas para encerrar ativações ainda não verificadas.
