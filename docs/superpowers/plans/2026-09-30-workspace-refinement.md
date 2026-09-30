# Refinamento das cinco telas de trabalho

Objetivo: uma experiência astral refinada, legível e prioritariamente mobile para Tarefas, Hoje, Projetos, Conteúdo e Planejar. Preservar dados, integrações e funções existentes.

Direção: superfícies azul-noite com profundidade discreta, órbitas geométricas, tipografia editorial e ações ciano. Evitar cartões estreitos, rótulos excessivos, colunas intermináveis e ações dependentes de hover.

- [x] Corrigir exclusão individual em Tarefas e Planejar. Confirmar explicitamente a remoção do espelho; consultar e remover apenas eventos gerenciados; manter tarefa em falhas ou conflitos; serializar com o planejamento existente.
- [x] Criar cabeçalho e métricas compartilhados, com títulos preservados e suporte a temas claro/escuro e movimento reduzido.
- [x] Tarefas: quadro com colunas de largura estável, rolagem independente, cartões acessíveis por teclado, metadados reduzidos e ações sempre disponíveis.
- [x] Hoje: resumo do dia e composição de foco + rotinas, alvos de toque adequados, preservar conclusão e indicadores.
- [x] Projetos: galeria como entrada, busca e filtro por etapa; manter quadro e edição das capas disponíveis.
- [x] Conteúdo: biblioteca como entrada, cartões legíveis e pipeline preservado, sem colunas esticadas.
- [x] Planejar: dias com largura suficiente no desktop e seleção de dia no mobile; resumo compacto e ações claras de remover bloco/excluir.
- [x] Verificar regressão de exclusão com Google simulado, navegação e filtros com dados sintéticos, cinco telas em mobile/desktop, suíte isolada, tipos, lint e build webpack. Produzir imagens locais para revisão.

Arquivos: componentes compartilhados em src/components/workspace, globals.css, as quatro páginas e planning-workspace.tsx; exclusão em task-planning.ts e API tasks/[id]. Testes em tests/task-delete-planning.spec.ts e tests/workspace-refinement.spec.ts, além dos existentes.

Limites: nenhuma migração de dados, nenhum acesso a segredos ou alteração de serviços externos. Nenhuma exclusão de dados reais durante a validação.

Verificação local: 148 testes da suíte completa passaram (3,2 min); após o acabamento mobile, sete testes de UI passaram; após restaurar o ritual na semana integrada, quatro testes passaram (31,7 s). Tipos: exit 0. Lint: zero erros, 116 avisos. Build webpack final: exit 0. Revisão independente encontrou somente o atalho restaurado. Sem publicação ou exclusão de dados reais. Imagens de revisão em C:/dev/jonny/lifesystem-refinement-*.png.
