# Espaço profissional e contrato Sirius / Hermes

**Goal:** projetos profissionais com contexto progressivo, CRM, entregas e trabalhos de agente sujeitos a aprovação autenticada.

**Architecture:** um domínio profissional opt-in, por ID de projeto e marca explícita, sem inferência por nome. Serviços compartilhados por REST e MCP. Um ledger atômico de propostas, aprovações, recibos e eventos conserva o histórico; trabalhos de execução são separados das tarefas de negócio. Hermes é responsável pela execução, LifeSystem pelos registros de negócio.

**Tech Stack:** Next 16, React, Zod, armazenamento JSON com lock e gravação atômica existentes, MCP SDK e Playwright isolado.

**Spec:** pedido do usuário de 30/09/2026, arquivo Texto colado.txt (62a8b4d3-64c6-4b4e-93c5-bf70cda1b3bd). A configuração do Hermes fica na outra sessão.

## Restrições e decisões

- Execução local nesta sessão, sem push/deploy, alterações na VPS, cron, mensagens ou publicação externa.
- Nenhuma migração destrutiva nem preenchimento automático de fatos em projetos existentes.
- Marcas: arco-labs, arcopass, atelie-studio e freelance. Outros projetos não entram no contexto profissional sem associação humana explícita.
- Metas declaradas permanecem configuráveis e nunca são contabilizadas como realizado.
- Aprovação humana exige cookie de sessão válido no servidor, inclusive em desenvolvimento. Bearer de agente não concede aprovação.
- O contrato Hermes será v1, com adapter simulado. Nenhuma API/webhook nativa será presumida; a outra sessão informa versão, capacidades e transporte autenticado antes do adapter real.
- Dados novos e aprovação ficam em coleções separadas; registros legados continuam válidos. Referências de projeto são verificadas por ID.

## Cortes de implementação

- [x] Contexto e work briefs: schemas opcionais para fatos/hipóteses/desconhecidos, responsáveis, marcos, recursos, aceite e dependências. Leitura consolidada e lacunas; teste de isolamento por marca/projeto.
- [x] CRM e campanhas: empresas/contatos pesquisados, evidência, verificação, preferência de contato, oportunidades e valores distintos. Deduplicação por canais/URL explícitos; nenhum contato inventado. Testar idempotência e conflitos.
- [x] Ledger de propostas/aprovações: alteração concreta com versão e hash, escopo, validade, ator; aprovação autenticada. Aplicação idempotente, recibo e resultados parciais; nenhum comando de envio/publicação. Testar sim genérico, versão alterada, expiração e concorrência.
- [x] Trabalhos externos e entregas versionadas: estado de execução separado da revisão e conclusão de negócio; IDs estáveis, vínculo board/card, eventos monotônicos, reconciliação e adapter simulado. Testar repetição, timeout, eventos fora de ordem e revisão atual.
- [x] API/MCP: consultas compactas paginadas, contexto profissional/dia/semana, pesquisa e filtros, propostas, aprovação consultável, artefatos e eventos. Escopos de leitura/proposta/execução/artifact distintos; nenhuma ferramenta de autoaprovação.
- [x] Interface profissional: contexto revisável, oportunidades, listas, propostas e Review, objetivos separados de financeiro. Reutilizar linguagem visual e controles responsivos das cinco telas.
- [x] P0 existentes: convert_capture verifica domínio de destino; Calendar com ID estável antes do efeito remoto; efeitos de etapas de edital centralizados no servidor; campos de conteúdo alinhados com MCP.
- [x] Verificação: testes de domínio/REST/MCP e piloto simulado, suíte isolada, lint, tipos, webpack. Handoff documenta schemas, escopos, exemplos, limites e dependências reais.

## Arquivos e contratos

- `src/lib/professional/{schemas,store,service,queries,hermes}.ts`: contratos tipados, transação do ledger, regras de negócio, consultas e adapter simulado.
- `src/lib/mcp/professional.ts`: ferramentas usando os mesmos serviços; `auth.ts` registra apenas escopos autorizados.
- `src/app/api/professional/route.ts`: consultas e comandos; `approval/route.ts` valida identidade humana.
- `src/app/(dashboard)/profissional/page.tsx`: UI progressiva, revisão de campos exatos e entregas.
- `src/lib/{capture-conversion,edital-service,google-calendar}.ts`: correções de efeitos compartilhados.
- `tests/professional-*.spec.ts`, `tests/mcp-*.spec.ts`: dados sintéticos e adapter simulado, sem serviços externos.
- `docs/sirius-hermes-handoff.md`: contrato versionado e configuração do piloto.

## Review focus

Dados antigos sem contexto devem apresentar lacunas. Referências entre marcas devem falhar. Uma aprovação jamais deve valer para versão nova. Repetição depois de falha de recibo deve reencontrar o mesmo ID. Concluir execução não conclui tarefa nem aprova entrega. Sem credencial humana configurada, aprovação falha fechada.

## Evidência de encerramento local — 30/09/2026

- Suíte completa isolada: **161 passed (2.9m)**, `C:/dev/jonny/lifesystem-current-suite-local.log`.
- Após os ajustes finais de recuperação de revisão/projeção e identificação do trabalho nas tarefas: **12 passed (31.8s)**, `C:/dev/jonny/lifesystem-current-final-focused-local.log`.
- `npx tsc --noEmit`: exit 0, `C:/dev/jonny/lifesystem-current-types-final-local.log`.
- `npm run lint`: exit 0; zero erros, 116 avisos existentes, `C:/dev/jonny/lifesystem-current-lint-final-local.log`.
- `npm run build` (`next build --webpack`): exit 0, `C:/dev/jonny/lifesystem-current-build-final-local.log`.
- Revisão independente somente leitura: colisões de conteúdo legado, recuperação após timeout de criação/atualização, transferência entre trabalhos, duplicação de contexto e aliases históricos foram corrigidos; nenhum bloqueio importante restante relatado.
- Cadastros financeiros: testes de abrir/salvar/arquivar/reativar, nomes resolvidos na UI/MCP/orçamento e preservação de valores/status/datas. Captura `C:/dev/jonny/lifesystem-category-dialog-local.png`.
- Preview profissional: `C:/dev/jonny/lifesystem-professional-390.png` e `C:/dev/jonny/lifesystem-professional-1440.png`.
- Handoff: `docs/sirius-hermes-handoff.md`.

Entrega permanece local, sem commit/push/deploy. O piloto de execução real depende do adapter/transporte autenticado do Hermes, a configurar na outra sessão. Não há integração Kanban real presumida nem cron instalado.
