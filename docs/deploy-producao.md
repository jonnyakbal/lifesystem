# Deploy de produção

## Estado mais recente no repasse — 01/10/2026

Main e origin/main observados em `c42a2e5b24ee915c744d4aa230695ea48dccff75`. A API pública do GitHub confirmou [run 36928569715](https://github.com/jonnyakbal/lifesystem/actions/runs/36928569715) concluído/success para esse SHA. A conversa da estação, integrada em `92db730`, tem [recibo próprio](office-chat-plan.md): Hostinger concluiu às 18:20 e Chrome mostrou respostas reais de Sirius e Hermes, sem alterar registros de negócio. Este repasse não reabriu a produção para certificar outro deploy.

Os recibos abaixo preservam resultados das respectivas rodadas; contagens locais e afirmações de observação pendente não descrevem automaticamente o estado atual. A falha inicial de Chromium foi corrigida por `4ee5545` e a CI posterior passou. Próximos passos e limites estão no [handoff para Claude](HANDOFF-CLAUDE.md). Esta atualização é local, sem push/deploy.

## Recibo de produtividade e confiabilidade — 01/10/2026

Código de aplicação `8328c67270527c7e424f464a7c25110e9c2d6846`, integrado sobre o Escritório `117ed3c` sem substituir o trabalho em andamento. Push normal confirmado em `origin/main`. A tabela autenticada de implantações da Hostinger mostrou esse SHA como **Concluído / Atual**, após a construção iniciada em 01/10 às 16:29:19.

Na aplicação pública autenticada, Carga apresentou **Jornada de trabalho**, **Configurar capacidade**, esforço explícito, tarefas sem estimativa e comparação com jornada bruta. O painel de configuração expôs início, fim, dias e fuso. Nova Tarefa apresentou **Estrutura e esforço**, tarefa principal, dependências e minutos. Os painéis foram fechados/cancelados sem salvar, criar ou concluir tarefas. Não houve escrita financeira, evento Google de teste ou alteração de Hermes/Arco CRM.

Validação local final no servidor de produção isolado: **352 passed (8.7m)**, zero retries; tipos, lint global com zero avisos e build Webpack passaram. Três testes do setup de autenticação passaram. Auditoria npm: zero vulnerabilidades. Testes de domínio verificam recorrência persistente, relações, concorrência de storage, fusos e restauração com dados sintéticos; a observação pública não substitui esses testes nem certifica transporte real dos agentes.

CI GitHub dessa aplicação: [run 36914635779](https://github.com/jonnyakbal/lifesystem/actions/runs/36914635779). Tipos, lint e build concluíram; a execução terminou com falha de localização do Chromium, corrigida na rodada posterior. O [run 36917946053](https://github.com/jonnyakbal/lifesystem/actions/runs/36917946053) passou para `4ee5545`. Deploy confirmado e CI são evidências separadas.

Detalhes: [execução](roadmap-execution-2026-10-01.md), [schemas e regras de tarefas](task-structure-capacity.md), [pilotos dos agentes](agent-pilot.md) e [preparação privada do histórico](roadmap-privacy-preparation.md). As expansões futuras de agenda estão especificadas, não implementadas. Publicação de documentação posterior não muda o código de aplicação certificado neste recibo.

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

### Visões ricas, Foco e Carga — 01/10/2026

- Código de aplicação `8ce708d4da11cd2198771652c7793e5b8497254c`, enviado por push normal para `main`. Nenhuma configuração, credencial ou dado de produção foi alterado para essa entrega.
- O hPanel autenticado mostrou `8ce708d4` como **Concluído / Atual**, na implantação iniciada às 12:48:43 (horário exibido pela hospedagem). Isso foi conferido independentemente do GitHub Actions.
- A aplicação pública autenticada carregou `/_next/static/chunks/app/(dashboard)/tarefas/page-bce6b3e98d8dcc09.js`. Mostrou Lista editável e os sete seletores: Quadro, Lista, Semana, Calendário, Linha do tempo, Foco e Carga.
- Foco abriu **Foco de execução**, com botão separado **Concluir tarefa em foco**. Carga abriu **Carga de trabalho**, seletor **Semana da carga** e link **Planejar horários**. Nenhum status, checklist ou registro real foi alterado nessa confirmação; Gantt não foi implementado.
- Verificação local em build de produção, dados sintéticos: **68 passed (3.9m)**, sem retries. Build Webpack e TypeScript: exit 0; lint global: exit 0, 0 erros / 96 avisos existentes. O harness foi arquivado fora do Git. Detalhes e falhas corrigidas em [registro de entrega](task-focus-load-delivery.md).
- O [run 60 da CI](https://github.com/jonnyakbal/lifesystem/actions/runs/36887153902) estava em execução no momento desta confirmação. Não declarar CI verde com base no deploy; o recibo certifica a hospedagem e os controles públicos observados. Commits posteriores de documentação não mudam o código de aplicação certificado acima.


### Recuperação de tarefas e descoberta Órion — 30/09/2026

- Código de aplicação `99fa4ab43d12a0dd8567262650493c641a2908be`, enviado por push normal a `main`; integração nativa Hostinger manteve o canal de deploy.
- Verificação local: **47 testes passaram (1,5 min)** em servidor com dados sintéticos, incluindo abertura sem concluir, Desfazer/reabertura, busca, etapas históricas/terminais personalizadas, recorrência lenta, planejamento, exclusão, smoke MCP e cinco telas em desktop/mobile. Tipos e build Webpack passaram; lint **0 erros e 96 avisos existentes**, sem avisos nos arquivos de código alterados.
- Na sessão autenticada do Chrome, Hoje carregou `page-9571ad3c62f4eca9.js`, seção **Concluídas hoje**, botões explícitos **Concluir tarefa** e títulos como links para abrir detalhes. A consulta HTTP sem sessão redireciona ao login e não certifica essa tela.
- O link **Ver todas as concluídas** abriu `/tarefas?completed=1` com o filtro ativo. Tarefas carregou `page-cdfb12cc90cdd7ec.js`; as 16 concluídas estavam acessíveis, com 16 controles de reabertura e 12 datas de conclusão disponíveis. Nenhuma tarefa real foi concluída, reaberta ou excluída nesta verificação; a tarefa acidental não foi escolhida por suposição.
- O smoke de saúde validou localmente o contrato 1.2 e apenas descoberta de metadados. Não certifica a credencial de produção nem transporte Hermes/Órion/Sirius. Não houve alteração do Hermes, Arco CRM, Calendar ou credenciais.
- O conector Hostinger permaneceu sem acesso autenticado (401); não foram consultados seus logs internos. Após Jonny informar a chave SSH disponível, foi confirmada somente a conexão com a hospedagem, sem substituir configurações de produção. A confirmação desta release veio das telas servidas.
- Documentação posterior pode avançar `main` sem alterar o código de aplicação certificado acima. CI GitHub não foi consultada neste recibo e não substitui a evidência da aplicação pública.

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

Atualização da CI: o run `36914635779` terminou com 184 testes de domínio aprovados e 168 falhas de inicialização do Chromium. O executável era procurado no cache temporário da aplicação, diferente do cache da instalação. A correção preserva o cache original do runner e mantém dados/cache do servidor isolados; quatro testes do setup e 14 testes de interface passaram depois do ajuste (19.2s), sem retries. Tipos passaram novamente. Uma nova execução integral remota será conferida após o push da correção; a release de aplicação acima continua certificada independentemente dessa falha de infraestrutura de teste.
Confirmação final da CI: [run 36917946053](https://github.com/jonnyakbal/lifesystem/actions/runs/36917946053), commit `4ee554537c9f8dc2d80f8c4441bde58428ddf4f6`, terminou **completed / success**. A API oficial confirmou sucesso em autenticação sintética, tipos, lint, build, instalação do Chromium e suíte completa; nenhuma seleção de testes ou retry foi adicionada para obter esse resultado. A documentação posterior conserva o código de aplicação da entrega certificada em `8328c67`.
