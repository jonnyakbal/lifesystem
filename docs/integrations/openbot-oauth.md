# LifeSystem no OpenBot

No Marketplace do servidor Oracle, edite o cadastro **lifesystem** e mantenha **Agente Pessoal** como o único agente autorizado. Em **Roles**, defina **Everyone** como **No access** e confira os papéis adicionais. A configuração por agente limita quais sessões recebem a ferramenta. A configuração por papel controla o acesso dos membros ao servidor MCP. Use o transporte HTTP e o endereço `https://lifesystem.oj0nny.com/api/mcp`. Deixe os cabeçalhos HTTP e o formulário de cliente OAuth vazios. O OpenBot 0.71.0 usa seu próprio [identificador público](https://openbot.run/oauth/mcp-client.json).

Uma conexão existente conserva os escopos que foram aprovados. Para ampliar o acesso, abra o fluxo de login no OpenBot para um novo consentimento. Se o cliente só oferecer **Sign out**, encerre a sessão atual antes de usar **Sign in**. Revise as seções **Leitura** e **Escrita** no LifeSystem e confirme **Autorizar acesso**. No OpenBot Web, cole o endereço final do callback somente no campo **Browser address** da janela de login. Ele contém um código de autorização de uso único. Rode **Test connection** para conferir o catálogo autorizado.

## Permissões

O OAuth fica disponível quando há exatamente uma credencial `openbot` em `MCP_API_KEYS`, com pelo menos um dos escopos `tasks:read` e `captures:read`. Com ambos presentes, o catálogo OAuth anuncia o perfil pessoal e exige um pedido explícito de escopos e consentimento para ampliá-los. Uma solicitação sem escopo permanece na leitura básica. Reduzir a credencial para um único escopo básico desabilita o perfil e invalida concessões mais amplas. A chave Bearer continua com os escopos definidos no ambiente. O OAuth entrega tokens próprios para o endpoint MCP.

| Área | Escopos OAuth | Operações disponíveis |
|---|---|---|
| Tarefas e Inbox | `tasks:read`, `tasks:write`, `captures:read`, `captures:write` | Listar, criar, editar, planejar blocos, adotar alterações de eventos vinculados e converter capturas para destinos autorizados. |
| Projetos, pilares e metas | `projects:read`, `projects:write`, `pillars:read`, `pillars:write`, `indicators:read`, `indicators:write` | Listar, criar e editar. Pilares existentes aceitam leitura e edição. |
| Conteúdo e fontes | `content:read`, `content:write`, `content_hub:read`, `content_hub:write` | Listar, criar e editar conteúdo, fontes e itens. |
| Diários e editais | `journal:read`, `journal:write`, `log_entries:read`, `log_entries:write`, `editais:read`, `editais:write` | Ler e editar entradas dos diários. Cadastrar e acompanhar editais. |
| Financeiro | `financial:read`, `financial:write` | Consultar o resumo mensal. Listar, criar e editar lançamentos, contas, cartões, faturas, orçamentos, credores e metas. |
| Agenda | `calendar:read`, `calendar:write`, `agenda:read` | Consultar agenda e disponibilidade. Criar, editar e cancelar eventos gerenciados pelo próprio agente. |
| Notas, Visão e revisão | `notes:read`, `vision:read`, `weekly_review:read` | Consultar notas, Wiki, Visão e revisão semanal. Preparar o rascunho da revisão. |

O catálogo e os schemas são fornecidos pelo `tools/list`. Os contratos novos estão no [mapa MCP](../mcp-cobertura.md). O consentimento OAuth autoriza as operações exibidas. As ferramentas que escrevem usam os serviços do LifeSystem e mantêm as validações e os recibos de idempotência previstos em cada contrato. Exclusão genérica, agenda legada, Saúde, Profissional, administração e inferência ficam fora do perfil.

O consentimento exige a sessão do proprietário. O cliente, a origem, o callback e o recurso são validados, e a troca de código exige PKCE S256. O código vence em cinco minutos. O access token vence em até quinze minutos. A renovação gira o refresh token e encerra em até trinta dias do consentimento original. A coleção interna `mcp_openbot_oauth` guarda somente hashes de códigos e tokens. Uma nova conexão concluída substitui a concessão anterior.

**Sign out** no OpenBot aciona o endpoint de revogação. Para invalidar imediatamente as autorizações a partir do LifeSystem, remova ou rotacione a credencial `openbot` na configuração. Faça isso também após restaurar um backup anterior à revogação. A desconexão da ponte de cadastro na Oracle é uma operação separada, após a validação do fluxo direto.

## Verificação

- `GET /.well-known/oauth-protected-resource/api/mcp` informa o recurso e os escopos.
- `GET /.well-known/oauth-authorization-server` informa o emissor e o fluxo aceito.
- Uma requisição MCP sem credencial retorna `401` com a URL da descoberta quando o OAuth está disponível.
- `tests/openbot-oauth.spec.ts` cobre descoberta, sessão, consentimento e cancelamento, PKCE, troca concorrente, escopos, renovação e revogação. Use credenciais e diretórios sintéticos ao executar.
