# Piloto sintético de Órion e Sirius

O piloto exercita o LifeSystem local por contratos reais e transporte MCP em memória. Não conecta agentes reais, Hermes, VPS, Arco CRM ou Google. A evidência corresponde a `tests/agent-pilot.spec.ts`; os serviços existentes não foram alterados para permitir o teste.

## Resultado observado

Execução final em 01/10/2026: **2 testes passaram, 1 worker, 3,4 segundos**. Sem `webServer`, build ou navegador. ESLint dirigido somente a `tests/agent-pilot.spec.ts` também passou. Uma primeira execução recusou corretamente uma observação com data futura; a fixture foi corrigida para uma data passada e os dois cenários passaram.

| Etapa | Órion | Sirius |
| --- | --- | --- |
| Identidade | Credencial sintética `synthetic-orion`, resolvida por `authorizeMcpToken` com configuração explícita | Credencial sintética `synthetic-sirius`, resolvida pela mesma função |
| Escopos | `health:only`, `health:read`, `health:propose`, `health:apply` | `professional:only`, `professional:read`, `professional:propose`, `professional:apply`, `professional:artifact`, `professional:execution` |
| Descoberta | Catálogo SDK, capacidades e schema de saúde 1.2; água em ml | Catálogo SDK, diagnóstico e schemas profissionais 1.0; adapter declarado `contract-only` |
| Fixture | Relato autorreferido de 350 ml de água, explicitamente sintético | Projeto e contexto sintéticos, marca `freelance`, proposta `work_scope` atribuída à credencial |
| Antes da autorização | Apply recusado; nenhuma observação criada | Apply recusado; nenhum trabalho, job ou tarefa criado |
| Aprovação humana | Handler `/api/health/approval` | Handler `/api/professional/approval` |
| Validação da aprovação | Sem cookie, cookie inválido e hash divergente recusados | Sem cookie e revisão divergente recusados |
| Aplicação | Uma observação com autor e origem `self_report` | Um trabalho, uma tarefa projetada e um job `queued` |
| Replay | Mesmo conteúdo e ID; um recibo de apply | Mesmo conteúdo e ID; um recibo de apply, um job e uma tarefa |
| Outra credencial no mesmo domínio | Não aplica a proposta e não encontra seu recibo | Não aplica a proposta e não encontra seu recibo |

As sessões humanas são criadas chamando diretamente o handler `/api/login`, com `AUTH_USER` e `AUTH_PASSWORD` sintéticos temporários. A aprovação vincula ID, revisão e hash; o agente não recebe ferramenta de autoaprovação. Para Sirius, o contexto é associado pelo handler autenticado `/api/professional`; o projeto inicial é somente uma fixture de storage.

## Isolamento e limpeza

- Cada teste utiliza sua própria pasta `mkdtemp` no diretório temporário do sistema. O storage de negócio e os logs MCP permanecem nessa pasta.
- O teste não lê `.env`; passa a configuração de credenciais diretamente ao resolvedor e remove temporariamente `MCP_API_KEY`/`MCP_API_KEYS` herdados do processo.
- `globalThis.fetch` é substituído por uma função que recusa toda tentativa de rede. O contador deve permanecer vazio, mesmo se o serviço capturar a exceção.
- Os transports são `InMemoryTransport.createLinkedPair()`, sem sockets. Requisições `NextRequest` usam um domínio `.invalid` e são entregues diretamente aos handlers, sem HTTP de rede.
- Teardown fecha clientes e servidores, restaura fetch e cada variável alterada, verifica que a pasta pertence ao temporário e remove apenas a pasta criada. Também confirma a remoção e a restauração do ambiente.
- Ambos os cenários verificam que nenhum lançamento financeiro foi criado. Órion não cria tarefas nem registros profissionais; Sirius não cria observações de saúde e só usa a marca freelance da fixture.
- O cenário de Órion verifica logs de sucesso e recusa atribuídos às respectivas credenciais.

## Limites e lacunas atuais

Este resultado valida contrato, SDK, regras de domínio, handlers de aprovação e persistência local. **Não valida o transporte HTTP `/api/mcp`, middleware, proxy, TLS, sessão no navegador, interface visual nem configuração de agentes reais.** A resolução da credencial e a criação do servidor são combinadas explicitamente no teste; o despacho HTTP não é exercitado.

O isolamento por identidade comprovado é de **aplicação de proposta e recuperação de recibo**. As consultas atuais são do domínio pessoal compartilhado: `listHealthObservations` não recebe ator, e `professionalQuery` filtra projetos associados e exclui `workspaceDomain: company`, sem ACL por agente. Portanto, duas credenciais com leitura no mesmo domínio podem consultar o mesmo acervo pessoal. Não há evidência de isolamento de leitura por agente.

Sirius deixa o job em `queued`; não há execução externa. O contrato informa `adapter: contract-only`. Não foi usado adapter de Hermes ou CRM, nem simulado sucesso de execução, entrega, publicação ou contato. O cenário não cobre validade expirada, falhas de disco, revisão de escopo, eventos de execução, artefatos ou correção de relatos; esses requisitos precisam de seus testes específicos.

Órion usa somente água. Não solicita `get_health_daily_brief`, planejamento ou Google Calendar, e não demonstra sincronização de agenda.

## Reproduzir sem webServer

A configuração usada fica fora do repositório, em `C:/dev/jonny/lifesystem-task-qa-evidence/agent-pilot-unit.cjs`, com `testMatch: 'agent-pilot.spec.ts'`, `workers: 1`, `retries: 0`, `fullyParallel: false`, `tsconfig` do projeto, reporter `list` e saída isolada. Não possui `webServer`.

No diretório `C:/dev/jonny/lifesystem-roadmap-hardening`:

```powershell
node node_modules/@playwright/test/cli.js test --config C:/dev/jonny/lifesystem-task-qa-evidence/agent-pilot-unit.cjs
```

Para reproduzir em outro checkout, ajuste os caminhos absolutos da configuração externa. A configuração padrão do projeto inicia o servidor de desenvolvimento; não é a configuração deste piloto.

## Piloto HTTP — 02/10/2026

`tests/agent-contract-http.spec.ts` sobe um servidor de produção próprio, na porta 3117, com diretório de dados temporário e quatro credenciais dedicadas sintéticas: dois Órion e dois Sirius. Ele conversa com `/api/mcp` pelo `StreamableHTTPClientTransport`, o mesmo transporte usado pelo Hermes.

O teste comprova, pelo caminho real (proxy, Bearer, escopos, rotas web):
- **Credenciais:** recusa sem credencial, com cabeçalho malformado e com token desconhecido (401).
- **Catálogo por identidade:** Órion não vê ferramentas profissionais, e Sirius não vê as de saúde. Nenhuma das duas tem ferramenta de aprovação humana.
- **Órion 1.2:** proposta, aplicação recusada sem aprovação e aprovação web. A aprovação só vale com sessão e origem corretas: origem forjada (403), Bearer no lugar de sessão (recusado) e hash divergente (403) são recusados. Depois vêm a aplicação, o replay idêntico e o recibo isolado por ator.
- **Sirius 1.0:** projeto explícito criado pela interface e escopo de trabalho proposto. Exige critérios de aceite, e isso foi validado pelo servidor. Aprovação web exata, aplicação, replay e recibo isolado. Um job fica **na fila, sem execução** (adapter `contract-only`).

**Limites:**
- Não certifica TLS, proxy da Hostinger, credenciais reais nem o Hermes.
- A verificação em produção de cada credencial dedicada, só com descoberta e schema, continua sendo uma etapa operacional separada.
