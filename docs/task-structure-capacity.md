# Estrutura, esforço e recorrência de tarefas

O painel de edição oferece tarefa principal, dependências e esforço previsto em minutos. Lista e Foco mostram vínculos, progresso das subtarefas e esforço informado. O título abre a tarefa; o controle de conclusão continua separado e recuperável. Pais e filhos possuem seus próprios prazos e estados. Concluir filhos não conclui o pai automaticamente; concluir o pai exige filhos e dependências concluídos. Vínculos inexistentes, autorreferência e ciclos, inclusive ciclos misturando dependências e filhos, são recusados no servidor. Para excluir uma tarefa referenciada, remova seus vínculos primeiro.

## Campos REST e MCP

`create_task` e `update_task` usam as mesmas regras de `POST /api/tasks` e `PATCH /api/tasks/:id`. `list_tasks` aceita `parentId` para consultar filhos. Consulta exige `tasks:read`; criar/alterar exige `tasks:write`; excluir exige `tasks:delete`. Planejamento continua usando `tasks:plan` (e permissão Calendar para efeito Google). Não há nova permissão implícita nem autoaprovação para Órion/Sirius.

| Campo | Schema e comportamento |
| --- | --- |
| `parentId` | string não vazia até 100 caracteres, opcional; `null` remove o vínculo |
| `dependsOnIds` | array opcional de até 100 IDs não vazios; `[]` remove as dependências |
| `estimatedMinutes` | inteiro opcional de 1 a 10080; `null` limpa; esforço próprio desta tarefa |
| `recurring` | boolean opcional |
| `recurringFrequency` | `daily`, `weekly` ou `monthly`, opcional |
| `dueDate` | dia civil `YYYY-MM-DD`; com bloco, mudar o dia passa por Planejar |

Esforço não é tempo executado, não reserva agenda e não movimenta dinheiro. Estime apenas o trabalho próprio do pai; não repita nele a soma dos filhos já estimados. A visão de Carga soma estimativas explícitas das tarefas em aberto do período e informa quantas não têm estimativa, sem atribuir duração fictícia.

## Jornada e fusos

`GET /api/planning-preferences` devolve a configuração ou o padrão compatível. `PUT` exige objeto completo e estrito:

```json
{
  "workStart": "08:00",
  "workEnd": "20:00",
  "workingDays": [1, 2, 3, 4, 5, 6, 7],
  "timeZone": "America/Sao_Paulo"
}
```

Dias ISO: segunda 1 até domingo 7, sem repetição, ao menos um. Horários `HH:mm`, fim posterior ao início no mesmo dia; fuso IANA válido. Configuração disponível em Planejar e Carga. Em Planejar, compromissos e blocos são unidos antes de subtrair os intervalos da jornada. Dias fora da jornada não anunciam capacidade. Falha de agenda/tarefas/configuração impede afirmar disponibilidade. Carga exibe jornada bruta, sem descontar Calendar; não representa horas livres nem soma blocos ao esforço como trabalho adicional.

A grade usa o fuso configurado. Replanejar mantém data, hora e fuso do bloco original; novo bloco usa o fuso preferido, independentemente do fuso do navegador. Horário inexistente em mudança de verão é recusado; horário ambíguo novo escolhe o primeiro instante, e editar sem mudar o relógio conserva o instante original, inclusive a segunda ocorrência.

## Recorrência persistente

A conclusão por REST ou MCP grava a tarefa e sua próxima ocorrência na mesma transação. A sucessora tem ID determinístico a partir da origem e os campos `recurrenceSourceId`/`nextOccurrenceId` vinculam o ciclo. Retry, concorrência e reabrir/reconcluir não geram uma segunda sucessora. Se a sucessora foi excluída, o servidor não a recria silenciosamente. A data original de conclusão é preservada quando a tarefa já estava concluída.

A nova ocorrência conserva conteúdo, prioridade, projeto/pilar, tags e esforço, mas começa em etapa não terminal, sem checklist concluído, bloco Google, pai ou dependências. Ela não reabre a árvore anterior. Dias/mês usam calendário civil; recorrência mensal limita dia 29–31 ao último dia do mês seguinte. Não há geração de parcelas financeiras nem de todas as ocorrências futuras.

## Verificação

As specs `task-relationships`, `task-recurrence`, `task-planning-timezone`, `planning-capacity` e `task-workload` cobrem domínio, REST/MCP e casos de concorrência/fuso. `task-relationships-ui`, `task-planning-ui`, `task-focus-load`, `task-rich-views` e `today-task-actions` cobrem interface e recuperação, em servidor isolado com dados sintéticos. Resultado agregado e recibo público são mantidos em `roadmap-execution-2026-10-01.md` e `deploy-producao.md`.
