# Foco e Carga — 01/10/2026

Pedido autorizado: adicionar Foco e Carga às visões de Tarefas e implantar o conjunto; Gantt fora do escopo. Ampliação bounded dos fluxos existentes, execução inline, frontend-design/TDD e revisão final independente.

Foco: fila de tarefas em aberto respeitando os filtros atuais, uma tarefa destacada, contexto/checklist editável, prazo protegido pelo planejamento, abertura do editor e conclusão explícita com recuperação compartilhada. Escolher outra tarefa não altera status.

Carga: semana navegável, distribuição diária de prazos, agrupamento por projeto/pilar e tarefas sem prazo. Usar apenas tarefas em aberto dos filtros atuais. Duração apenas dos blocos válidos existentes, identificada como soma de horas em blocos iniciados no dia; sinalizar sobreposição. Não inferir estimativas, disponibilidade ou capacidade livre; Google não é consultado por esta visão.

Preservar dados, Hermes/Arco CRM, servidor pessoal e trabalho em andamento. Sem dependências novas. Validar UI, regras matemáticas, recuperação, persistência/falhas, temas/mobile, tipos, lint, build e regressões; integrar arquivos selecionados a main e publicar por push normal na integração Hostinger. Confirmar versão pública independentemente da CI.

## Registro

- Base 1404e52; checkout isolado reutilizado, remoto main conferido nessa base. Foco/Carga consomem o mesmo conjunto filtrado e guardas de mutação da lista; checklist passa pelo PATCH existente.
- Publicação do conjunto autorizada pelo usuário em 01/10/2026, superando a restrição local dos dois ciclos anteriores. Não inclui dados reais, Hermes, Arco CRM ou reescrita de histórico.

## Verificação antes da publicação

- RED: os dois primeiros testes de UI falharam pela ausência de Foco/Carga. A revisão independente reproduziu mais duas falhas: conflito atravessando a semana e abertura de snapshot antigo durante uma alteração em Planejar. Ambas foram corrigidas e cobertas.
- GREEN final em build local de produção, dados sintéticos, porta isolada: **68 passed (3.9m)**, sem retries. Inclui as sete visões, checklist e falhas de persistência, conclusão/recuperação, recorrência, planejamento, datas/fusos, virada de ano, navegação e varredura de 22 rotas em três tamanhos.
- A primeira varredura terminou com 67 aprovados e uma falha de hidratação artificial: o teste congelava o navegador no dia anterior ao servidor. O relógio fixo foi retirado desse smoke; os dados continuam sintéticos. A repetição completa passou.
- Build Webpack: **exit 0**, 53 páginas. TypeScript: **exit 0**, sem erros. Lint global: **exit 0**, 0 erros / 96 avisos existentes. Lint dirigido: exit 0, sem avisos. `git diff --check`: exit 0.
- Inspeção visual de Foco/Carga: oito capturas, claro/escuro, 390/1440px, sem transbordamento da página ou exceções de JavaScript. As capturas das outras quatro visões também foram repetidas.
- Evidências privadas fora do Git em `C:/dev/jonny/lifesystem-task-qa-evidence/`; nenhuma credencial real foi consultada. O harness temporário foi arquivado, não integra o produto.

A autorização inclui integrar tabela/editor, Kanban, calendário, linha do tempo de prazos, Semana integrada, Foco e Carga. A confirmação da versão pública será registrada em `deploy-producao.md`; resultados locais e push não bastam para afirmar implantação.
