# Auditoria de privacidade do histórico

## Evidência — 29/09/2026

O GitHub confirmou o repositório como público. A versão atual não rastreia JSON pessoais, `.env` reais ou capturas de QA. Nomes de arquivos em todos os refs locais revelaram **100 caminhos históricos**: **18 JSON de runtime** e **82 artefatos de captura/teste**. O script não lê nem imprime conteúdo desses arquivos.

Retirar arquivos do índice não elimina commits antigos. A ausência de `.env` no inventário não prova ausência de segredos em outros arquivos. Faltam scanner de conteúdo com saída redigida e revisão dos documentos/imagens destinados à comunidade.

## Preparação reversível

Artefatos privados em `C:/dev/jonny/`, fora do checkout:

- `lifesystem-history-recovery-2026-09-29.bundle`: backup completo de refs locais, incluindo stash; integridade confirmada por `git bundle verify`.
- `lifesystem-sanitized-review.git`: cópia descartável, sem remote. Os refs candidatos removem JSON de `data`, artefatos, `.env` reais e a análise antiga com exemplos pessoais.
- `lifesystem-history-sanitized-candidate-2026-09-29.bundle`: somente histórico alcançável saneado; não inclui objetos antigos órfãos que ainda possam existir no diretório usado na filtragem.

A auditoria dos refs candidatos retornou zero caminhos de risco. O diff de `main` contra `98ced9e` remove somente a análise antiga: código preservado. A candidata ainda não incorpora as correções locais e não é uma release pronta.

O inventário remoto de branches/tags encontrou `main` (`98ced9e`) e `arena/01a0b176-lifesystem` (`4bfb610`), sem tags. Ambas foram incluídas na preparação local; a branch antiga foi saneada separadamente. Refs especiais de PRs, forks e caches continuam fora dessa certificação.

O repositório de trabalho e o GitHub não tiveram histórico reescrito. Os bundles são privados e não devem ser commitados, enviados a issues ou distribuídos.

## Ação final para abertura à comunidade

1. Revisar documentação restante e executar scanner de segredos com redaction. Rotacionar somente credenciais cuja exposição seja identificada.
2. Inventariar refs remotos, branches, tags, PRs e clones numa janela curta. A candidata não certifica refs exclusivos do GitHub.
3. Incorporar mudanças aprovadas à cópia saneada; conferir novamente diff, bundle e auditoria.
4. Com autorização específica de Jonny, reescrever os refs necessários. Os SHAs mudam e clones/PRs precisam ser realinhados; preservar o backup privado.
5. Validar integração Hostinger e dados persistentes; tratar forks/caches separadamente quando necessário.

Não fazer `push --mirror` automaticamente: pode remover refs de terceiros. Force-push não elimina cópias já baixadas.
