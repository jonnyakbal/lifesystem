# Central de Fontes — especificação de produto e engenharia

*Data: 2026-09-17 · Status: proposta pra rodada de implementação · Doc irmã: `docs/analise-sistema-2026-09.md`*

---

## 1 · O problema e o conceito

Hoje o consumo de conteúdo do Jonny acontece **fora** do LIFESYSTEM: abas abertas, salvos soltos no navegador/Instagram, newsletter no e-mail, vídeo visto uma vez e perdido. Quando algo importa, a informação entra no sistema **de pinga e fuga** — via captura manual, se der.

A **Central de Fontes** fecha esse buraco: um **leitor de conteúdo dentro do LIFESYSTEM** — feed RSS/Atom + navegação de referências — onde ler, recortar, amostrar e despachar para os destinos do sistema (INBOX, Notas, Tarefas, Conteúdo, Editais) é **o mesmo gesto**.

Não é "mais um módulo": é o **braço de entrada** do segundo cérebro. O INBOX recebe o que você pensa; a Central de Fontes recebe o que o **mundo** te manda.

**Jobs to be done:**
1. *"Quero que as fontes que eu confio cheguem até mim num lugar só, sem algoritmo de rede social no meio."*
2. *"Quero ler ali mesmo — sem abrir 10 abas — e guardar só o pedaço que importa."*
3. *"Quero que o robô leia comigo: resumo, ponto-chave, 'isso tem a ver com o pilar X'."*
4. *"Quero transformar leitura em insumo: um recorte vira nota, uma notícia de edital vira tarefa, uma inspiração vira ideia de conteúdo."*

**Nome:** módulo `Fontes` (rota `/fontes`), título de exibição "Central de Fontes". Alternativas descartadas: "Radar" (colide com o estágio Radar do Editais), "Órbita" (colide com projeto existente), "Leitor" (descreve o objeto, não o valor).

---

## 2 · Princípios (herdados do produto)

1. **Captura rápida, processamento deliberado — agora pra conteúdo externo.** Ler é barato; decidir é caro. A Central deixa *ler* fluido e empurra toda *decisão* (pra onde isso vai?) pra um gesto explícito e adiável.
2. **Nada se perde por padrão.** Item lido não é item jogado fora: fica arquivado e buscável. O ⌘K global passa a achar conteúdo de fontes.
3. **O robô sugere, o Jonny dispõe.** IA resume/classifica/sugere destino — nunca move nada sem confirmação (mesmo contrato do Copiloto).
4. **Single-user, JSON storage, sem cron.** Tudo dentro dos padrões que já sustentam o sistema — sem Redis, sem fila, sem serviço externo.
5. **Mobile é leitura principal.** O gesto mais comum é abrir no celular 5 minutos: a fila de leitura tem que ser perfeita em 390px.

---

## 3 · Modelo mental

```
┌─────────┐   refresh    ┌──────────────────┐   abrir    ┌─────────────────────┐
│ FONTES  │ ───────────▶ │  FILA DE LEITURA │ ─────────▶ │      LEITOR         │
│ RSS/Atom│  on-demand   │  não lidos,      │  in-place  │ modo leitura limpa  │
│ + sites │  (sem cron)  │  novos, salvos   │            │ (conteúdo extraído) │
└─────────┘              └──────────────────┘            └─────────┬───────────┘
                                                                    │ gestos
                                              ┌─────────────────────┼──────────────────────┐
                                              ▼            ▼        ▼          ▼           ▼
                                         ✂️ RECORTE    🧪 AMOSTRE  📥 INBOX  ✅ TAREFA   💡 CONTEÚDO
                                       (trecho + fonte)  (trecho +  (item inteiro) (item/trecho
                                                          meu comentário)          como inspiração)
```

- **Fonte** = assinatura (RSS/Atom de um site, canal YouTube, categoria de site sem feed via página raspada leve — fase 2).
- **Item** = o que a fonte publicou (artigo, vídeo, post). Tem estado: `novo → lido → [salvo | arquivado]`.
- **Recorte (clip)** = trecho selecionado do texto + link de origem → vira captura/nota com citação formatada.
- **Amostra (sample)** = recorte **+ comentário seu na hora** — a unidade de "pensamento a partir de leitura" (a diferença entre colecionar e pensar).

---

## 4 · Modelo de dados

Duas coleções novas no padrão existente (`storage`, `BaseEntity`, seed em `data/`):

```ts
// types/index.ts (adição)

export type SourceKind = 'rss' | 'atom' | 'youtube' | 'page'; // page = raspagem leve (fase 2)
export type SourceState = 'active' | 'paused';

export interface Source extends BaseEntity {
  title: string;              // nome de exibição ("Brain Pickings", "M undone"…)
  url: string;                // site editorial (público)
  feedUrl: string;            // o feed de verdade (o que é fetchado)
  kind: SourceKind;
  category?: string;          // livre, padrão do sistema (ex.: 'design', 'mercado')
  pillarId?: string;          // vínculo opcional com pilar — alimenta "por que eu sigo isso?"
  state: SourceState;
  refreshMinutes: number;     // sugestão mínima do dono da fonte; default 240
  lastFetchedAt?: string;
  lastError?: string;         // última falha de fetch (mostrada com carinho, não escondida)
  etag?: string;              // conditional GET
  lastModified?: string;
  itemCount: number;          // cache de contagem pra UI
}

export type ItemState = 'new' | 'read' | 'saved' | 'archived';

export interface SourceItem extends BaseEntity {
  sourceId: string;
  guid: string;               // id do feed (dedupe!)
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  summary?: string;           // resumo/summary do feed (próprio, não IA)
  imageUrl?: string;          // og:image / enclosure
  contentText?: string;       // texto extraído pra modo leitura (lazy — ver §6)
  wordCount?: number;
  state: ItemState;
  starred: boolean;
  readAt?: string;
  savedCaptureId?: string;    // item despachado pro INBOX — link de volta
  ai?: {                      // preenchido sob demanda (§7)
    tldr?: string;            // 2-3 frases
    keyPoints?: string[];
    pillarId?: string;        // sugestão de pilar
    suggestedAction?: 'note' | 'task' | 'content' | 'reference';
    model?: string;           // auditoria: qual modelo gerou
    generatedAt?: string;
  };
}
```

**Integração com o que já existe:**
- `CaptureTargetType` **já tem `'reference'`** — recortes/amostras/salvos entram no INBOX como captura `type:'link'` com `targetType:'reference'`, herdando de graça todo o fluxo de conversão existente (nota, tarefa, conteúdo…). A Central não inventa um destino: **ela é uma fonte nova de capturas**.
- ⌘K: `command-palette.tsx` ganha uma entidade `sources` na `ENTITY_CONFIG` (busca em título/resumo de itens não arquivados).
- **Hoje:** card "Fila de leitura" (3-5 itens não lidos, "abrir Central →") — leitura vira parte do dia, sem dominar a tela.
- **Revisão Semanal:** passo novo no `weekly-review-flow`: "Fontes — X lidos nesta semana, Y salvos, Z fontes com erro" + ação de arquivar em lote.
- **Editais:** fontes de editais (gov.br, FUNARTE etc.) podem alimentar o detector existente — um item de fonte marcado com categoria "edital" sugere "Analisar com IA" direto no leitor.

---

## 5 · Ingestão (sem cron, sem serviço externo)

**Rota única: `POST /api/fontes/refresh`** — chamada quando a Central abre (stale-while-revalidate) e pelo botão "Atualizar".

- Para cada fonte `active` com `lastFetchedAt` mais velho que `refreshMinutes`: `fetch(feedUrl)` com **conditional GET** (`If-None-Match`/`If-Modified-If-Modified-Since`) → 304 = zero parsing.
- **Todo o refresh compartilha um budget de 8s e roda com `Promise.allSettled`** — uma fonte lenta/bugada não trava as outras nem a resposta; erros individuais caem em `lastError` (visível na UI da fonte, nunca em toast de erro global).
- Resposta imediata: itens novos gravados (dedupe por `sourceId+guid`), contagem pra UI. **Extração de artigo é lazy** — só quando o item é aberto (§6).
- Guard de rede: **reuso integral dos guards do `fetch-page.ts`** (SSRF, 5 MB, content-type, UA de navegador) — extraídos pra função compartilhada, não copiados.
- **Descoberta de feed:** "Adicionar fonte" aceita qualquer URL; o backend busca a página e lê `<link rel="alternate" type="application/rss+xml|atom+xml">`; YouTube: URL de canal → `/feeds/videos.xml?channel_id=…` nativo. Sem dependência nova pra isso (regex + parsing leve).
- **OPML:** importar (colar XML no diálogo) e exportar (download) — é o bilhete de ida e volta pros outros leitores, e deixa o "migrar minhas assinaturas" viável no dia 1.
- Hostinger não dá cron: **basta abrir a Central** (stale-while-revalidate cobre o uso real — quem lê todo dia não precisa de daemon). Opcional fase 3: o próprio Hermes/MCP dispara `refresh_sources` numa rotina.

**Parsing RSS/Atom:** sem dependência pesada. `fast-xml-parser` (zero deps, ~50 kB) dá parsing tolerante dos dois formatos; normalizador próprio `src/lib/fontes/normalize-feed.ts` unifica RSS 2.0/Atom/ RDF em `SourceItem[]`. CDN de imagens remotas passam por `<img>` direto com `referrerPolicy="no-referrer"`.

---

## 6 · Modo leitura (o "robô me ajuda a ler")

Abrir um item **não abre aba nova**: abre o leitor embutido (painel à direita no desktop, página/sheet full no mobile).

1. **Extração lazy do artigo** na primeira abertura (`GET /api/fontes/items/[id]/content`): baixa a página (guards de sempre), extrai o corpo com heurística de artigo (pontuação de densidade de texto por bloco — estilo readability mínimo, ~120 linhas sem deps), grava `contentText` (parágrafos) e `imageUrl`.
2. **Fallbacks honestos:** se a extração falhar (site pesado, paywall, JS-only), o leitor mostra o **resumo do feed** + botão claro "Abrir original ↗". Nunca um corpo cortado fingindo que é o artigo.
3. **Tipografia de leitura:** Fraunces (a fonte de leitura que o sistema já carrega), ~68ch, interlinha 1.7, dark/light corretos (depende do fix `@custom-variant dark` — pré-requisito!). Barra de progresso de leitura discreta.
4. **YouTube:** embed do vídeo + descrição; **posts curtos:** texto integral do feed já resolve.

### O robô (IA sob demanda, com o pipeline que já existe)

Botão **"Resumir com IA"** no leitor + opção "Resumir não lidos" em lote (com confirmação e estimativa de itens). Usa a **cadeia de providers existente** (`src/lib/ai.ts`: Groq → OpenRouter → Mistral com fallback), prompt fixo gerando JSON: `tldr` (≤3 frases, PT-BR), `keyPoints` (≤5), `pillarId` (dentre os 6 pilares reais), `suggestedAction`. Grava em `item.ai` com modelo e data (auditoria).

- **Barato por design:** roda **só no que você abre** (ou aprova em lote). Nada de queimar quota em item que você nunca vai ler.
- **Tradução pontual** (fase 2): "resumir e traduzir" pro PT-BR em conteúdo EN.
- **Sugestão vira ação com 1 clique:** se `suggestedAction = 'task'`, o leitor oferece "Criar tarefa a partir do resumo" pré-preenchida — sempre com confirmação (contrato do Copiloto).

---

## 7 · Os gestos de leitura (o coração da feature)

Seleção de texto no leitor abre **menu flutuante de recorte** (padrão Medium/Readwise, ~50 linhas de componentinho):

| Gesto | O que faz | Destino |
|---|---|---|
| **✂️ Recortar** | trecho + fonte + link vira citação formatada | captura nova (`type:'link'`, `targetType:'reference'`) → INBOX |
| **🧪 Amostrar** | recorte + **campo de comentário inline na sequência** | mesma captura, com o comentário como corpo — "o que eu pensei sobre isso" |
| **📌 Salvar item** | item inteiro referenciado (título, URL, resumo, imagem) | captura → INBOX (processa depois, na Revisão) |
| **✅ Tarefa** | dialog pré-preenchido (título = item, descrição = trecho/seleção, pilar sugerido pela IA) | `tasks` |
| **💡 Ideia de conteúdo** | item vira card "Idéia" no kanban de Conteúdo com link de origem | `content` |
| **⭐ Estrela / 📥 Ler depois / ✓ Lida / 🗄 Arquivar** | estados do item, atalhos de teclado | `sourceItems` |

Cada gesto de escrita mostra toast com **"Ver em ↗"** (abre a nota/tarefa de destino) — o loop fecha visível.

**Atalhos no leitor (desktop):** `j/k` navegar itens · `o` abrir original · `r` recortar · `s` estrela · `m` marcar lida/não-lida · `e` arquivar · `a` resumo IA · `esc` volta pra fila. Mobile: barra de ações inferior fixa (mesmos 5 gestos principais).

---

## 8 · Telas

### Desktop (≥1280px) — 3 painéis

```
┌──────────┬──────────────────────────┬──────────────────────────────────┐
│ FONTES   │ FILA (lista de itens)    │  LEITOR (abre no painel)         │
│          │                          │                                  │
│ Todas    │ ▸ Tudo · Não lidos 12    │  Título do artigo (Fraunces 28)  │
│ ─────    │    · Salvos · Arquivo    │  fonte · autor · 2d · 8 min      │
│ ⭐ 3     │                          │  [Resumir com IA] [Abrir ↗]      │
│ ─────    │ ┌──────────────────────┐ │  ────────────────────────────    │
│ Design 4 │ │ ● Título do item     │ │  corpo do artigo…                │
│ Cultura 7│ │   fonte · 2d · resumo│ │  [selecionado: ✂ Recortar        │
│ Tech  11 │ └──────────────────────┘ │   🧪 Amostrar | 💡 Conteúdo]     │
│ Editais 2│ ┌──────────────────────┐ │                                  │
│ ─────    │ │ ○ Título lido (apaga)│ │  [📥 Salvar] [✅ Tarefa]         │
│ + Fonte  │ └──────────────────────┘ │  [⭐] [✓] [🗄]                    │
│ ↕ OPML   │ [Atualizar · 12 novos]   │                                  │
└──────────┴──────────────────────────┴──────────────────────────────────┘
```

### Mobile (390px) — pilha com sheet

Fila full-width (cards compactos: fonte, título, 2 linhas de resumo, tempo) → leitor em página cheia (não sheet: leitura longa merece navegação real) com **barra de ações inferior fixa** (Salvar · Recortar · Tarefa · ⋯) e progresso no topo. Segue o padrão do app (header fixo + dock escondido durante leitura).

### Estados

- **Vazio absoluto:** "Nenhuma fonte ainda. Cole o endereço de um site ou blog que você gosta — eu acho o feed pra você." + botões "Adicionar fonte" e "Importar OPML".
- **Fonte com erro:** linha da fonte fica âmbar com ícone ⚠ + tooltip do `lastError` + botão "tentar agora" — erro de feed é fato, não exceção global.
- **Carregando leitor:** skeleton do texto (já extraído = instantâneo nas reaberturas).

---

## 9 · API

| Rota | Métodos | Nota |
|---|---|---|
| `/api/fontes/sources` | GET, POST | POST faz autodiscovery do feed |
| `/api/fontes/sources/[id]` | PATCH, DELETE | pausar/editar/excluir (itens vão pro arquivo, não somem) |
| `/api/fontes/sources/import-opml` | POST | importação |
| `/api/fontes/refresh` | POST | budget 8s, conditional GET, dedupe |
| `/api/fontes/items` | GET | filtros: `state`, `sourceId`, `starred`, `q` |
| `/api/fontes/items/[id]` | PATCH, DELETE | estado, estrela |
| `/api/fontes/items/[id]/content` | GET | extração lazy do artigo |
| `/api/fontes/items/[id]/ai` | POST | resumo/pontos/sugestão (provider chain) |
| `/api/fontes/items/[id]/dispatch` | POST | os gestos: `clip`, `sample`, `save`, `task`, `content` — zod schema por gesto |
| `/api/fontes/export-opml` | GET | download |

Todas atrás do gate de cookie (`proxy.ts`, nada público novo) + `assertFetchableUrl` em toda URL que o servidor fetcha.

---

## 10 · MCP + Copiloto (o Hermes lê com você)

Espelhar no `mcp/tools.ts` e `copiloto/tools.ts` (mesma camada `storage`):

- `list_sources` / `add_source(url)` / `refresh_sources`
- `list_reading_queue` (não lidos, com tldr quando existir)
- `summarize_item(id)` — gera e retorna o resumo
- `save_item_to_inbox(id)` / `clip_item(id, selection)`

Isso habilita, pelo Telegram: *"Hermes, o que chegou nas minhas fontes hoje?"* → fila com resumos → *"salva a segunda no INBOX"*. É a materialização do "robô me ajuda a ler" sem abrir o app.

---

## 11 · Fases de implementação

| Fase | Entrega | Critério de aceite |
|---|---|---|
| **F0 — Fundação** (~½ sessão) | types + coleções + `assertFetchableUrl` compartilhado + parser de feed + `/api/fontes/sources` + `/api/fontes/refresh` + autodiscovery + seed de 2-3 feeds reais | adicionar fonte por URL acha o feed; refresh popula itens; dedupe funciona; CI verde |
| **F1 — Leitor MVP** (~1 sessão) | página `/fontes` 3 painéis + mobile + leitor com extração lazy + estados lida/estrela/arquivo + atalhos j/k/m + Hoje com fila de leitura + navegação/⌘K | abrir → ler → marcar lida sem sair do app; mobile utilizável a uma mão |
| **F2 — Gestos + IA** (~1 sessão) | seleção → recortar/amostrar; salvar/tarefa/conteúdo; resumo IA on-demand + lote; menu de destinos reaproveitando `capture-conversion` | recorte vira captura com citação correta e "Ver em ↗" funciona; IA só gasta no que foi aberto |
| **F3 — Robô ativo** (~1 sessão) | MCP/Copiloto tools; passo de Fontes na Revisão Semanal; OPML export; digest diário opcional no Hermes | fluxo completo pelo Telegram; revisão mostra a semana de leitura |

**Fora de escopo (consciente):** full-text de paywall (nunca burlar — resumo do feed + link pro original), sincronização multi-dispositivo de posição de leitura (single-user, aceitável), pastas/tags de fonte (categorias planas bastam), recomendação de novas fontes por IA (depois, se doer).

**Riscos & mitigação:** memória da Hostinger (extração lazy + cap 5 MB já existente); feeds quebrados (estados de erro por fonte); quota IA free tier (on-demand + provider chain com fallback); sites JS-only (fallback honesto pro feed).

---

## 12 · Decisões (respondidas em 2026-09-17)

1. **Nome de exibição:** "Central de Fontes" / "Fontes" — trabalho segue com este; pode renomear depois sem custo (constante + label).
2. **Seção da navegação:** **Explorar** ✔ decidido.
3. **Fila de leitura no Hoje:** em aberto (proposta: 3 itens não lidos + link "abrir Central").
4. **Resumo IA em lote:** **item a item** ✔ decidido (revisitar só se quota sobrar).
5. **Fontes de editais na Central:** **sim, na F2** ✔ decidido.
