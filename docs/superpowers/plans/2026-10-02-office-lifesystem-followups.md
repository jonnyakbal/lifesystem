# Melhorias da estação no LifeSystem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Este documento organiza trabalho futuro; não executar alterações de VPS nem tratar checklists abaixo como implementadas.

**Goal:** Evoluir a conversa já publicada com leitura melhor, procedência verificável, histórico sustentável e validação das capacidades, preservando a ponte instalada.

**Architecture:** Manter a fila/recibo e APIs do consumidor atuais. Evoluções de interface e consultas autenticadas ficam no LifeSystem; arquivamento mantém índices de idempotência e recibos, enquanto validação MCP usa contratos/atores reais ou fixtures explicitamente sintéticas. Qualquer extensão que exija consumidor novo deve ser opcional/versionada e entregue como contrato à sessão Hermes, sem configuração de VPS aqui.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Zod / JSON com proper-lockfile; Playwright e MCP SDK já instalados. Sem dependência nova obrigatória, banco distribuído ou chamadas adicionais de IA.

**Spec:** [continuidade cloud](../../CONTINUIDADE-CLAUDE-CLOUD.md), [conversa entregue](../../office-chat-plan.md), [Órion 1.2](../../integrations/orion-health-mcp.md), [Sirius 1.0](../../sirius-hermes-handoff.md). Derivado da leitura autorizada do registro externo CONVERSA-ESCRITORIO.md em 02/10/2026; seu resumo técnico está versionado na entrada cloud.

## Global Constraints

- Sessão LifeSystem: código, interface, APIs e testes. Outra sessão: configuração/consumidor Hermes pessoal na VPS. Não alterar Hermes Dona Maria, Hermes pessoal ou Arco CRM aqui.
- Consumidor atual 1.4.0; manter `/sessions`, `/events`, `/commands` e `ChatJob` aceitos hoje. GET não infere; seleção de agente não envia; claim já retirado nunca volta automaticamente à fila.
- Autenticação por sessão humana para chat/histórico/manutenção. Token do publisher não autoriza navegação no histórico humano nem arquivamento. Nunca expor `claimSession`, tokens, configuração/relatos ou conversa em telemetria/logs.
- Preservar limites: 6000 caracteres enviados, 24000 de resposta transportada, quatro pendentes, 100 envios/24h; 1000 atualmente bloqueia manutenção. Não remover o bloqueio sem solução persistente de retenção/recibos testada.
- Propostas/aprovações MCP são separadas da conversa. Não aceitar `human:true`, hash arbitrário ou texto “sim” como aprovação nem transformar Review em negócio concluído.
- Testar com dados sintéticos; não abrir histórico pessoal, chamar inferência real, arquivar conversas reais ou criar eventos Google para QA. Não publicar segredos/artefatos privados.

## Review Focus

1. Envio incerto e replay depois de arquivar: deve retornar a mesma intenção e recusar payload diferente, sem inferência nova.
2. Resultado tardio de sessão aposentada com recibo válido: precisa confirmar o mesmo atendimento após manutenção, sem reabrir a fila.
3. Arquivamento não pode zerar quotas diárias, mover atendimentos ativos ou tornar indisponível o histórico sem confirmação.
4. Polling/resposta grande não deve roubar posição/foco do leitor nem executar conteúdo ativo ou misturar perfis.
5. Catálogo recebido, heartbeat recente e contrato MCP aprovado são evidências distintas; falha/frescura desconhecida não pode virar “capacidade verificada”.

## E1 — leitura de respostas longas

**Files:** modificar `src/components/office/agent-chat.tsx` e `chat.module.css`; criar `src/components/office/chat-response.tsx` se necessário para separar leitura; testar `tests/office-ui.spec.ts`.

**Interface:** consumir `ChatJob.response` atual como texto, sem mudar POST/commands. Produzir leitura expandida por mensagem e ação Copiar que copia somente o texto recebido. O limite de transporte não informa truncamento: texto com 24000 caracteres sozinho não prova que foi cortado.

- [ ] Criar teste UI que retorna resposta sintética extensa e mensagens anteriores; simular usuário lendo acima do final e um polling com mudança de status. Exigir manutenção da posição, botão Novas mensagens/Ir ao fim e nenhuma nova chamada POST.
- [ ] Testar Expandir/Recolher, copiar com permissão negada, teclado, foco, desktop/mobile, texto sem espaços, listas e bloco de código como texto seguro. Payload com HTML/script deve permanecer inerte; não usar `dangerouslySetInnerHTML` com a resposta.
- [ ] Implementar painel de leitura maior/expansível, contador/timestamp úteis, scroll automático somente quando já perto do fim ou após envio humano. Manter controles acessíveis e respeito a reduced motion.
- [ ] Se adicionar Markdown, reutilizar renderer seguro existente apenas após conferir sua sanitização e URLs; não instalar dependência só para esse corte. Copiar deve preservar texto original recebido, não HTML.
- [ ] Acrescentar teste de seleção/reabertura de perfil que mantém histórico separado, draft/retry e confirmação incerta atuais. Não duplicar jobs por polling/out-of-order.
- [ ] Rodar `npx playwright test --config=playwright.ci.config.ts tests/office-ui.spec.ts` com build sintético isolado; tipos/lint e regressões da estação conforme gate final. Documentar que original além do limite continua sob histórico nativo do Hermes, sem prometer recuperação pela UI.

**Dependência externa:** só a futura oferta de resposta completa/truncation metadata precisaria de extensão opcional do consumidor. Não aumentar o limite de comandos unilateralmente nem buscar o SQLite da VPS.

## E2 — procedência das fichas e estados verificáveis

**Files:** modificar `src/lib/office/view.ts`, `src/components/office/agent-sheet.tsx`, chamadas em `office.tsx` e estilos; testar `tests/office-domain.spec.ts`, `tests/office-ui.spec.ts`.

**Interface:** projeção de UI derivada de catálogo recebido, `provenance`, revisão/sessão correspondentes e frescura do snapshot. Sem mudar payload exigido do publisher; preservar `catalogCurrent` para leitores existentes e adicionar campos de apresentação apenas se necessário.

- [ ] Criar testes sintéticos para sem catálogo, catálogo local, deployed correspondente, revisão divergente, sessão diferente e heartbeat >90s; executar antes de editar e conferir falha específica da distinção ausente.
- [ ] Separar mensagens: “Referência local”, “Catálogo recebido da instalação”, “Catálogo aguardando confirmação de revisão” e “Estado sem sinal recente”. Não traduzir ausência de catálogo correspondente como falha da conversa já funcional.
- [ ] Mostrar revisão e data existentes sem fabricar `verifiedAt`/`checkedAt`. Manter disponibilidade da ação separada da procedência; verificação mais antiga que 24h continua desatualizada.
- [ ] Testar apresentação igual em modo estação/lista, leitura mobile, foco e nenhum envio por abertura de ficha. Catálogo deployed com ação pending permanece pending.
- [ ] Rodar testes domínio/UI da estação e atualizar o recibo de UI. Divergência real de hashes ou publicação de catálogo é tarefa da sessão Hermes; apenas mostrar diagnóstico sanitizado e preparar contrato para ela.

## E3 — histórico paginado e arquivamento preservando recibos

**Files:** modificar `src/lib/office/chat-store.ts`, `schema.ts`, `store.ts` e `/api/hermes/office/chat/route.ts`; criar `src/lib/office/chat-history.ts` e `/api/hermes/office/chat/history/route.ts` para consulta/manutenção; UI em `agent-chat.tsx` ou componente próprio; testes novos `tests/office-chat-history.spec.ts` e regressões domain/API/UI atuais.

**Interfaces candidatas, ainda não implementadas:**

- GET `/api/hermes/office/chat/history?agentId=<id>&before=<cursor>&limit=<1..50>&archived=<boolean>` → `{jobs,nextCursor,activeCount,archivedCount}`; cursor estável por `(createdAt,id)`, perfil/instalação fixados no cursor validado; manter GET `/chat?agentId=` atual compatível.
- POST `/api/hermes/office/chat/history` com `{op:"archive",requestId,agentId,before,expectedRevision}` → `{receiptId,archivedCount,remainingCount,revision}`. Limitar seleção e exigir sessão/origem; não aceitar parâmetro de caminho/instalação arbitrário. UI apresenta prévia/quantidade e confirmação antes de efeito.
- Índice durável de cada intenção conserva `id`, `clientId`, `agentId`, fingerprint dos campos, estado terminal, horário e referências de recibo para lookup. Textos arquivados permanecem privados e consultáveis; não são anexos Git nem exportação automática.

- [ ] Testar paginação >50, igualdade de timestamps, cursor inválido/de outro perfil, 401 sem cookie/Bearer-only e leitura durante arquivamento. Não usar offset que salta/duplica itens após novos envios.
- [ ] Testar 999/1000 registros e manutenção concorrente: queued/claimed/running não podem ser arquivados. Interrompidos com recibo terminal ainda incerto também permanecem no conjunto recuperável; expirar não é prova de conclusão externa.
- [ ] Fixar estratégia de persistência antes do código: arquivo(s) de arquivo imutáveis preparados sob trava, índice/revisão da instalação publicados atomicamente e lookup de intenção/recibo independente da posição no histórico ativo. Um arquivo preparado mas não referenciado é órfão recuperável, não operação concluída; rollback não apaga arquivo privado referenciado.
- [ ] Usar requestId e recibo estável da manutenção. Injetar falha antes/depois de persistir arquivo e antes/depois de publicar índice; retry deve concluir a mesma intenção. Sem declaração de transação distribuída entre arquivos.
- [ ] Testar retry de `submitChat` com clientId arquivado: mesmos campos retornam atendimento original; campos diferentes conflitam. A contagem dos 100 envios/24h inclui registros arquivados; manter índice de quotas/recibos fora do conjunto que é compactado.
- [ ] Testar `commandTransaction` com replay de resultado terminal e `receiptSession` antigo válidos após manutenção; confirmar recibo idempotente, sem nova claim/inferência. Nunca expor essa referência interna no histórico/browser.
- [ ] Definir limite de arquivo/índice, aviso preventivo e manutenção explícita com critérios de retenção. Não fazer exclusão silenciosa nem arquivamento automático irreversível; se exportação privada futura for necessária, projetar como operação humana própria.
- [ ] Implementar Ler anteriores/Arquivadas e manutenção na UI; sucesso deve liberar capacidade real sem apagar conteúdo/identidade. Testar erro/retry, voltar da leitura arquivada e armazenamento inválido/bloqueado.
- [ ] Rodar testes novos e estação existente em config de produção isolado; verificar adaptação v1 sem alteração do consumidor e atualizar documentação de backup para incluir arquivos/index referenciados. Publicar apenas após revisão de falhas parciais.

**Aceite:** usuário acessa histórico antigo e mantém atendimento utilizável ao liberar o conjunto ativo; falhas não duplicam atendimento, perdem recibo ou burlam quota. Se um desenho depender de extensão Hermes, registrar o contrato e deixar essa parte opcional até a outra sessão confirmar implementação.

## E4 — capacidades efetivas por contrato MCP

**Files:** `src/lib/mcp/{auth,health,professional}.ts`, `src/lib/office/view.ts`, `src/components/office/agent-sheet.tsx`; criar `tests/agent-contract-http.spec.ts` e diagnóstico de apresentação se necessário. Reutilizar `/api/mcp`, `/api/health/approval`, `/api/professional/approval`, os manifests em docs e `tests/agent-pilot.spec.ts`.

**Interface:** relatório sanitizado por capacidade contendo domínio, contrato/tools/scopes observados, data, tipo de evidência (`synthetic-contract`, `runtime-discovery`, `approved-operation`) e estado `unknown|configured|verified|failed|stale`. Associação credencial↔perfil deve ser explícita, sem assumir que keyId coincide com nome do robô. Não criar ferramenta MCP de aprovação humana nem retornar token/config completa.

- [ ] Construir servidor HTTP sintético isolado, login humano e duas identidades dedicadas; testar tools/list, schema, negações por token/escopo, filtros de dados e limites. Execução pelo handler direto/SDK não substitui o transporte HTTP.
- [ ] Órion: descobrir contrato 1.2, propor relato sintético, recusar autoaprovação, aprovar pela sessão humana, aplicar e recuperar recibo; payload/revisão diferente e expiração recusados. Testar disponibilidade desconhecida quando Calendar falha.
- [ ] Sirius: descobrir 1.0, associar projeto sintético explícito, propor escopo, aprovação exata, aplicar, consultar job queued e recibo; negar ator estrangeiro. Não simular que adapter contract-only executou trabalho externo nem que Review concluiu negócio.
- [ ] Para os demais agentes, inventariar ferramentas/capacidades atuais do catálogo e declarar o que não tem contrato/piloto. Não inventar saúde/financeiro/CRM autorizado por habilidade descrita; não usar token genérico para certificar a identidade dedicada.
- [ ] Exibir evidência de descoberta separada de operação aprovada e de telemetria/catálogo; verificação sintética jamais ganha etiqueta “validado em produção”. Falha informa código/escopo sanitizado, sem payloads pessoais.
- [ ] Preparar checklist entregue à sessão Hermes para conferência da configuração/perfil/credencial real. Escrever manifesto no repositório; não enviar mensagem à sessão sem autorização, não configurar VPS nem produzir segredo aqui.
- [ ] Executar os testes HTTP, health/professional/office existentes e gate final; registrar cobertura e o que permanece pendente de validação coordenada em produção.

## Gate de cada entrega e publicação

- [ ] Checkout isolado e build com DATA/UPLOAD/BACKUP vazios, sem `.env` pessoal; setup/auth/credenciais exclusivamente sintéticos conforme [CI](../../ci-readiness.md).
- [ ] Testes relevantes com falha reproduzida e regressões aprovadas; tipos, `npm run lint -- --max-warnings=0`, `npm run build` (webpack) e `npx playwright test --config=playwright.ci.config.ts`. Registrar saídas reais, zero retries.
- [ ] Rever diff e compatibilidade do contrato v1; nenhuma mudança de runtime externo, chave ou implantação empresarial. Não misturar as entregas com arquivos ignorados/stash/worktrees locais.
- [ ] Atualizar plano/roadmap/recibo; integrar somente dentro da autorização da rodada. CI remota e publicação Hostinger têm evidências separadas; UI/chat real só é certificada mediante observação efetiva autorizada.
