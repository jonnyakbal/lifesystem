# Cloudflare D1 e Workers AI — arquitetura híbrida

Atualização: 02/10/2026. A aplicação continua hospedada na Hostinger. Os dados
podem ficar no Cloudflare D1, e o Workers AI entra como mais um provedor de IA.
Os dois são opcionais e são acessados pela API REST da Cloudflare. **O padrão
continua sendo arquivo** (`LIFESYSTEM_STORAGE=file`). Nada muda em produção até
as variáveis abaixo serem configuradas.

## O que foi implementado

| Parte | Arquivo | Comportamento |
| --- | --- | --- |
| Backend D1 | `src/lib/storage/d1.ts` e `src/lib/storage/index.ts` | `LIFESYSTEM_STORAGE=d1` troca o destino de todas as coleções do `storage`. As telas, APIs e MCP não mudam. Um valor desconhecido falha fechado. |
| Workers AI | `src/lib/ai.ts` | Provedor `cloudflare` no endpoint OpenAI-compatível `/accounts/{id}/ai/v1/chat/completions`. Entra na mesma cadeia de fallback dos outros. |
| Migração | `scripts/d1-import.mjs` | Copia `data/*.json` para o D1. Nunca sobrescreve uma coleção existente sem `--force`. Tem `--dry-run`. |
| Exportação | `scripts/d1-export.mjs` | Grava cada coleção do D1 como `<nome>.json`. Serve de backup e para voltar ao modo arquivo. |
| Testes | `tests/storage-d1.spec.ts` | Simula a API REST do D1 com SQLite real. Cobre CRUD, conversão de captura, compressão, lease tomado, revisão alterada, lease expirado, três processos concorrentes, importação e exportação, falha fechada e Workers AI. |

## Garantias de consistência

A API REST do D1 aceita um único comando parametrizado por requisição, então
cada garantia é um comando atômico:

1. **Lease por coleção** (`lifesystem_locks`): exclusão entre processos e
   entre hosts. Ele expira em 30 s, é renovado a cada 5 s e, se o dono morrer,
   expira e é retomado. O relógio usado é o do D1, então não há diferença de
   horário entre servidores.
2. **Gravação protegida** (`lifesystem_collections`): só grava se o processo
   ainda tem o lease **e** se a revisão é a mesma lida sob o lease. Caso
   contrário, falha com `Trava da coleção X perdida.` e nada é gravado.
3. **Sem repetição automática de callbacks**: algumas transações chamam o
   Google Agenda. Em conflito, a operação falha, em vez de repetir efeitos
   externos.

Cada coleção continua sendo um documento (a mesma lista JSON do arquivo), o que
preserva a semântica de `storage.transact`. Acima de 1,5 MB, a coleção é
gravada com gzip, porque o D1 limita o valor de uma linha a 2 MB.

Isso substitui, no modo D1, a limitação "locks exigem escritores no mesmo
host" do armazenamento em arquivo.

Esses comandos foram validados no D1 real em 02/10, com tabelas
temporárias e valores fixos:
- lease adquirido;
- segundo dono bloqueado;
- gravação sem lease recusada;
- gravação com lease aceita;
- revisão desatualizada recusada;
- falha no meio desfazendo a requisição inteira.

As tabelas temporárias foram removidas.

## Fora do D1 nesta fase

- `health-ledger.json` (ledger de saúde): tem a pendência própria de reforço
  da trava, item 2 do [handoff](HANDOFF-CLAUDE.md).
- `office-*.json` (estação/Hermes): é acoplado ao consumidor Hermes 1.4.0.
- Uploads (`LIFESYSTEM_UPLOAD_DIR`): o candidato natural é o R2.

Esses arquivos continuam exigindo `LIFESYSTEM_DATA_DIR` persistente, e os
backups de arquivo continuam valendo para eles.

## Configuração

Banco criado em 02/10/2026 na conta Cloudflare: `lifesystem`, região ENAM, ID
`e459f2e8-cf80-4d8a-bc62-da37a46214cf`. Ele está vazio; as tabelas são criadas
automaticamente no primeiro acesso.

1. No painel da Cloudflare, crie dois **tokens de API** separados (princípio do
   menor privilégio):
   - D1: permissão **Account › D1 › Edit**;
   - Workers AI: permissão **Account › Workers AI › Read**.
2. Na Hostinger, adicione as variáveis de ambiente:
   ```
   CLOUDFLARE_ACCOUNT_ID=<id da conta>
   CLOUDFLARE_D1_DATABASE_ID=e459f2e8-cf80-4d8a-bc62-da37a46214cf
   CLOUDFLARE_D1_API_TOKEN=<token D1>
   AI_CLOUDFLARE_API_KEY=<token Workers AI>
   ```
   O Workers AI já funciona só com isso, independente do armazenamento.
   `AI_CLOUDFLARE_MODELS` substitui a cadeia de modelos e `AI_PROVIDER_ORDER`
   reordena os provedores.
3. **Migração dos dados**, com a aplicação ainda em `file`:
   ```bash
   npm run backup:data
   node --env-file=.env.local scripts/d1-import.mjs --dry-run
   node --env-file=.env.local scripts/d1-import.mjs
   ```
4. Troque para `LIFESYSTEM_STORAGE=d1` e reinicie. Confira as telas principais.
   Gravações feitas no modo arquivo depois da importação não vão para o D1:
   importe com a aplicação parada ou sem uso.
5. Backup do D1: `node --env-file=.env.local scripts/d1-export.mjs`. A
   Cloudflare também oferece Time Travel do D1 (restauração para um ponto no
   tempo) no painel.

**Voltar ao modo arquivo:** exporte com `d1-export.mjs <destino>`, aponte
`LIFESYSTEM_DATA_DIR` para o destino (ou copie os arquivos) e use
`LIFESYSTEM_STORAGE=file`.

## Limites do plano gratuito

Os números abaixo são aproximados e mudam; confira em developers.cloudflare.com.

- D1: 5 milhões de linhas lidas e 100 mil gravadas por dia. Desde
  01/09/2026, o excesso faz as consultas **falharem** até a meia-noite UTC.
  Cada leitura de coleção conta como cerca de 1 linha, e cada gravação como
  cerca de 4 (lease, dados, renovação e liberação). Para uso pessoal, a
  margem é ampla.
- Workers AI: orçamento diário de neurons. Quando acaba, o provedor responde
  429 e a cadeia passa para o próximo provedor configurado.
- Latência: cada leitura é uma chamada HTTP da Hostinger ao D1 (região ENAM).
  Cada gravação faz cerca de quatro chamadas. Não há cache de leitura nesta
  fase; medir em produção antes de otimizar.

## Ainda não verificado

O sandbox da nuvem não alcança `api.cloudflare.com`. O código HTTP foi testado
contra o simulador, e o SQL contra o D1 real pelo conector. A primeira chamada
real da aplicação ao D1 e ao Workers AI acontece depois da configuração na
Hostinger. Nenhum dado pessoal foi importado.
