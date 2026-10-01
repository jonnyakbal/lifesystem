# Direção de produto a partir das referências — 30/09/2026

Status: referências e direção de produto. A execução local da etapa Tarefas está registrada no [plano de produtividade](task-productivity-plan.md); os estudos das demais telas continuam propostas. Este documento não substitui os critérios do roadmap.

## Intenção e referências

Jonny compartilhou 18 imagens de interfaces de Asana, monday e ClickUp, além do vídeo `web-homepage-hero-1920x1200-pt-BR_final.mp4` (1920 × 1200, aproximadamente 11 segundos). A leitura visual considera os materiais fornecidos, sem assumir que recursos anunciados nesses produtos existem no LifeSystem.

O objetivo continua sendo um espaço pessoal conectado: capturar, organizar, decidir e executar, com agentes participando dos fluxos. Mobile permanece a experiência principal; desktop oferece mais informação simultânea. Preservar a identidade astral refinada e os contratos existentes.

As imagens sugerem três avanços: informação estruturada e editável; relações entre tarefas, projetos e objetivos; atuação de agentes acompanhada no próprio contexto. No vídeo, o quadro compacto permanece visível enquanto registros se movem e indicadores de agentes acompanham as mudanças. Traduzir esse princípio em feedback de operações reais.

## Direção visual recomendada

**Astral discreto, operação clara.** Superfícies neutras, hierarquia tipográfica precisa e cor seletiva. Ciano identifica ações; cores de status e prioridade têm significado estável nos dois temas. Violeta e órbitas aparecem como assinatura em momentos de entrada, sem competir com tabelas, formulários ou gráficos.

Jonny acrescentou que pode haver experiências ousadas em modos ou telas específicas: variar a composição faz parte da direção, sem exigir aparência idêntica em todo o sistema. Dos três estudos, aprovou apenas o observatório violeta e determinou aplicá-lo primeiro à visualização e manipulação das tarefas. Hoje editorial e Tarefas em grafite permanecem estudos sem aprovação. Manter navegação, semântica das ações, acessibilidade e tratamento de dados comuns; variar a composição conforme o contexto.

O estudo local em `design-studies/workspace-directions.html` usa dados fictícios e interações locais. É uma exploração visual separada da aplicação, sem chamadas às APIs, e não certifica comportamento nem publicação das telas reais.

Telas de operação recebem cabeçalhos compactos: título, contexto, ação principal e visualizações. A abertura mais expressiva fica na visão geral e em apresentações iniciais. Frases inspiracionais podem ser opcionais e discretas; instruções de uso e mensagens de erro continuam diretas.

Uma tabela alinhada é a referência para densidade em desktop. No celular, as mesmas informações se tornam linhas/cartões com título, prazo, status e ação acessíveis; detalhes secundários ficam na abertura do registro. Alvos interativos permanecem confortáveis mesmo em modo compacto.

Movimento comunica mudança: salvar, alterar status, abrir detalhes e receber resultado. Evitar animação constante sobre registros de trabalho. Respeitar movimento reduzido, e oferecer estado textual equivalente a toda animação.

## Base examinada antes da implementação

| Base existente | Evidência no código | Oportunidade |
| --- | --- | --- |
| Navegação móvel, busca/comandos e atalhos entre áreas | `src/components/layout/`, `src/components/workspace/` | Organizar ações pelo contexto e reduzir repetição de cabeçalhos |
| Quadro, lista, semana e calendário de tarefas; filtros e visões salvas | `src/app/(dashboard)/tarefas/page.tsx` | A lista ainda renderiza os mesmos cartões; evoluir para linhas com campos alinhados |
| Conclusão explícita, desfazer e recuperação de concluídas | Hoje, Tarefas e `src/lib/task-stages.ts` | Preservar a separação entre abrir registro e concluir em todas as novas visões |
| Calendário de prazos com conteúdo e vencimentos financeiros | `calendarDays` e `renderCalendar` na tela Tarefas | Atualmente calculado pelo mês atual; adicionar navegação e destinos por registro |
| Galeria e quadro de projetos | `src/app/(dashboard)/projetos/page.tsx` | Acrescentar leitura de próxima ação, relações e saúde do projeto com base verificável |
| Status MCP, heartbeat e histórico recebido | `src/app/(dashboard)/hermes/page.tsx` | Separar conexão, capacidade disponível e resultado de execução no painel do registro |
| Contratos de propostas, aprovação e recibos | `src/lib/health/`, `src/lib/professional/` | Apresentar decisões e resultados no contexto, preservando escopos e regras atuais |

Existência do contrato no código não certifica ativação de credenciais nem transporte real de Órion/Sirius. Manter essa distinção visível no produto e no relatório de produção.

## Evolução dos fluxos

### 1. Tarefas como espaço de operação

Lista com colunas de título, status, prazo, prioridade e projeto. Agrupamento e visualizações atuais permanecem disponíveis. A edição por campo tem controles identificáveis, validação, estado de salvamento e recuperação de falha.

Abrir o título mostra detalhes. Concluir usa ação própria e permite desfazer. Alterar prazo de uma tarefa com bloco de horário deve passar pelo fluxo de planejamento para preservar data e sincronização; não fazer um PATCH genérico que contorne essa regra.

Um painel de detalhes permite consultar descrição, checklist e relações sem perder a lista. Em mobile, ele ocupa a tela com retorno claro. URL identifica o registro aberto; acesso direto, voltar do navegador e foco por teclado precisam funcionar.

Calendário permite meses passados e futuros, inclusive sem registros, e trata separadamente prazo, bloco de horário e vencimento financeiro. A regra financeira de previsto/realizado continua sendo a do módulo financeiro.

### 2. Projetos conectados à execução

Visão do projeto reúne contexto, próximas ações, tarefas, conteúdo, entregas e vínculos já existentes. Toda contagem leva à lista que a explica. Indicadores de atraso ou bloqueio mostram sua origem e quando foram atualizados.

Uma ligação é uma referência ao registro original; abrir o projeto não cria cópias de tarefas. Relações ainda não suportadas pelo modelo precisam de uma entrega própria de schema/API antes de aparecerem como funcionalidade.

### 3. Agentes no contexto do registro

Painel com identidade do agente, escopo efetivo, contexto disponível e atividade comprovada. Para uma alteração proposta: mostrar campos, versão, validade e aprovação necessária; depois apresentar recibo e link para o resultado.

Estados de proposta, aprovação e execução vêm dos contratos de cada domínio. Indicadores de andamento só aparecem quando há sinal correspondente. Ausência de sinal é apresentada como desconhecida ou aguardando confirmação.

O painel é uma apresentação dos contratos existentes. Ele não concede novos escopos, não autoriza um agente a aprovar a própria proposta e não altera Hermes ou Arco CRM. Conversa persistente, execução externa e novos agentes são escopos separados, dependentes de contrato e transporte verificável.

Identidade visual própria para Sirius e Órion é uma possibilidade; nome e capacidade ajudam a identificar a ação. Avatares decorativos não substituem autoria ou trilha de auditoria.

### 4. Mapa de conexões

Visão exploratória opcional para relações confirmadas entre pilares, metas, projetos e tarefas. Selecionar um nó abre seu registro e explica a relação. Oferecer lista equivalente, teclado, filtros e movimento reduzido.

Antes de construir o grafo, inventariar quais vínculos existem no modelo e quais são apenas ideias. Planejamento visual de automações é outro produto e exige desenho próprio; a referência de nós não implica instalar um construtor de fluxos nesta etapa.

## Sequência sugerida

1. **Tarefas:** lista estruturada, cabeçalho compacto, navegação mensal e detalhes por registro. Manter testes de conclusão/recuperação, planejamento e filtros.
2. **Projetos e relações:** detalhes conectados, atalhos para registros exatos e indicadores explicáveis.
3. **Agentes:** painel contextual de propostas, aprovações, recibos e sinais de execução, depois de verificar os transportes necessários.
4. **Exploração:** mapa de relações e personalização dos perfis, a partir dos vínculos e contratos confirmados.

Essa sequência convive com as pendências de confiabilidade do [roadmap](ROADMAP.md), incluindo idempotência persistente de recorrências, recuperação de backup e ativação dedicada de agentes. Não substitui essas verificações por mudanças visuais.

## Critérios de aceite das futuras entregas

- Funciona a 360/390, 768 e 1440 pixels, nos temas claro e escuro, com teclado e movimento reduzido.
- Clicar no título nunca conclui a tarefa; ação explícita, desfazer e recuperação continuam disponíveis.
- Edição de campo mostra sucesso ou erro e não perde informação por conflito de versão.
- Navegação mensal cobre mês vazio, passado, futuro e virada de ano.
- Abrir detalhes preserva filtros e permite retorno à mesma visão.
- Contagens e relações têm destino verificável e não duplicam registros.
- Agente mostra escopo, autoria, proposta e resultado real; status desconhecido permanece desconhecido.
- Testes usam registros sintéticos e servidor isolado; validação de produção é relatada separadamente.
- Medir carregamento e volume de dados antes de adicionar dependências. Reutilizar os componentes existentes quando atenderem ao fluxo; selecionar bibliotecas específicas apenas quando houver necessidade comprovada.

## Limite desta análise

### Evolução posterior: Tarefas

O [plano de produtividade](task-productivity-plan.md) registra a implementação local autorizada depois destes estudos: lista com campos editáveis, painel lateral, conclusão explícita e recorrência/recuperação, ações em lote, colunas configuráveis e navegação mensal. O observatório violeta foi aplicado apenas à tela Tarefas e ao seu painel. Os contratos dos agentes e os demais sistemas não foram alterados neste ciclo. Os resultados de verificação e o estado de publicação estão no plano; o registro original abaixo descreve somente a etapa dos estudos.

Nesta etapa foram examinados os materiais visuais e os pontos citados do código. Foi registrada a direção proposta e criado um estudo independente com três composições. As telas da aplicação, os dados e os sistemas externos não foram alterados. Sem commit, push ou deploy.

O estudo foi aberto em navegador automatizado a 390, 768 e 1440 pixels. Nas três larguras, passaram as verificações de troca de telas, ausência de overflow horizontal, abertura de detalhes sem conclusão, conclusão/desfazer, busca, filtro vazio, troca lista/quadro e revisão/aprovação simulada. Nenhum erro de JavaScript foi registrado; screenshots desktop/mobile foram inspecionados. Movimento reduzido esteve ativo nas verificações. Isso valida as interações locais do estudo, não a integração com APIs nem uma auditoria integral de acessibilidade. `git diff --check` passou; não foram executados build ou testes da aplicação porque seu código não mudou.
