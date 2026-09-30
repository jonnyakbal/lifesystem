# Deploy de produção

## Fluxo

O deploy do LIFESYSTEM é iniciado pela integração nativa do GitHub no hPanel da Hostinger. Um push para `main` aciona o build/release configurado na hospedagem. `.github/workflows/ci.yml` executa validações de TypeScript, build e Playwright; esse workflow **não** publica a aplicação.

## Confirmar uma publicação

1. Confira que o commit esperado está em `origin/main` (`git ls-remote origin refs/heads/main`).
2. Verifique o workflow de CI separadamente. CI verde confirma os checks, não o deploy da Hostinger.
3. Recarregue uma rota pública afetada e confira um elemento ou comportamento exclusivo da mudança. Se possível, valide também os recursos da versão servida. Uma interface ainda antiga pode indicar que o deploy está pendente ou falhou.
4. Só marque a release como publicada quando a nova versão for observável no site. Registre o commit conferido e a evidência funcional. A confirmação do site não revela o status interno nem os logs do build Hostinger.

## Pós-deploy do Hermes MCP

1. No hPanel da hospedagem compartilhada do LIFESYSTEM, configure `MCP_API_KEYS` com três credenciais separadas: `hermes-mcp` com os escopos mínimos de ferramentas, `hermes-ai` somente com `ai:invoke` e `hermes-heartbeat` somente com `agent:heartbeat`. Não cadastre essas chaves na VPS.
2. Na VPS do Hermes, salve as chaves MCP e IA como secrets separados. Salve a chave de heartbeat como `LIFESYSTEM_HEARTBEAT_KEY` e permita que esse nome passe para scripts do terminal em `terminal.env_passthrough`.
3. Configure o cron nativo do Hermes para executar, a cada cinco minutos, o job script-only `lifesystem-heartbeat` (modo `no_agent`), apontando para `/opt/data/scripts/lifesystem-heartbeat.sh`. O script envia `POST https://lifesystem.oj0nny.com/api/hermes/heartbeat`; não coloque a chave no arquivo, no job ou em logs. Esse intervalo não chama o modelo.
4. Valide a conexão pelo teste do servidor `lifesystem` no Hermes e confirme que as ferramentas MCP carregam. Dispare o cron uma vez e abra `/hermes` no LIFESYSTEM: deve aparecer o estado online com a identidade `hermes-heartbeat` e uma hora recente.
5. Execute `MCP_URL=https://lifesystem.oj0nny.com/api/mcp MCP_API_KEY=<chave-hermes-mcp> npm run mcp:smoke` na VPS. Não imprima a chave nem registros pessoais.

## Diagnóstico

- Se `main` não contém o commit, investigue Git antes da hospedagem.
- Se `main` contém o commit e o site ainda serve a versão anterior, verifique o histórico de deploy/build no hPanel. O workflow de CI do GitHub não é substituto para esse histórico.
- `401 Unauthenticated` no conector Hostinger informa apenas que o hPanel não ficou acessível por aquele conector. Não tente contornar com SSH; use o fluxo de deploy já configurado e relate que os logs não puderam ser lidos.
- Não conclua que um push sozinho prova uma publicação. Registre separadamente commit enviado, CI e comportamento visto no site.

## Evidência confirmada

### Release confirmada — 29/09/2026

- Código de aplicação: `77419ac7ecc6647ff15254a32d6f76c502dbf207`, incluindo a revisão `0adc054`, atualização `fast-uri` e build Webpack.
- CI GitHub concluída com sucesso: [run 36654991895](https://github.com/jonnyakbal/lifesystem/actions/runs/36654991895). A confirmação Hostinger abaixo é independente da CI.
- No hPanel autenticado, a tabela de implantações mostrou `77419ac7` como **Concluído / Atual**. As tentativas `81c11c4`, `98ced9e` e `0adc054` apareceram como **Falha na construção**; o último log confirmou o problema no Turbopack.
- A aplicação pública foi aberta novamente e apresentou o botão acessível **Salvar captura** e o campo **Texto da captura rápida**, ausentes antes dessa release. Não foi enviada captura nem criado lançamento/evento para validar.
- Planejar voltou a mostrar **Google Agenda conectada**; `/hermes` mostrou **Online** e a identidade `hermes-heartbeat` após o deploy.
- A exigência de chave e a proteção de retry financeiro fazem parte do código desse build; os casos de falha foram verificados com dados sintéticos. Não houve escrita financeira de teste no runtime público.
- Evidências visuais são privadas, fora do checkout. Documentação posterior pode avançar `main` sem mudar o código de aplicação desta release.

### Publicação da revisão de confiabilidade — autorizada

Jonny autorizou integrar a revisão de privacidade, MCP e ciclo mobile depois da validação local (`140 passed`, tipos/build aprovados, lint sem erros). A release usa push normal para `main`; não inclui reescrita do histórico nem migração de dados. A confirmação pública deve identificar o novo botão acessível “Salvar captura” e seus estados, sem criar registros reais. O recibo será registrado depois da observação da versão servida.

O push `0adc054f44fdf5551795bc14eb604680f2d92eb3` foi confirmado em `origin/main`. Pelo navegador autenticado, o hPanel mostrou a execução `01a0efda-e942-71f3-aa65-eb77f99d315d` e estado **Falha na construção**. O backup terminou normalmente; a falha foi `TurbopackInternalError` no CSS de `@fontsource-variable/fraunces`, ao criar um processo Node que saiu antes da conexão. O site continuou servindo o componente de captura anterior.

O build de produção passa a usar `next build --webpack`, alternativa documentada pelo Next.js 16. O desenvolvimento mantém seu bundler padrão. A dependência indireta do MCP `fast-uri` também foi atualizada de 3.1.6 para 3.1.8: auditoria npm voltou a zero vulnerabilidades e os 140 testes passaram novamente. Não atribuir a falha ao backup nem afirmar publicação apenas porque o GitHub recebeu o commit.

### Revisão de 29/09/2026

**Test connection** no Hermes pessoal descobriu as ferramentas do servidor `lifesystem`. `/hermes` em produção mostrou heartbeat `hermes-heartbeat` recente, Online e chamadas `hermes-mcp` bem-sucedidas. Não foram criados lançamentos nem eventos nesta verificação.

Checkout e `origin/main` estavam em `98ced9e` no início. O conector Hostinger retornou `401`: recibo do build indisponível. O teste Hermes mostra nomes, não schemas; a exigência `idempotencyKey` no runtime ainda não foi certificada. Correções desta revisão permanecem locais até integração/publicação.

O commit `9cdac5120742d0b1dc8058a3879c985cf23d18a7` foi confirmado em `origin/main`. Após o push, o Planejar público foi recarregado e mostrou o novo componente de agenda integrada, “Atualizar agenda” e os intervalos livres entre 08:00 e 20:00. Isso confirma a funcionalidade na aplicação pública. O estado interno e os logs de build da Hostinger não foram inspecionados nesta sessão.

### Verificação mais recente — 28/09/2026

- `origin/main` está em `0cbe179`; a última mudança de aplicação é `d1dbe4d` (controle MCP Hermes). O run #42 da CI passou para `0cbe179`; o run #41 também passou para `d1dbe4d`.
- No Planejar público, a semana mostra eventos do Google, prioridades sem horário, horários livres e um bloco de tarefa espelhado com link para abrir no Google.
- O formulário simplificado do Financeiro carregou sem o erro de validação reportado. Nenhuma transação foi criada durante a verificação.
- `/hermes` mostra heartbeat online e chamadas MCP recentes bem-sucedidas. O cron `lifesystem-heartbeat` está ativo no Hermes da VPS e tinha executado poucos minutos antes da checagem.
- O conector Hostinger respondeu `401`, então os logs internos do build não foram consultados. A confirmação da versão foi feita pelos fluxos públicos; o push de documentação não altera o código em execução.
