# Preparação reversível de privacidade — 01/10/2026

## Atualização depois da entrega de produtividade

O código `8328c67270527c7e424f464a7c25110e9c2d6846` foi integrado por fast-forward e enviado normalmente para `main`. Isso publica as melhorias de aplicação, **não reescreve o histórico**. Uma nova candidata privada incorpora esse código e o trabalho do Escritório em `117ed3c`; a preparação antiga abaixo permanece como recibo histórico.

A nova recuperação é `C:/dev/jonny/lifesystem-private-roadmap-2026-10-01T19-30-55-939Z-recovery.bundle`, SHA-256 `4df25d7349096f4f89524d520a429235728d4b2540862bb9f99ce11388f25fc4`. A candidata é `C:/dev/jonny/lifesystem-private-roadmap-2026-10-01T19-30-55-939Z-candidate.bundle`, SHA-256 `86d6fe5d582b2a0b957a5051092fb3ecac603af00ebdb5ac4e53d19e1f005f94`. Ambos passaram em `git bundle verify`.

A candidata `8e9fd29776b3e5a55bb404a956696973ceeb6443` abrange somente `refs/heads/main`, remove 101 caminhos históricos de risco e conserva os 460 arquivos retidos com igualdade exata de caminhos, modos e blobs. A cópia bare não tem remote. O scanner de texto examinou 400 arquivos e retornou três achados: os fixtures artificiais de `tests/agent-pilot.spec.ts` e `tests/branding.spec.ts` (`SECRET_ASSIGNMENT`) e o fixture já classificado em `tests/office-ui.spec.ts` (`BEARER_LITERAL`). A classificação verificou marcadores sintéticos sem exibir valores; as regras continuam ativas. Sessenta arquivos tiveram somente metadados. Nenhuma credencial de produção foi consultada ou rotacionada.

`docs/analise-sistema-2026-09.md` deixou de ser rastreado na árvore atual; a cópia local privada foi preservada no worktree e o histórico original permanece recuperável no bundle. A filtragem candidata é somente por caminhos conhecidos: não certifica todos os conteúdos históricos, imagens retidas, PII, PR refs, forks ou caches. Documentos e imagens comunitários ainda requerem revisão apropriada antes de ampliar exposição pública.

Não houve force-push nem alteração remota dos refs saneados. Uma próxima aplicação exige atualizar a candidata para eventuais commits posteriores, conferir o SHA remoto na janela, revisar os demais refs e autorizar explicitamente quais serão reescritos. A autorização de publicação normal não equivale à autorização de reescrita.

## Recibo da primeira preparação

Base desta preparação: `b1cf1afa7e7b3ff4944bf6095f0a4bc1b96d4118`. Os novos scripts e os outros ajustes do roadmap ainda são alterações de trabalho e **não estão incorporados na candidata**. Não houve commit, push, consulta remota nem reescrita de refs dos checkouts existentes.

O inventário de nomes de arquivos encontrou dez refs locais, zero caminhos atualmente rastreados nas categorias de risco e 100 caminhos históricos: 18 JSON de runtime e 82 capturas. Essa operação usa metadados de caminhos; não lê runtime, `.env` real nem pixels de imagens históricas.

`node scripts/audit-public-content.mjs --repo .` examina blobs de texto rastreados no `HEAD`. A saída contém contagens, caminhos e IDs das regras, sem valores encontrados. Arquivos de environment, runtime/artefatos, análise pessoal antiga, links, arquivos grandes, binários e extensões não classificadas recebem somente metadados. Ele não abre o `.env` do checkout. Os exemplos `.env.example` também ficam fora da leitura por prudência.

A execução na base examinou 368 arquivos de texto e identificou um arquivo com a regra `BEARER_LITERAL`: `tests/office-ui.spec.ts`, linha 464. A revisão segura do código classificou esse achado como **falso positivo de fixture sintético**: o mesmo literal é injetado em `HERMES_OFFICE_TOKEN` por `playwright.office-ui.config.ts` e usado pelo teste automatizado de registro no escritório. A comparação ocorreu em memória; o valor não foi exibido. O scanner continua mostrando o achado, evitando uma exceção ampla que esconda futuros tokens. Esse achado não demanda rotação de credencial de produção. Sessenta e um arquivos receberam apenas metadados: 58 binários/não classificados, um environment, uma análise pessoal e um runtime/artefato. Os testes artificiais confirmaram que o scanner não revela marcadores sensíveis dos fixtures.

O scanner é heurístico e incompleto. Não verifica conteúdo de todos os commits históricos, outras pontas de branches, refs especiais de PRs, forks, caches, arquivos ignorados ou PII geral. Não certifica ausência de segredos. Documentos/imagens destinados à comunidade ainda exigem revisão humana com acesso privado apropriado; as imagens pessoais históricas não foram abertas nem renderizadas.

Foram criados artefatos novos, privados, fora do repositório, preservando os anteriores:

| Artefato | Caminho privado |
| --- | --- |
| Recuperação dos refs locais atuais | `C:/dev/jonny/lifesystem-history-recovery-roadmap-2026-10-01-145201.bundle` |
| Cópia bare descartável, sem remote configurado | `C:/dev/jonny/lifesystem-sanitized-review-roadmap-2026-10-01-145201.git` |
| Bundle somente dos refs alcançáveis saneados | `C:/dev/jonny/lifesystem-history-sanitized-candidate-roadmap-2026-10-01-145201.bundle` |

SHA-256 da recuperação: `f17a02ac9ca8bc33a4876eeaed49c318268cc15ad9943df4417436257ccc850a`. SHA-256 do bundle candidato: `a7fe37a4cbf3e17f5253a111023736594f705e29a542a0b2e8cba2176df2dc4e`.

`git bundle verify` confirmou ambos os bundles. A recuperação inclui 14 entradas, incluindo HEADs de worktrees; a candidata tem dez refs locais, e seu bundle inclui essas entradas mais HEAD. A filtragem por índice foi feita somente na cópia bare, removendo JSON de runtime, capturas, `.env` real e `docs/analise-sistema-2026-09.md`. Os refs `refs/original/*` foram removidos somente dessa cópia antes de gerar o bundle saneado. O diretório bare pode conter objetos antigos órfãos e nunca deve ser publicado ou distribuído; preferir o bundle de refs alcançáveis para uma próxima revisão privada.

A candidata na base aponta para `75a81f20db8f8930c171fee235bba89b3bb16d9f`. Sua auditoria de nomes retornou zero caminhos de risco atuais ou históricos. A comparação de entradas de árvore, modos e IDs dos blobs confirmou igualdade exata de todos os arquivos retidos: 429 arquivos na base, 428 na candidata, excluindo somente `docs/analise-sistema-2026-09.md` na árvore atual. Esse resultado valida a filtragem por caminho, não a privacidade do conteúdo remanescente.

Antes de qualquer abertura pública: ampliar a auditoria de conteúdo histórico apropriado, revisar materiais comunitários, incorporar os commits aprovados do roadmap à preparação e repetir a comparação/auditorias, incluindo a classificação documentada do fixture. Inventariar refs remotos e PRs na janela de aplicação. Rotacionar credenciais apenas quando uma exposição for identificada.

A fronteira irreversível permanece específica: Jonny precisa autorizar explicitamente os refs que terão histórico reescrito, a janela da operação e eventual force-push com proteção contra alterações concorrentes. A autorização para executar o roadmap não autoriza publicar automaticamente essa candidata nem realizar `push --mirror`. Clones, PRs, forks e caches exigem tratamento próprio; o backup privado deve ser preservado.
