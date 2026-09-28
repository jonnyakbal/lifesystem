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

O commit `9cdac5120742d0b1dc8058a3879c985cf23d18a7` foi confirmado em `origin/main`. Após o push, o Planejar público foi recarregado e mostrou o novo componente de agenda integrada, “Atualizar agenda” e os intervalos livres entre 08:00 e 20:00. Isso confirma a funcionalidade na aplicação pública. O estado interno e os logs de build da Hostinger não foram inspecionados nesta sessão.

### Verificação mais recente — 28/09/2026

- `origin/main` está em `0cbe179`; a última mudança de aplicação é `d1dbe4d` (controle MCP Hermes). O run #42 da CI passou para `0cbe179`; o run #41 também passou para `d1dbe4d`.
- No Planejar público, a semana mostra eventos do Google, prioridades sem horário, horários livres e um bloco de tarefa espelhado com link para abrir no Google.
- O formulário simplificado do Financeiro carregou sem o erro de validação reportado. Nenhuma transação foi criada durante a verificação.
- `/hermes` mostra heartbeat online e chamadas MCP recentes bem-sucedidas. O cron `lifesystem-heartbeat` está ativo no Hermes da VPS e tinha executado poucos minutos antes da checagem.
- O conector Hostinger respondeu `401`, então os logs internos do build não foram consultados. A confirmação da versão foi feita pelos fluxos públicos; o push de documentação não altera o código em execução.
