# Continuidade do LifeSystem no Claude na nuvem — 02/10/2026

Esta é a entrada atual da sessão. Jonny autorizou consolidar as pendências e publicar a documentação no GitHub para continuar no Claude na nuvem. A entrega desta rodada é documentação: as melhorias descritas continuam por implementar. Leia [AGENTS](../AGENTS.md), [handoff completo](HANDOFF-CLAUDE.md), [roadmap](ROADMAP.md) e [plano das melhorias da estação](superpowers/plans/2026-10-02-office-lifesystem-followups.md).

## Divisão de responsabilidades

| Sessão | Responsabilidade |
| --- | --- |
| LifeSystem / Claude na nuvem | Código deste repositório, interface, APIs, domínio, testes, documentação e preparação dos contratos de integração |
| Hermes pessoal / outra sessão | Configuração na VPS: perfis, skills, modelos, memória, revisão noturna, canais, orquestração e consumidor da integração |
| Arco CRM / sessão própria | Configuração/integração do CRM; confirmar contrato final antes de habilitar dependências comerciais de Sirius |

Não alterar/reiniciar Hermes pessoal ou empresarial nesta sessão, nem tentar acesso à VPS para completar uma tarefa LifeSystem. **Nunca alterar Hermes Dona Maria.** Não enviar mensagem a outra sessão sem autorização explícita. Mudanças de protocolo necessárias devem ser documentadas como contrato versionado para a sessão responsável, sem quebrar a ponte já instalada.

## Base já entregue — preservar

- Base de código conferida: `c42a2e5b24ee915c744d4aa230695ea48dccff75`, main/origin/main sincronizadas antes desta publicação documental.
- Conversa da estação implementada em `316b981`, integrada em `92db730`; o recibo `0660827` está integrado em main. Hostinger concluiu `92db730` em 01/10 às 18:20 e Chrome mostrou respostas reais de Sirius e Hermes, com históricos separados. [Recibo versionado](office-chat-plan.md).
- A sessão Hermes confirmou ponte/consumidor pessoal 1.4.0 e conversa própria por perfil, com memória/ferramentas do perfil. A infraestrutura VPS não precisa ser reinstalada para melhorar a UI.
- Pedidos vêm de sessão humana; consumidor usa credencial exclusiva; clientId protege retry, resultados são persistidos antes de reentrega e pedido retirado da fila não é reexecutado automaticamente após reinício. Polling nunca inicia inferência. Nada é enviado ao WhatsApp/Telegram por esse fluxo.
- Limites atuais verificados no código: últimas 50 mensagens por perfil na leitura, 1000 pedidos persistidos por instalação antes de bloquear manutenção, 100 envios/24h, quatro pendentes; entrada 6000 caracteres e resposta transportada até 24000. Jobs interrompidos podem receber recibo terminal tardio válido, sem nova execução.
- O [run 36928569715](https://github.com/jonnyakbal/lifesystem/actions/runs/36928569715) passou para o código-base c42a2e5. As contagens históricas de 352 testes de produtividade e de 20 testes da estação pertencem às respectivas rodadas; não são resultado de uma nova execução deste repasse.

## Pendências novas da estação, conferidas no código

| ID | Entrega | Estado e critério principal |
| --- | --- | --- |
| E1 | Respostas longas legíveis | Atualmente texto simples em painel de 330px; polling força scroll ao fim. Adicionar leitura expandida, copiar e navegação sem perder posição, com renderização segura e nenhuma inferência extra |
| E2 | Procedência clara nas fichas | `catalogCurrent` exige revisão/sessão compatíveis; `deployed` é condição adicional na UI. Diferenciar catálogo local, recebido, divergente e estado sem sinal recente. Não trocar flag/hash para fabricar confirmação |
| E3 | Histórico navegável e manutenção | Hoje não há paginação nem arquivamento para liberar o limite de 1000. Implementar histórico/arquivamento autenticado, mantendo idempotência, recibos tardios e limite de 100 envios/24h mesmo após arquivar |
| E4 | Capacidades efetivas dos agentes | Catálogo/action availability e conversa concluída não comprovam operações MCP protegidas. Acrescentar validação por contrato/escopo/proposta/aprovação/recibo e exibir o que foi realmente verificado |

O [plano E1–E4](superpowers/plans/2026-10-02-office-lifesystem-followups.md) traz arquivos, contratos propostos, testes e compatibilidade. Sugestão: E1/E2 em um primeiro corte de UI sem alteração do consumidor; E3 como entrega própria de persistência; E4 em paralelo lógico, com validação HTTP local antes de ativação real coordenada. Não executar arquivamento sobre conversas reais só para demonstrar a função.

## Demais pendências preservadas

O [handoff](HANDOFF-CLAUDE.md) contém a checklist detalhada. Não reduzir o backlog somente à estação:

1. Preservar/reconciliar trabalho local de tarefas antes de limpar worktrees; preparar auditoria de privacidade e candidata atualizada de histórico. Qualquer reescrita pública continua dependendo de aprovação específica de refs/candidata/janela.
2. Reforçar trava própria do ledger de saúde, que atualmente recupera por idade sem dono/heartbeat; reproduzir concorrência antes da correção. Conciliar janela fixa 08–20 do brief de saúde com jornada configurável de Planejar.
3. Piloto HTTP real do LifeSystem para Órion/Sirius com tokens sintéticos dedicados, middleware, descoberta/schema, aprovações humanas e recibos. O piloto SDK é incompleto para esse transporte; o adapter professional ainda é `contract-only`.
4. Verificação após releases, acessibilidade/desempenho da estação, backup consistente/manifesto e ensaio privado de restauração em destino isolado.
5. Conferir registro já existente do edital LIC-SM 2027 antes de criar duplicata; deadline informado 26/10/2026 às 17h. Preparar dados/pendências na UI sem enviar inscrição ou expor documentos pessoais. Verificar tarefa concluída por engano sem reabrir registros ao acaso.
6. Agenda v2 em fases A–F, conforme [especificação](agenda-expansion-contracts.md): projeção, blocos extras, seleção de agendas, espelhos com consentimento/outbox, sync incremental e worker opt-in. Documentação não equivale a implementação; preservar primário v1 e não criar Gantt.
7. Varredura funcional e visual das demais rotas, priorizando produtividade, falhas recuperáveis, acessibilidade e conexões úteis; conferir o código atual antes de implementar specs antigas de Fontes ou outras áreas.

Decisões invariantes: título de tarefa abre detalhes, Concluir é explícito com recuperação; dia de Planejar é o prazo, sem duas datas concorrentes; Foco/Carga incluídos e Gantt excluído; previsto financeiro não é pago; identidade da intenção, não texto/valor, protege duplicação. Leituras health/professional não têm ACL isolada por agente no mesmo domínio pessoal; não prometer isso.

## O que a nuvem tem e o que continua local

O GitHub passa a conter as instruções/pendências/contratos/evidências sanitizadas desta rodada, incluindo os documentos do handoff que antes estavam modificados localmente. Caminhos `C:/...` no handoff antigo indicam a localização histórica das evidências; **não são pré-requisitos para programar na nuvem**. Usar caminhos relativos ao checkout e reconstruir evidências com fixtures sintéticas.

Não estarão no GitHub, por conterem runtime/segredos ou por serem artefatos locais:

- `.env.local`, dados pessoais em `data/`, configuração local `.claude/launch.json`, screenshots/traces e backups privados;
- um stash local da main, com seis arquivos modificados, e mudanças preexistentes em outro worktree;
- snapshot privado de 16 arquivos desse worktree (6 iguais e 10 diferentes de main), logs originais, bundles de recuperação/candidata e suplemento com dados pessoais;
- documentos/briefings/configuração do repositório Hermes fora deste checkout.

Esses itens não foram importados como funcionalidades novas. A análise que depende de seus conteúdos fica para sessão local autorizada; **não bloquear E1/E2/E3 ou os testes sintéticos de E4 por falta desses arquivos**. Não reconstruir segredos nem dados pessoais e não usar um sandbox vazio como prova de que os registros não existem em produção. A candidata privada baseada em 4ee5545 está desatualizada; não fazer force-push na nuvem.

Fonte externa lida nesta rodada: `C:/dev/jonny/hermes/CONVERSA-ESCRITORIO.md`. Seu conteúdo técnico necessário foi internalizado acima e no plano E1–E4: conversa já entregue, responsabilidades e quatro evoluções. Não é preciso ter acesso ao arquivo privado para continuar essas tarefas.

## Executar e concluir na nuvem

1. Ler instruções, conferir HEAD/origin/status e preservar alterações concorrentes. Não repetir a implementação da conversa existente.
2. Escolher uma entrega da sequência acima e desenvolver testes/código em checkout isolado. Ler os guias do Next instalado antes de editar.
3. Usar [CI isolada](ci-readiness.md): diretórios vazios para data/uploads/backups também no build, credenciais externas vazias e auth/MCP/Office sintéticas. `npm ci`, testes do setup, tipos, lint zero avisos, build webpack e Playwright de produção na porta 3107, zero retries. No Linux, manter cache Chromium do runner separado do cache do servidor.
4. Abrir PR ou publicar somente dentro da autorização da próxima rodada. Push em main dispara integração Hostinger; aprovação da CI não prova deploy. Não modificar produção/credenciais nem realizar escrita externa para testar sem autorização específica.
5. Entregar arquivos, comandos/resultados reais, comportamento, contratos afetados, compatibilidade com consumidor 1.4.0, limitações e estado Git/produção. Atualizar esta entrada, o roadmap e o recibo da entrega. Não marcar melhorias futuras como já implementadas.

Verificação desta publicação documental: 13 arquivos de documentação/instruções revisados; 66 links locais conferidos sem destino ausente; imports do CLAUDE e `git diff --check` aprovados. Apenas documentação foi alterada; suíte da aplicação, build e runtime externo não foram executados nesta rodada. Logs antigos são referências históricas. Confirmar o commit remoto e a CI após o push, sem anunciar um novo deploy como certificado por isso.
