# Deploy de produção

## Fluxo

O deploy do LIFESYSTEM é iniciado pela integração nativa do GitHub no hPanel da Hostinger. Um push para `main` aciona o build/release configurado na hospedagem. `.github/workflows/ci.yml` executa validações de TypeScript, build e Playwright; esse workflow **não** publica a aplicação.

## Confirmar uma publicação

1. Confira que o commit esperado está em `origin/main` (`git ls-remote origin refs/heads/main`).
2. Verifique o workflow de CI separadamente. CI verde confirma os checks, não o deploy da Hostinger.
3. Recarregue uma rota pública afetada e confira um elemento ou comportamento exclusivo da mudança. Se possível, valide também os recursos da versão servida. Uma interface ainda antiga pode indicar que o deploy está pendente ou falhou.
4. Só marque a release como publicada quando a nova versão for observável no site. Registre o commit conferido e a evidência funcional. A confirmação do site não revela o status interno nem os logs do build Hostinger.

## Pós-deploy do Hermes MCP

1. Cadastre duas credenciais em `MCP_API_KEYS`: uma com `ai:invoke` para `/api/ai/v1` e outra nomeada para `/api/mcp`, com os escopos mínimos necessários.
2. Atualize o Hermes na VPS para usar as duas chaves separadamente e para enviar um heartbeat autenticado a `/api/hermes/heartbeat` a cada cinco minutos.
3. Execute `MCP_URL=https://lifesystem.oj0nny.com/api/mcp MCP_API_KEY=<chave-hermes-mcp> npm run mcp:smoke` na VPS. Não imprima a chave nem registros pessoais.
4. Abra `/hermes` autenticado e confirme a identidade da chave, a última chamada de ferramenta e o heartbeat. Só então a conexão VPS → produção está comprovada.

## Diagnóstico

- Se `main` não contém o commit, investigue Git antes da hospedagem.
- Se `main` contém o commit e o site ainda serve a versão anterior, verifique o histórico de deploy/build no hPanel. O workflow de CI do GitHub não é substituto para esse histórico.
- `401 Unauthenticated` no conector Hostinger informa apenas que o hPanel não ficou acessível por aquele conector. Não tente contornar com SSH; use o fluxo de deploy já configurado e relate que os logs não puderam ser lidos.
- Não conclua que um push sozinho prova uma publicação. Registre separadamente commit enviado, CI e comportamento visto no site.

## Evidência confirmada

O commit `9cdac5120742d0b1dc8058a3879c985cf23d18a7` foi confirmado em `origin/main`. Após o push, o Planejar público foi recarregado e mostrou o novo componente de agenda integrada, “Atualizar agenda” e os intervalos livres entre 08:00 e 20:00. Isso confirma a funcionalidade na aplicação pública. O estado interno e os logs de build da Hostinger não foram inspecionados nesta sessão.
