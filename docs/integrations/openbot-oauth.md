# LifeSystem no OpenBot

No Marketplace do servidor Oracle, edite o cadastro **lifesystem** e mantenha **Agente Pessoal** como o único agente autorizado. Use o transporte HTTP e o endereço `https://lifesystem.oj0nny.com/api/mcp`. Deixe os cabeçalhos HTTP e o formulário de cliente OAuth vazios. O OpenBot 0.71.0 usa seu próprio [identificador público](https://openbot.run/oauth/mcp-client.json).

Abra **Sign in**, entre no LifeSystem e confirme **Autorizar leitura**. No OpenBot Web, cole o endereço final do callback somente no campo correspondente de **Sign in** quando a interface pedir. Ele contém um código de autorização de uso único. Em seguida, rode **Test connection**. As ferramentas esperadas são `list_tasks` e `list_captures`.

## Permissões

O OAuth fica disponível quando há exatamente uma credencial `openbot` em `MCP_API_KEYS`, com pelo menos um dos escopos `tasks:read` e `captures:read`. O código cruza a lista permitida do OAuth com a credencial e com os escopos aprovados na tela. As demais chaves Bearer continuam com seu contrato atual. O OAuth entrega tokens próprios para o endpoint MCP. A chave da configuração permanece no LifeSystem.

O consentimento exige a sessão do proprietário. O cliente, a origem, o callback e o recurso são validados, e a troca de código exige PKCE S256. O código vence em cinco minutos. O access token vence em até quinze minutos. A renovação gira o refresh token e encerra em até trinta dias do consentimento original. A coleção interna `mcp_openbot_oauth` guarda somente hashes de códigos e tokens. Uma nova conexão concluída substitui a concessão anterior.

**Sign out** no OpenBot aciona o endpoint de revogação. Para invalidar imediatamente as autorizações a partir do LifeSystem, remova ou rotacione a credencial `openbot` na configuração. Faça isso também após restaurar um backup anterior à revogação. A desconexão da ponte de cadastro na Oracle é uma operação separada, após a validação do fluxo direto.

## Verificação

- `GET /.well-known/oauth-protected-resource/api/mcp` informa o recurso e os escopos.
- `GET /.well-known/oauth-authorization-server` informa o emissor e o fluxo aceito.
- Uma requisição MCP sem credencial retorna `401` com a URL da descoberta quando o OAuth está disponível.
- `tests/openbot-oauth.spec.ts` cobre descoberta, sessão, consentimento e cancelamento, PKCE, troca concorrente, escopos, renovação e revogação. Use credenciais e diretórios sintéticos ao executar.
