# Roadmap e estado do LIFESYSTEM

Atualização: 29/09/2026. Este arquivo concentra o backlog atual. Planos e análises datados documentam a entrega da época; não são listas de pendências atuais.

## Entregue no código

| Área | O que existe | Limite atual |
| --- | --- | --- |
| Ciclo principal | Captura, conversão em sete destinos, Planejar, Hoje e revisão semanal | Revisão manual; não uma revisão automática por IA |
| Planejar | Fila sem data, semana, prioridades por dia, início/duração e capacidade diária | Um bloco por tarefa; disponibilidade 08–20h |
| Datas | Dia planejado e prazo usam `dueDate`; bloco guarda metadados de horário | Sem segundo prazo independente |
| Google Agenda | Espelho da agenda principal; criar/mover/remover blocos próprios e adoção explícita | Atualização explícita; sem múltiplas agendas ou espelho de contas/conteúdos |
| Financeiro | Meses passados/futuros, previsto vs realizado, gráficos/insights, cadastros e faturas | Saldos manuais; faturas separadas; sem gerar recorrências automaticamente |
| MCP/Hermes | Escopos por identidade, validações compartilhadas, auditoria, heartbeat e recibos | Locks em memória pressupõem um único processo |
| Interface | Navegação condensada, dock mobile, tema e identidade configuráveis | Marca não cobre todas as superfícies |

## Verificado na aplicação pública

Em 29/09, `/hermes` mostrou heartbeat `hermes-heartbeat` recente, estado Online, chamadas `hermes-mcp` e ausência de falhas recentes. **Test connection** no Hermes pessoal descobriu as ferramentas do servidor `lifesystem`. Nenhuma escrita financeira ou de Calendar foi feita nesta revisão.

Isso comprova conectividade real. Não comprova sozinho o SHA `98ced9e`: o conector Hostinger respondeu `401`, e o teste do Hermes apresenta nomes de ferramentas. Recibo exato de build/schema permanece pendente.

## Correções desta revisão local

- Captura rápida preserva texto em falhas, oferece botão por toque, bloqueia envios concorrentes e atualiza a fila.
- Revisão semanal mostra erro recuperável e impede concluir uma revisão que não carregou.
- Criação financeira MCP usa identidade determinística por cliente/operação/chave, evitando duplicação quando o lançamento salva e o recibo falha.
- Auditoria Git cobre caminhos com conteúdo idêntico, sem ler ou imprimir valores.
- Playwright de revisão usa diretório temporário, porta dedicada e credenciais sintéticas; não reutiliza servidor de desenvolvimento.

A integração/publicação desta revisão foi autorizada. O recibo de envio e a evidência da versão no site ficam em [deploy de produção](deploy-producao.md); autorização ou push isolados não comprovam presença em produção.

Verificação local final: **140 testes passaram** em servidor novo com dados sintéticos; tipos e build passaram; lint teve **0 erros e 125 avisos existentes**. A revisão independente encontrou duas lacunas de isolamento no QA, ambas corrigidas. O smoke de 18 rotas não certifica todas as interações nem acessibilidade integral.

## Prioridades reais

| Ordem | Pendência | Critério de conclusão |
| --- | --- | --- |
| P0 | Sanear histórico público e revisar documentação/imagens | [Auditoria de privacidade](privacidade-historico.md); autorizar reescrita após revisão da cópia preparada |
| P1 | Confirmar build e contrato financeiro no runtime | Recibo Hostinger com SHA ou schema autenticado exigindo `idempotencyKey`; retry com dados sintéticos |
| P1 | Integrar e publicar esta revisão | Suite, lint, tipos, build e revisão independente; fluxo nativo Hostinger |
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
