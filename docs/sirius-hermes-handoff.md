# Sirius profissional — contrato 1.0

Contrato preparado em 30/09/2026. A área `/profissional` organiza contexto, contatos, oportunidades, campanhas, trabalhos, pautas e entregas. O transporte real do Kanban Hermes **não está conectado**: existe contrato tipado e adapter simulado. Nenhuma VPS, credencial ou cron foi alterado nesta entrega.

## Responsabilidades e associação

LifeSystem guarda planejamento e negócio; Hermes executa trabalhos atribuídos. `Review` do worker não conclui tarefa, aprova entrega, realiza receita nem envia mensagem. Metas pessoais declaradas permanecem separadas do Financeiro. Oportunidade, contrato, faturamento e recebimento têm estados comerciais distintos; estimativa bruta, custos e parcela do proprietário permanecem distintos.

O dono associa um projeto existente a uma marca por ID, na interface: `arco-labs`, `arcopass`, `atelie-studio` ou `freelance`. Um único contexto por projeto. Nenhuma marca é inferida de nome/tag; nenhum projeto é inscrito automaticamente. Campos ausentes continuam desconhecidos. Projetos com `workspaceDomain: company` são recusados. Projetos de Dona Maria, Nave-Mãe e Hermes empresarial não devem ser inscritos nessa área. O bot pessoal não usa a chave ampla legada para esse piloto.

Arco Labs prioriza geração de caixa por serviços; Arcopass e Ateliê Studio recebem avanços pequenos de produto. A leitura aponta lacunas, bloqueios e follow-ups sem interpretar silêncio como abandono. Fatos, hipóteses, desconhecidos e fontes de verificação são campos separados.

## Armazenamento e compatibilidade

`professional-ledger.json` contém registros, versões, propostas, aprovações, jobs, recibos e histórico de IDs/atores. O serviço usa `storage.transact`, com lock de coleção entre processos cooperantes no mesmo host/disco e gravação atômica; não reescreve dados pessoais antigos para preencher contexto. Essa garantia foi reforçada na rodada de 01/10 e não se limita mais a um único processo escritor. Para escritores distribuídos em hosts/armazenamentos distintos, essa trava não é suficiente: avaliar storage transacional compartilhado. Ver [contrato de storage](storage-hardening.md). Não estender essa garantia a stores próprios de outros módulos sem inspecioná-los.

Trabalhos profissionais projetam uma tarefa real com ID estável e vínculo `linkedTaskId`; pautas projetam um registro real de Conteúdo. Etapas em andamento são preservadas. Alteração concorrente pela tela normal exige releitura; conteúdo legado com o mesmo ID não é sobrescrito por uma nova associação. As projeções conservam metadados de versão/recuperação para reencontrar o mesmo registro após timeout. Não há migração destrutiva nem geração automática de recorrências.

## Ferramentas e escopos

Sirius precisa de uma credencial própria, cujo **ID** coincide com o campo responsável dos trabalhos (`sirius`, por exemplo). O segredo deve ser configurado pelo fluxo privado da sessão responsável; não copiar segredos para este documento.

Escopos recomendados:

```json
["professional:only", "professional:read", "professional:propose", "professional:apply", "professional:artifact", "professional:execution"]
```

`professional:only` bloqueia ferramentas globais, mesmo se uma configuração antiga também contiver escopos amplos. Não concede autoaprovação. Não autoriza escrita financeira. Vega pode receber `financial:read` / `financial:write` em outra credencial e sessão; não combinar essas permissões com a chave pessoal de Sirius.

| Ferramenta | Escopo | Comportamento |
| --- | --- | --- |
| `query_professional` | read | overview, project, records, proposal, jobs, stages, diagnostics; filtros, busca e paginação |
| `get_professional_schemas` | read | JSON Schemas exatos do contrato atual |
| `get_professional_receipt` | read | Resultado da intenção desta credencial depois de timeout |
| `get_professional_diagnostics` | read | Capacidades/escopos, sem segredos |
| `propose_professional_change` | propose | Prepara campos concretos; não executa |
| `batch_professional_proposals` | propose | Até 20 intenções, resultado por item |
| `apply_professional_proposal` | apply | Aplica aprovação humana vigente, versão e hash exatos |
| `submit_professional_artifact` | artifact | Entrega dentro do escopo vigente do trabalho atribuído |
| `report_professional_execution` | execution | Eventos monotônicos do job; não muda conclusão de negócio |

Consultas: `limit` 1–50 (20 padrão), `cursor` retornado; `projectId`, `brandId`, `kind`, `id`, `search`, `status`, `responsible`, `from`/`to`. Datas civis YYYY-MM-DD. Para dia/semana, informar os limites em `from`/`to`; tarefas usam seu prazo, trabalhos seu prazo, oportunidades seu follow-up. `view: project` exige projectId e inclui tarefas, conteúdo, editais explicitamente vinculados, histórico e resumo financeiro mensal daquele projeto. Consultas de lista abreviam corpo/brief; `view: records, id` retorna o registro completo antes da edição. Propostas mostram possíveis tarefas existentes de mesmo título/projeto para comparação humana, sem mesclar automaticamente.

Marcas de conteúdo são estruturais. Campos compartilhados REST/MCP incluem formato, canal, linha editorial, público, objetivo, CTA, responsável, links, checklist e métricas. Conteúdo com vínculos entre marcas é recusado. Uma pauta aprovada permanece rascunho, não publicação realizada.

## Aprovação autenticada

Tipos separados: `work_scope`, `record_change`, `deliverable`, `external_action`. Cada proposta liga autor, registro, campos exatos, versão esperada, hash e validade de sete dias. Expiração do escopo bloqueia novos artefatos/eventos; alterações do trabalho exigem nova autorização. Uma entrega revisada não herda a aprovação anterior.

O dono abre **Revisão → Revisar campos exatos**, lê a proposta e confirma. A interface usa cookie de sessão válido e POST `/api/professional/approval` com `{ proposalId, revision, hash }`. Bearer de agente e um “sim” genérico não aprovam. Não existe ferramenta MCP de aprovação humana. `external_action` não possui executor nesta implementação: publicação e envio permanecem fora do serviço.

Para trabalho criado pelo dono: **Trabalhos → Preparar escopo** gera proposta de escopo, que ainda exige revisão. Para proposta criada por Sirius, o dono revisa diretamente. A aplicação cria um job com workId, agentId, revisão/hash de escopo, aprovação, validade e estados de execução separados.

Exemplo de intenção, usando IDs reais obtidos por consulta, sem informações comerciais inventadas:

```json
{
  "kind": "work",
  "approvalType": "work_scope",
  "expectedRevision": 0,
  "idempotencyKey": "sirius-pesquisa-intencao-001",
  "data": {
    "projectId": "ID_ASSOCIADO_PELO_DONO",
    "brandId": "arco-labs",
    "title": "Pesquisar uma pequena lista de prospects",
    "workType": "agent",
    "responsible": "sirius",
    "brief": "Pesquisar fontes públicas. Declarar lacunas. Não enviar mensagens.",
    "expectedResult": "Lista com fontes e rascunho de abordagem",
    "acceptanceCriteria": ["Fontes verificáveis", "Nenhum contato inventado"],
    "artifactKinds": ["prospect_list", "script"]
  }
}
```

## CRM, campanhas e entregas

Contatos têm empresa/pessoa, canais públicos, fontes, verificação e preferência de não contato. Deduplicação usa canal normalizado dentro do mesmo projeto/marca; coincidência de nome não prova identidade. Campanhas guardam seleção, motivo/evidência de cada prospect, qualificação, mensagens versionadas e histórico de contatos efetivos. O editor permite revisar lista e rascunhos; marcar a lista como revisada não autoriza envio. A versão atual recebe aprovação específica, não uma permissão permanente para futuras alterações. Histórico de contato realizado deve conter data/canal/resultado reais e só pode ser gravado por ação humana nesta versão.

Entregas aceitas: `prospect_list`, `script`, `message_draft`, `proposal`, `research`, `content_brief`, `experiment`. Guardam corpo ou referência de arquivo, fontes, resumo de verificação, comentários e revisão. Não podem ser transferidas de um trabalho para outro por alteração do workId. Não há envio automático nem contratação/pagamento automático a partir de um artefato.

## Contrato Hermes e piloto

`src/lib/professional/hermes.ts` define `capabilities()`, `submit()` e `observe()`. O adapter simulado retorna IDs determinísticos; não simula uma instalação real. Reconciliar após restart exige reenviar o mesmo job/intent para reencontrar o mesmo card antes de observar.

Evento enviado pela ferramenta autenticada:

```json
{
  "idempotencyKey": "job-001-event-3",
  "data": {
    "contractVersion": "1.0",
    "jobId": "JOB_APROVADO",
    "eventId": "event-3",
    "sequence": 3,
    "execution": "review",
    "boardId": "BOARD_REAL",
    "cardId": "CARD_REAL",
    "verificationSummary": "Verificações realmente executadas pelo worker"
  }
}
```

Sequência crescente; estado Review não regride por snapshot atrasado. O ID da credencial deve corresponder ao agente do job. Estados queued/running/blocked/failed/review são execução; status open/blocked/done do trabalho é negócio. Entrega vai à revisão humana antes de resultar em registros comerciais ou conteúdo aprovado.

Piloto simulado: associar projeto sintético → consultar lacunas → propor trabalho → aprovar com cookie → aplicar → submeter job ao adapter → observar execução → produzir lista/script no escopo → reportar Review → revisar entrega atual → aprovar registro comercial ou pauta concreta → confirmar tarefa/conteúdo nos módulos reais. Os testes usam armazenamento temporário, fontes sintéticas e nenhum contato/envio externo.

Antes do adapter real, a sessão do Hermes precisa identificar versão instalada, API/CLI realmente disponível, capacidade de board/card, transporte autenticado, IDs/eventos e suporte de reconciliação/idempotência. Não presumir webhook ou API nativos. Configurar o heartbeat do Hermes somente naquela sessão, sem adicionar cron neste repositório.

## Confiabilidade e mudanças existentes

Intenções profissionais exigem idempotencyKey estável. Repetição com campos diferentes é recusada. Versão esperada evita sobrescrever revisão nova; lote retorna sucesso/falha por item. Depois de timeout consultar recibo e repetir a mesma intenção/chave, nunca gerar uma chave nova cegamente. Auditoria registra IDs, ator e resultado, sem corpo de mensagens ou segredos.

CRUD MCP legado passou a aceitar chave estável e versão esperada; por compatibilidade, entidades antigas ainda aceitam criação sem chave. A garantia de idempotência exige que o cliente envie a chave. Financeiro já exige essa chave. Conversão de captura verifica a permissão do destino, e Calendar reencontra o evento gerenciado de ID estável após timeout. Triggers de editais são efeitos do serviço compartilhado e exigem permissão MCP de tarefa/projeto no destino.

Cadastros financeiros agora permitem nome, cor, tipo de novos lançamentos e arquivamento/reativação. Aliases preservam categorias históricas; UI, MCP e orçamentos resolvem o mesmo nome. Valores/status/datas/tipo histórico permanecem intactos. Realizado usa paidDate/date; previsão usa dueDate/date, mantendo a correção mensal já existente.

## Verificação local

Usar `playwright.readiness.config.ts`, porta 3107, dados temporários e serviços externos desabilitados. Nunca reutilizar o servidor pessoal para testes com escrita. Rodar testes, `npx tsc --noEmit`, `npm run lint` e `npm run build` (webpack), aguardando o servidor de testes parar antes do build. Evidência final fica no plano desta implementação.
