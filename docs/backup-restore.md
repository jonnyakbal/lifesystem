# Ensaio seguro de restauração

`scripts/backup-data.mjs` copia os JSON da pasta configurada em `LIFESYSTEM_DATA_DIR`; `prebuild-backup.mjs` só o executa quando essa variável está configurada. O formato atual não cria manifesto, checksum original ou snapshot transacional. Um backup pode refletir arquivos de instantes diferentes se houver escritores ativos.

`scripts/restore-backup.mjs` serve para **ensaio em pasta isolada vazia**. Não conecta a produção, não troca o runtime e não tem destino padrão. Exige `--source`, `--target` e `--isolated`; o destino deve existir, estar vazio e ficar fora de todos os checkouts registrados no Git. Também recusa sobreposição com o snapshot, diretórios chamados `data`, `runtime`, `prod` ou `production` e o runtime informado por `LIFESYSTEM_DATA_DIR`.

Exemplo ilustrativo para um snapshot privado já existente:

```powershell
New-Item -ItemType Directory -Path C:/dev/jonny/lifesystem-restore-review-20261001
node scripts/restore-backup.mjs --source X:/private-backups/snapshot --target C:/dev/jonny/lifesystem-restore-review-20261001 --isolated
```

Não usar a pasta de dados original como destino. Não configurar o aplicativo ou um servidor para consumir o ensaio. O teste automatizado cria snapshots artificiais na pasta temporária do sistema e chama o comando real de backup.

O script aceita somente arquivos JSON planos, com nomes ASCII seguros. Recusa subdiretórios, links/junctions, traversal, nomes ambíguos no Windows, duplicatas e JSON inválido. Caminhos ancestrais de origem e destino também são verificados. Os erros não incluem os valores JSON nem os diagnósticos do parser.

Um arquivo opcional `manifest.json` é reservado para o formato abaixo. Ele precisa listar exatamente todos os JSON restauráveis, sem incluir o próprio manifesto:

```json
{
  "version": 1,
  "files": [
    { "path": "tasks.json", "size": 2, "sha256": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a" }
  ]
}
```

Nesse exemplo sintético, `tasks.json` contém `{}`. Cada entrada declara tamanho em bytes e SHA-256. O comando valida o manifesto antes de copiar e verifica novamente a cópia e a origem. Um checksum declarado não autentica o autor do manifesto. Sem manifesto, a saída informa `source-target-sha256-only`: a igualdade da cópia não comprova que o backup estava íntegro quando foi criado.

A cópia acontece em staging exclusivo ao lado do destino. O destino vazio é verificado novamente e movido para rollback antes de uma troca por rename no mesmo volume. A escrita usa criação exclusiva e sincronização dos arquivos. Se houver falha, o comando conserva staging/rollback existentes e informa suas localizações; tenta devolver o destino anterior quando a troca não foi concluída. Nunca remove dados recursivamente. Só remove a pasta de rollback vazia após sucesso. Não há garantia contra um processo hostil alterando a árvore de diretórios ao mesmo tempo; realizar o ensaio em uma pasta privada sem outros escritores.

Evidência em 01/10/2026: nove testes sintéticos passaram sem servidor. Cobrem backup legado real, manifesto válido, checksum divergente, inventário incompleto, destino ocupado, opt-in, sobreposição e checkouts registrados, arquivo criado no destino durante o staging, traversal/JSON inválido/subdiretórios, junction, alteração da origem durante a cópia com staging conservado e saída redigida do scanner de publicação. Nenhum runtime pessoal foi aberto ou restaurado. O ensaio de um backup privado real e qualquer mudança no runtime permanecem etapas operacionais separadas.
