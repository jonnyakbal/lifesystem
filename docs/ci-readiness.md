# CI e verificação de prontidão

A suíte completa de Playwright usa `playwright.ci.config.ts`. O alias
`playwright.readiness.config.ts` usa o mesmo ambiente. Ambos iniciam `next start`
na porta 3107 e exigem um build de produção atualizado no checkout de teste.
O servidor nunca é reutilizado, mesmo fora do GitHub Actions.

```sh
npm ci
node --test scripts/playwright-ci-setup.test.mjs
npx tsc --noEmit
npm run build
npx playwright install chromium
npx playwright test --config=playwright.ci.config.ts
```

Execute esses comandos em um checkout isolado quando houver um servidor Next
ativo no diretório principal: o build substitui `.next`. No GitHub, cada job usa
um checkout novo, instala as dependências com `npm ci` e executa o build uma
vez antes da suíte. Não são usados `next dev`, servidor pessoal ou serviços
remotos para a validação de produção.

No build local, exporte `LIFESYSTEM_DATA_DIR`, `LIFESYSTEM_UPLOAD_DIR` e
`LIFESYSTEM_BACKUP_DIR` para diretórios temporários vazios e mantenha as
credenciais externas vazias antes de `npm run build`. O config de Playwright
isola o processo de teste; ele é carregado depois do build e não modifica
retroativamente o ambiente usado para compilação.

## Armazenamento e autenticação

Cada execução cria um diretório temporário novo para dados, uploads, backups,
cache e sessão. Os workers herdam esse diretório; ele não depende de `data/`
ou de uploads do checkout. O build do GitHub também recebe diretórios vazios
separados. As credenciais de Calendar, IA e Nous são explicitamente vazias;
as credenciais de login, MCP e publicação Office são somente fixtures sintéticas.

O setup consulta uma API protegida sem cookie e exige `401`, faz login por
`/api/login`, confirma acesso à API com a sessão e salva o estado para os
fixtures `page` e `request`. Uma aplicação em modo desenvolvimento ou com
autenticação ausente falha antes da suíte. O login sintético coincide com o
usado pelos testes Office, que também exercitam o fluxo de login explicitamente.

Os testes de login inválido e Bearer inválido continuam consultando handlers
públicos, que verificam suas próprias credenciais. Os testes de autenticação
Office, Saúde e Profissional constroem seus próprios `NextRequest` e não
recebem cookies do setup. A sessão global não substitui esses testes de negação.

## Falhas e evidências

A suíte executa todos os arquivos em `tests/`, com um worker e zero retries.
Não há filtros de testes, aumento global de timeouts ou alteração global de
datas. O timezone do navegador e do servidor é `America/Sao_Paulo`; os testes
que usam clock continuam responsáveis por suas próprias datas sintéticas.

O CI publica relatório HTML, screenshots e traces somente de falhas, além
dos resultados do Playwright. A sessão fica fora desses artefatos. O resumo
inclui as últimas linhas da suíte quando disponíveis; erros anteriores ao
Playwright mantêm o diagnóstico no step que falhou.

O comando `npm test` sem config continua sendo a verificação local em
desenvolvimento na porta 3000. Para prontidão de release, use sempre o config
de CI e o checkout isolado. Uma lista de testes ou um build bem-sucedido não
equivale a uma suíte completa aprovada. Antes de publicar, registre o comando,
contagens e eventuais falhas da execução real; a aprovação remota do workflow
precisa ser conferida no GitHub depois do push.

## Correção do cache do navegador no runner Linux

O run GitHub 36914635779 compilou, verificou tipos/lint e passou nos 184 testes de domínio, mas 168 testes de interface falharam antes da abertura do navegador: o executável era procurado em `/tmp/lifesystem-ci-*/cache/ms-playwright`, diferente da pasta usada na instalação. Isso não foi falha de autenticação ou deploy.

`runnerEnvironment` mantém o `XDG_CACHE_HOME` original do runner, portanto instalação e workers resolvem o mesmo Chromium. O servidor da aplicação continua recebendo o cache e os dados isolados da execução. O teste de regressão cobre a separação e a preservação de armazenamento/autenticação sintéticos; nenhuma variável de produção é carregada. A suíte completa no GitHub deve ser repetida antes de declarar a CI remota aprovada.