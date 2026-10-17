# Inventário de design — 07/10/2026

Levantamento para o design system (etapa 1). Capturas feitas com dados sintéticos em
1440 e 390 px, temas escuro e claro, a partir do build de produção local. Nenhum dado
pessoal foi usado.

## Números do código

| Medida | Hoje | Proposta |
| --- | --- | --- |
| Tamanhos de fonte em `globals.css` | 17 (8 a 42 px); 11 usos de 8–9 px | 6 (12, 14, 16, 20, 24, 36 px); mínimo 12 px |
| Arredondamentos em `globals.css` | 16 valores (2 a 24 px) | 6, 10, 16 px e círculo |
| Arredondamentos em classes Tailwind | `rounded-md/lg/xl/2xl/full` com 36–87 usos cada | Mapear para a escala acima |
| `text-[10px]` / `text-[11px]` nas telas | 38 usos | 0 (vira `text-xs`) |
| Camadas de estilo | componentes `ui/`, ~1.200 linhas de classes globais `work-*`/`task-*`, CSS Modules da estação | Tokens + componentes `ds/`; globais só para layout |
| Cores de ação | Ciano no sistema; violeta em Tarefas (`.task-observatory` redefine `--color-primary`) | Decisão 1 na página `/design` |

## Tarefas (maior queixa)

1. Quatro faixas de controles antes do conteúdo: contadores por etapa, Em aberto/Concluídas/Todas
   com dica, busca + Filtros + 7 visões, e "Mais opções de organização". Cada faixa tem altura e
   estilo próprios; a busca fica truncada ("Buscar tare") no desktop.
2. Duas cores principais na mesma tela: botões violeta (Nova tarefa, Em aberto) e o botão
   flutuante/"Capturar uma ideia" em ciano.
3. Concluir aparece de dois jeitos: em Hoje é botão com contorno e texto 14 px; no Quadro é um
   círculo com legenda de 8 px.
4. Cartão do Quadro carrega seletores de Etapa e Prioridade e fica com o dobro da altura; há
   borda dupla (cartão dentro da raia).
5. Textos auxiliares em 8–10 px (legenda "Concluir", rótulos dos seletores, metadados do
   calendário e da linha do tempo).
6. Concordância: "1 atrasadas · 1 urgentes" nos resumos de coluna.
7. No celular, as 7 visões viram ícones sem rótulo e o filtro é só ícone.
8. Órbita decorativa do cabeçalho cruza os contadores.

## Outras telas

- Hoje usa cabeçalho em cartão (hero) e Tarefas usa cabeçalho sem cartão com linha divisória:
  dois padrões para a mesma função.
- Marcadores de prioridade: borda vermelha à esquerda em Hoje; texto colorido no Quadro;
  seletor nos cartões.

## Próximas etapas

3. Aprovação das decisões em `/design`.
4. Consolidar tokens (escala de fonte e raio no `@theme`) e componentes `src/components/ds/`.
5. Reestilizar Tarefas, depois Hoje e Planejar, depois o restante, cada uma com testes em
   desktop/mobile e nos dois temas.

## Cosmologia do LifeSystem (08/10/2026)

Universo semântico definido no livro de marca (`/design`), alinhado ao mapa
estelar do Escritório (`kindNames` em `stellar-panel.tsx`):

| Corpo celeste | No app |
| --- | --- |
| Núcleo | Visão: você e o seu porquê |
| Constelações | Pilares |
| Planetas | Projetos |
| Satélites | Ferramentas: Agenda, Financeiro, Conteúdo, Notas, Fontes, Arco Leads |
| Estrelas | Tarefas (acesas = concluídas) |
| Cometas | Caixa de entrada / capturas |
| Cinturão | Tarefas soltas, sem projeto nem pilar |
| Órbita | Planejar e Hoje (o percurso da semana) |
| Eclipse | Dependências entre tarefas |
| Janela de lançamento | Editais |
| Combustível | Financeiro (saldo) |
| Suporte de vida | Corpo & saúde |
| Estação orbital | Escritório e tripulação |
| Diário de bordo | Diário |
| Telescópio | Revisão e Metas |
| Sinais | Fontes e avisos |

As ilustrações ficam em `src/components/brand/illustrations.tsx` (uma por conceito),
o mapa completo em `system-map.tsx`. Na reestilização, cada módulo usa a sua
ilustração no estado vazio e na abertura.
