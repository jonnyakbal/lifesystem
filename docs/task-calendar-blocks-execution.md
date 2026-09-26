# Tarefas com horário e espelho Google — execução

Escopo aprovado: etapas 1–3 do roadmap. Um bloco opcional por tarefa, separado do prazo; criação e replanejamento do mesmo evento Google; erro recuperável sem perder o planejamento.

## Decisões

- Preservar `dueDate` como prazo; `planning` na tarefa contém o dia e bloco opcionais. Tarefas antigas continuam aparecendo pelo prazo até receber planejamento explícito.
- Endpoint específico valida planejamento; metadados Google são internos, não aceitos do cliente.
- Agenda principal nesta entrega, com escopo OAuth já existente. Leitura não exige outro consentimento com `calendar.events`.
- Identificador Google reservado localmente antes da chamada, GET antes de gravar, marcador de propriedade e ETag para evitar duplicações e sobrescritas externas.
- Falha externa preserva plano local e informa erro; tentar novamente é explícito. Uma edição local de bloco espelhado atualiza Google automaticamente ao salvar.
- Remover planejamento solicita confirmação antes de excluir somente seu evento gerenciado. Excluir/concluir tarefa não apaga eventos Google.
- Fuso do dispositivo identificado na interface; instantes enviados com offset/UTC, datas e intervalos validados.

## Etapas e validação

1. Testes de domínio: prazo preservado, horários inválidos, criação repetida, replanejamento, falha/retry, conflito, remoção.
2. Adaptador Google e serviço de planejamento com endpoint autenticado pela proteção existente.
3. Planejar: dia / horário / duração / espelho, exibir bloco e estado, retry e remoção confirmada; deduplicar eventos vinculados na visão.
4. Testes UI mobile e desktop, tipos, build, suíte e revisão; integrar em main e verificar deploy conforme autorização vigente.

## Registro

- Iniciado a partir de `6d9ac9b`. Implementação na branch `feat/task-calendar-blocks` do checkout atual, mantendo arquivos não rastreados do usuário.
- Implementado planejamento independente, dia/bloco, vínculo Google reservado antes da escrita, recuperação de confirmação perdida, ETags, erros persistentes e adoção explícita do título/horário externo.
- Revisão independente identificou e motivou correções para confirmação perdida seguida de nova edição, conflitos sem saída, exclusão concorrente e horário de verão ambíguo. Exclusões individuais/em lote de tarefas espelhadas são bloqueadas atomicamente na persistência até remoção confirmada do bloco em Planejar.
- Decisão: um bloco por tarefa, agenda principal, sincronização ao salvar/repetir; sem trabalhador de fundo nem ampliação do OAuth nesta entrega. Mudanças de título em outros módulos serão enviadas na próxima gravação do bloco.
- Validação final: `npm test` — 96 testes passaram; `npx tsc --noEmit` passou; ESLint dos arquivos alterados sem avisos/erros; `npm run build` passou. Revisão independente final sem novos problemas importantes. Chrome de produção mostrou conexão Google ativa e eventos externos visíveis antes do deploy.
