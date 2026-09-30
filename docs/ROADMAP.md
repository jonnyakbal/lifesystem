# Roadmap e estado do LIFESYSTEM

Atualização: 30/09/2026. Este arquivo concentra o backlog atual. Planos e análises datados documentam a entrega da época; não são listas de pendências atuais.

## Entregue no código

| Área | O que existe | Limite atual |
| --- | --- | --- |
| Ciclo principal | Captura, conversão em sete destinos, Planejar, Hoje e revisão semanal | Revisão manual; não uma revisão automática por IA |
| Planejar | Fila sem data, semana, prioridades por dia, início/duração e capacidade diária | Um bloco por tarefa; disponibilidade 08–20h |
| Datas | Dia planejado e prazo usam `dueDate`; bloco guarda metadados de horário | Sem segundo prazo independente |
| Google Agenda | Espelho da agenda principal; criar/mover/remover blocos próprios e adoção explícita | Atualização explícita; sem múltiplas agendas ou espelho de contas/conteúdos |
| Financeiro | Meses passados/futuros, previsto vs realizado, gráficos/insights, cadastros e faturas | Saldos manuais; faturas separadas; sem gerar recorrências automaticamente |
| MCP/Hermes | Escopos por identidade, validações compartilhadas, auditoria, heartbeat e recibos | Saúde e tarefas usam bloqueio entre processos; demais coleções JSON ainda exigem cuidado com gravações concorrentes |
| Saúde/Órion | Contrato 1.2, contexto/observações, propostas/aprovações/recibos e ponte de tarefas/Planejar | Credencial exclusiva e transporte no Hermes ainda precisam de ativação verificada |
| Profissional/Sirius | Contrato incremental, propostas, aprovações e recibos no LifeSystem | Piloto de transporte real ainda não certificado; Hermes/Arco CRM não alterados |
| Interface | Navegação condensada, dock mobile, tema e identidade configuráveis | Marca não cobre todas as superfícies |

## Revisão atual: tarefas e preparação da ativação

- Hoje separa título (abrir detalhes) de botão Concluir, oferece Desfazer e mantém Concluídas hoje com Reabrir.
- Tarefas oferece Em aberto/Concluídas/Todas, contagem real, busca incluindo concluídas e ordenação por conclusão recente.
- Etapas removidas continuam visíveis; etapas terminais personalizadas são reconhecidas sem reescrever dados.
- Recorrência lenta não bloqueia Reabrir e sua próxima ocorrência aparece sem reload. Reabrir preserva a ocorrência seguinte. A proteção contra repetir a geração é desta sessão; idempotência persistente de recorrências segue como pendência própria.
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
| P1 | Ativar credenciais/transportes Órion e Sirius | Testar cada identidade dedicada, contrato, proposta/aprovação/recibo; sem chave genérica nem mudança em Hermes nesta sessão |
| P1 | Idempotência persistente das recorrências de tarefas | Reabrir/reconcluir e retry entre sessões não criam próxima ocorrência duplicada |
| P1 | Manter verificação após cada release | Comparar SHA, recibo Hostinger e comportamento público; CI separada do deploy |
| P1 | Reduzir avisos de lint e revisar módulos secundários | Correção por fluxo; critérios mobile, claro/escuro e teclado em [direção visual](astral-redesign.md) |
| P2 | Marca em login, metadados e PWA | Configuração coerente em todas as superfícies |
| P2 | Restaurar backup em instalação isolada | Recuperar coleções e conferir integridade sem serviços externos |
| P2 | Evoluir capacidade diária | Jornada configurável, sobreposição e duração prevista; sem agendamento silencioso |
| P3 | Evoluções opcionais | Subtarefas, múltiplos blocos/agendas, espelho financeiro/editorial e sync incremental requerem especificação |

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
