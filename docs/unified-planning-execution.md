# Planejamento unificado

Escopo aprovado: validar escrita real no Google, unificar a semana de Tarefas e Planejar, mostrar agenda cronológica e intervalos disponíveis.

- Usar o mesmo PlanningWorkspace na semana de Tarefas; manter calendário mensal explicitamente como visão de prazos.
- Mobile: um dia selecionável; desktop: sete colunas cronológicas.
- Intervalos calculados entre 08h e 20h, sem interpretar como jornada de trabalho. Só agenda principal Google; dia inteiro e eventos transparentes não consomem capacidade horária.
- Sobreposições contam uma vez. Falha ou carregamento da agenda não pode afirmar disponibilidade.
- Preservar prazo, metadados de sincronização e arquivos locais não relacionados.

Validação real: tarefa de teste criada em produção, evento confirmado no Google em 28/09/2026 às 09:00–09:05. Reagendado para 09:10–09:15, mantendo o mesmo identificador; confirmado um único evento no Google. Limpeza solicitada ao usuário por envolver exclusão permanente da tarefa.

Implementado: compartilhamento do componente semanal, cronologia de blocos/eventos, seletor diário móvel, intervalos livres, durações sugeridas, atualização manual da agenda e leitura paginada com falha explícita se incompleta.

Revisão independente: corrigidos disponibilidade durante falha de tarefas e atualização do componente pai após ritual. Teste de regressão reproduziu a disponibilidade incorreta antes da correção e passou depois. Testes focados: 8 aprovados. TypeScript e ESLint aprovados. Suíte completa: 101 testes aprovados. Build de produção aprovado.
