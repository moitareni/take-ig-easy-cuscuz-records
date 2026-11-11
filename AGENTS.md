# Diretrizes para Agentes de IA — Cuscuz Records Insta Kit

Este documento estabelece o contexto do negócio, regras inquebráveis de identidade visual, arquitetura de software e convenções para quaisquer agentes ou desenvolvedores que trabalhem neste repositório.

---

## 1. Contexto do Projeto

O **Cuscuz Records Insta Kit** é uma aplicação web estática criada sob medida para a gravadora independente **Cuscuz Records**.
O objetivo é permitir que o cliente crie de forma prática, rápida e intuitiva posts para o feed do Instagram nos formatos **Vertical 3:4 (1080×1440)** (padrão), **Horizontal 4:3 (1440×1080)** e **Quadrado 1:1 (1080×1080)**, mantendo 100% de consistência com a identidade visual da marca. Também é possível criar **carrosséis** de até 10 slides, exportados em ZIP.

> **Estado atual — release v3 "Meus rascunhos" (10/11/2026) + Leva 4 (11/11/2026).** A aplicação é 100%
> estática, sem back-end, e **abre sempre na home "Meus rascunhos"**
> (`src/screens/HomeScreen.tsx`); o editor só existe com um rascunho ativo. Todos os
> posts — únicos ou carrosséis — são rascunhos persistidos em **IndexedDB**
> (`src/lib/drafts/`, schema v2) com autosave, capa WebP, backup em ZIP e bloqueio por
> aba. `useEditor` e `useCarousel` são stores de sessão **em memória** (não usam mais
> `persist`/`localStorage`); as chaves antigas `cuscuz-insta-kit:rascunho` e
> `cuscuz-insta-kit:carrossel` são apenas migradas e mantidas como rollback. As specs
> em `.kiro/specs/` registram a implementação de base e trazem, no topo de cada
> arquivo, uma **Revisão** com o que prevalece. **Este `AGENTS.md` é a fonte de verdade.**
> A **Leva 4** (11/11/2026) corrigiu a Textura, o log "Na folha", o rename da home e o
> Passo 4; ver §2.8, §2.10, §2.14, §2.15, §2.16 e a Revisão no topo das specs.

### 1.1 Usuário-alvo e filosofia de experiência (visão do produto)

O objetivo central do projeto é a **experiência do usuário**, e para acertá-la é preciso saber
**quem** usa o sistema:

- **Perfil**: pessoas **leigas** — sem familiaridade com softwares de edição de imagem
  (Photoshop, Canva, etc.) e sem conhecimento de conceitos de design.
- **Meta do produto**: uma pessoa leiga conseguir produzir artes para o próprio Instagram com
  **qualidade de designer** — ou seja, com as regras de design bem aplicadas *sem que ela
  precise conhecê-las*.

Para essa meta ser possível, a interface assume estas responsabilidades:

1. **Conduzir por passos** — o processo de criar o post acontece em etapas numeradas, uma
   preocupação por vez.
2. **Explicar brevemente cada função** — todo recurso recebe uma descrição curta e legível sobre
   o que ele faz e quando usar.
3. **Impor as regras de design** — decisões fora do recomendado para um design bem-feito são
   **bloqueadas ou sobreponíveis pela interface** (ex.: `Texto ≤ Título`, paleta oficial fechada,
   fontes da marca), com notificação amigável quando uma tentativa é travada.
4. **Manter a UI evidente e simples** — rótulos claros em PT-BR, ações de um clique quando
   possível, e nada escondido atrás de jargão do mundo do design.

Princípios de UX derivados dessa visão (critério para qualquer mudança nesta UI — pergunte:
*"isso deixa a leiga com menos dúvida, menos medo e menos chance de errar?"*):

- **Reconhecimento em vez de memorização**: mostrar as opções com exemplos visuais (miniaturas)
  em vez de nomes técnicos; nada que dependa de lembrar um tutorial.
- **Revelação progressiva**: uma tela mostra só o essencial da etapa atual; recursos avançados
  ou opcionais são marcados ("opcional") ou escondidos até serem relevantes.
- **Prevenção acima de correção**: impedir o erro (limites, defaults bons da marca) e oferecer
  reversão fácil (undo/redo, "Reverter") quando ele acontecer.
- **Carga cognitiva baixa**: poucas decisões por tela; previews prontos (fundos, presets da
  logo, tamanhos P/M/G) resolvem a decisão técnica pela pessoa.
- **Ajuda no contexto**: a orientação aparece exatamente no passo em que é necessária, nunca
  como um manual a decorar.
- **Qualidade visível em "tela pequena"**: a arte é consumida no celular — garantias de
  contraste e hierarquia que a arte pareça certa também na miniatura do feed.

---

## 2. Regras Inegociáveis da Marca

### 2.1 Formato e Fundo
- **Formatos suportados**:
  - **Vertical (3:4)**: formato padrão (resolução de exportação: **1080×1440 px**). Fundo cobre a folha inteira travado.
  - **Horizontal (4:3)**: proporção paisagem (resolução de exportação: **1440×1080 px**). Mesmas opções de texturas do 3:4, aplicadas rotacionadas 90° pivotadas no centro, preenchendo a folha sem distorção nem perda de qualidade.
  - **Quadrado (1:1)**: proporção quadrada (resolução de exportação: **1080×1080 px**). A largura encaixa perfeitamente (1080 px) e o excesso de altura (360 px) é recortado.
- **Deslize e enquadramento em 1:1**:
  - Exclusivamente no **Passo 1 (Fundo, `step === 0`)**, o usuário pode deslizar o fundo verticalmente (arrastando direto na folha ou usando o slider e botões rápidos "Topo", "Centro" e "Base").
  - **Ao sair da aba Fundo (`step !== 0`)**, o deslize é estritamente **desativado e travado** (`draggable={false}`, `listening={false}`), garantindo que o fundo nunca seja deslocado por engano enquanto o usuário manipula enfeites, fotos ou textos.
- **Espelhamento centralizado**: o fundo pode ser espelhado horizontalmente (`↔`) e verticalmente (`↕`) pelo usuário no Passo 1, pivotado perfeitamente no centro sem vazar margens. Os controles ficam na **`BackgroundMirrorToolbar` do dock direito** (`aria-label` "Espelhar fundo ↔" / "Espelhar fundo ↕", estado `active`), visíveis apenas quando `step === 0`, há fundo escolhido e nenhum elemento selecionado. O antigo card "Opções do Fundo" foi removido; o corte 1:1 permanece como bloco inline no painel ("Corte vertical", "Topo", "Centro", "Base").
- **Formato no carrossel**: definido na criação e **imutável**. O seletor "Formato do post" só existe no Passo 1 do **Post único**; no carrossel a informação aparece como leitura no Header (`FormatGlyph` + `POST_FORMATS`). `handleFormatChange` mantém um guard com toast como defesa em profundidade.

### 2.2 Paleta de Cores Oficial
Somente as seguintes cores podem ser utilizadas na arte e nos textos:
- **Amarelo**: `#f8ce2b`
- **Amarelo Quente**: `#f6c01f`
- **Barro**: `#942911`
- **Preto**: `#0b0500`
- **Verde Ceará**: `#698f3f`
- **Creme**: `#f7ebcd` (utilizado no traçado e tons de apoio)

### 2.3 Tipografia
- **Títulos e Destaques (Headlines)**: `Londrina Solid`, peso `900` (Black).
- **Textos de Apoio / Corpo (Body)**: `PT Sans Narrow`, peso `bold` (700) ou `regular` (400).
- **Fontes auto-hospedadas**: carregadas via `@fontsource` para garantir funcionamento offline e exportação de alta fidelidade sem depender de serviços externos.

### 2.4 Efeitos de Texto da Marca (Photoshop Replication)
Quando o "Efeito da Marca" está ativo em títulos:
- **Traçado**: cor `#f7ebcd`, largura visível de `2px`, posição externa.
- **Sombra projetada**: cor `#0b0500` (Preto), opacidade `46%`, ângulo de 90° (direção vertical para baixo), distância `11px`, desfoque `4px`.
- Implementado em Canvas sobrepondo a camada preenchida sobre a camada contornada com sombra, preservando os cantos internos da tipografia.

### 2.5 Bordas de Destaque
- Na UI o rótulo é **"Caixa de destaque"** (antes "Borda de Destaque"), no card **Editar Texto** do Passo 4.
- **Borda 1 (Amarela)**: offset retangular contornando o texto na cor `#f8ce2b`, com a textura `textura-borda` recortada nos limites da borda e aplicada no modo de mesclagem `soft-light` ("luz indireta") com 100% de opacidade.
- **Borda 2 (Barro)**: mesmo offset na cor `#942911`, com a textura no modo `soft-light` e 44% de opacidade.

### 2.6 Regra do Tamanho do Texto (`Texto ≤ Título`)
- O tamanho efetivo de qualquer elemento de texto do tipo **Texto** (corpo) **nunca** pode ultrapassar o tamanho do menor **Título** ou **Destaque** presente no post.
- Caso não haja nenhum título no post, o tamanho do texto é limitado a no máximo **72px**.
- Caso o usuário tente aumentar o texto acima do limite (seja pelo slider ou redimensionando pela alça), o sistema trava no valor máximo permitido e emite a notificação amigável:
  > *"Opa! O texto não pode ficar maior que o título 🙈"*
- Da mesma forma, títulos não podem ser encolhidos abaixo do maior texto existente.
- **Tetos por estilo** (`src/brand/brand.ts`): `FONT_SIZE_MIN = 16`, `BODY_FONT_SIZE_MAX = 320` (corpo), `HEADING_FONT_SIZE_MAX = 4000` (títulos/destaques). O teto de 4000 px é **técnico** (protege canvas/export), não um limite de design — a usuária pode aumentar o título livremente até ele. Corpo com títulos grandes continua travado em 320 px. Implementado em `textRules.ts` (`textSizeLimits`/`clampTextSize`) e `multiSelect.ts` (`groupScaleBounds` com `maxCap`, `enforceTextRule`). O slider de `TextStep.tsx` usa `limits.max` finito.

### 2.7 Logo e Enfeites / Grafismos
- **Enfeites e Grafismos são opcionais**: o usuário pode adicionar quantos desejar ou nenhum.
  - **Enfeites de fundo**: florais, folhas, ondas e acabamentos da pasta `ENFEITE/` (incluindo `grade` com modo `soft-light` e `sobrepor` cobrindo a folha).
  - **Grafismos**: elementos da pasta `GRAFISMOS/` (`chain`, `esqueleto`, `mp3player`, e `papel-divisao` com modo de mesclagem `divide`).
  - **Molduras**: moldura retrô da pasta `JANELA/`, disponível no Passo 2 para emoldurar fotos e composições.
- **Logo é opcional**: só aparece se o usuário decidir adicionar. Apenas uma logo é permitida por post, podendo alternar entre "Com papel" e "Sem fundo". Os presets de posição da logo (`tl`, `tr`, `bl`, `br`, `tc`, `bc`) seguem dinamicamente a margem ativa das guias de layout (`layoutGuides.margin`, ex.: 32, 56, 80, 100); quando as guias estão ocultas (`visible = false`) ou a guia de margens está desativada (`showMargins = false`), a margem efetiva é `0` (a logo cola na borda da folha).
- **Nomes padronizados dos enfeites** (Leva 2): os 12 `label`s são definidos em `DECOR_OVERRIDES` (`scripts/build-assets.mjs`) e gravados em `src/assets-manifest.json`. Todos em Title Case, sem CAIXA ALTA e sem sufixo numérico nu: `Arabesco floral`, `Folhagem rendada`, `Vinha vertical`, `Onda de canto`, `Traço ondulado`, `Trama amarela`, `Xadrez amarelo`, `Faixa de espinhos`, `Esqueleto solar`, `Tocador retrô`, `Fita de papel verde`, `Janela retrô`.
  - **REGRA INEGOCIÁVEL:** os **`id`s são imutáveis** (`flores`, `folhas-1`, `folhas-2`, `ondas-1`, `ondas-2`, `grade`, `sobrepor`, `chain`, `esqueleto`, `mp3player`, `papel-divisao`, `janela`). Estão gravados nos `Doc` dos rascunhos; `sanitize()` descarta qualquer enfeite com `id` desconhecido. Só o `label` pode mudar. `DECORATION_ANCHORS` (`brand.ts`) é chaveado por `id` e permanece intacto. Rodar `npm run assets` após alterar o mapa; conferir que nenhum WebP mudou de hash.

### 2.8 Textura Final (opcional, desligada por padrão)
- Etapa **6. Textura** com três acabamentos independentes:
  - **Papel amassado**: overlay da textura `TEXTURE/` (`public/brand/papel-textura.webp`) sobre a folha, com opacidade regulável (sugestão: 40%).
  - **Craquelado**: overlay da textura `BORDER/TEXTURA-BORDA.png` (`public/brand/textura-borda.webp`) sobre a folha, com opacidade regulável (sugestão: 40%).
  - **Granulado**: grão monocromático com distribuição gaussiana, gerado por RNG **com seed** (`mulberry32`) para o grão ficar **idêntico no preview e no export**.
- Todos vêm com checagem desligada; nunca devem ser aplicados automaticamente na criação de um post (`FINISH_ENABLED_DEFAULT = false`). Isso continua valendo com o botão **"Ativar todas"** — ele é uma ação **explícita** da usuária.
- **"Ativar todas"** (Leva 2): `enableAllFinishes()` em `editorStore.ts` liga os três em **um único `set`** (= um único passo de undo), preservando opacidades/intensidade; quando os três já estão ligados o **mesmo botão vira "Desativar todas"** (Leva 3), que chama `disableAllFinishes()` — também um único `set`/passo de undo, preservando os valores. **Leva 4**: o botão **"Restaurar padrão"** e a action `resetFinish()` foram **removidos** (não havia mais ponto de entrada e zera valores que "Desativar todas" preserva); hoje esses dois botões são o **único** caminho para ligar/desligar os três de uma vez. No carrossel, `finish` é por slide e o subscriber de `main.tsx` sincroniza só o Slide Ativo.
- **Cartões compactos de acabamento** (Leva 3, `TextureStep.tsx` + `TextureStep.module.css`): cada acabamento (Papel amassado, Craquelado, Granulado) é um cartão **sem texto explicativo**, com o nome e um **checkbox do tema** (`components/ui/Checkbox.tsx`, quadrado "adesivo" amarelo quando marcado, `<input type="checkbox">` real) no canto superior direito. **Clicar em qualquer parte do cartão liga/desliga**; a área de ajustes (sliders, tamanho do grão) e o botão de prévia não alternam (`stopPropagation`). Opacidade/intensidade mantêm o comportamento (mexer no controle liga o acabamento). Os botões "Ligado/Desligado" foram removidos.
- **Prévia da textura** (Leva 3): botão "Prévia da textura" (não mais `<details>`) no cabeçalho do cartão de papel e de borda; fica **invisível (`opacity: 0`) e só aparece no hover do cartão**, no foco do teclado, quando aberto e sempre em telas de toque (`@media (hover: none)`). O `PreviewImage` só é montado quando aberto. Granulado não tem imagem, logo não tem botão.
- **Contrato de teste**: checkboxes com nome acessível `Papel amassado`, `Craquelado`, `Granulado`; botões `Ativar todas` / `Desativar todas`; `Prévia da textura` — `e2e/flow.spec.ts` e `e2e/regressoes.spec.ts` dependem deles. (Os antigos rótulos `Papel (Desligado|Ligado)` etc. não existem mais.)

### 2.9 Imagens do Usuário (etapa 3, opcional)
- **Limite total: até `IMAGE_MAX_COUNT` (5) imagens por post**, contando duplicatas; a 6ª é bloqueada com toast amigável.
- Entrada por seletor de arquivos ou **arrastar e soltar** no painel e direto **na folha** (a imagem nasce no ponto do drop, posicionada nas coordenadas da folha ativa).
- Mesmas transformações dos outros elementos: drag, resize proporcional, rotação, flip ↔/↕, snap, camadas, duplicar (respeita o limite), apagar e undo/redo.
- **Persistência**: só os metadados (imageId, dimensões, transformações) vão no `Doc`, que hoje é gravado dentro do `DraftBody` do rascunho no **IndexedDB** (`src/lib/drafts/`); o **binário processado + miniatura ficam no store `images`** do mesmo banco (`cuscuz-insta-kit`) — **nunca** guardar foto em base64 em `localStorage` (estoura cota e trava a UI). O GC de órfãos considera a união dos `imageId`s de **todos** os rascunhos e slides, não só do ativo.
- Pipeline: raster (png/jpeg/webp/gif/avif/bmp; **SVG recusado**), máx. 25 MB, downscale para no máximo 3000 px no maior lado, encode WebP q0.92 com fallback JPEG, miniatura de 320 px, fila sequencial de importação.
- Ao remover, o blob **não** é apagado na hora (undo precisa dele); GC de órfãos roda no boot, junto com a reconciliação do doc.

### 2.10 Remoção de fundo (etapa 3, opcional)
- **Sempre explícita, nunca automática** (mesma regra das texturas): botão "Remover fundo" no
  card da imagem selecionada — **ponto de entrada único** (a tesourinha da lista "Na folha" foi
  removida; a lista só seleciona e exclui). Dois modos calibrados —
  **Pessoa** (alpha suave p/ cabelo + decontamination de cor nas bordas) e **Objeto**
  (máscara firme: median + curva estreita + erosão) — presets em `src/lib/bgRemoval.ts`.
- **100% client-side** (fotos nunca saem do navegador): BiRefNet_lite re-exportado a 512²
  (`studioludens/birefnet-lite-512`, fp16 ≈ 94MB, MIT) via `@huggingface/transformers`
  (WebGPU → fallback wasm/fp32). Download **único** na primeira utilização, com aviso e
  barra de progresso reais; depois fica cacheado e funciona offline. Créditos no `README.md`.
- O recorte entra pelo mesmo pipeline de imagens: `registerProcessedImage` → IndexedDB →
  `replaceImage` (preserva posição/rotação/escala; undo/redo grátis; duplicatas não são
  afetadas; a versão anterior vira órfã e sai no GC do boot). Encode: WebP com alpha,
  fallback PNG — **nunca JPEG**. `replaceImage` guarda a imagem anterior em `el.cutFrom`
  (persistida no doc e preservada pelo GC) — o botão **"Reverter fundo"** troca de volta
  pra original e limpa o `cutFrom`.
- UX (ver `bgRemovalStatus.ts` + `ImageStep.tsx`): o **botão "Remover fundo" vira o quadro
  dentro do card**; se a imagem alvo for deselecionada com o quadro aberto, ele recua pro
  topo do painel — clique fora NUNCA fecha, **só o X fecha**. Durante download/recorte o X
  desativa e entra o botão **"Cancelar"** (invalida o fluxo via época; o download da
  ferramenta continua em background p/ acelerar a próxima). Uma inferência por vez; último
  modo lembrado em `localStorage`.
- **Quadro de recorte enxuto** (Leva 3): o título do passo de escolha é a pergunta
  **"O que há na imagem para recortar?"** (a linha "Escolha o tipo de recorte pra …" saiu) e
  os dois modos ficam **um ao lado do outro** (`.modeGrid` em grid de 2 colunas; cartão na
  vertical: ícone em cima, nome embaixo). A **explicação de cada modo não fica mais solta no
  cartão**: vive no balão do **(?)** (`HelpTip`, `aria-label="Como funciona
  o modo {Pessoa|Objeto}"`), que abre em hover, foco e toque. O `(?)` fica **fora** do botão do
  modo, para o nome acessível continuar limpo ("Pessoa"/"Objeto"). Os textos dos modos **não
  usam travessão**. Alinhamento do balão: `center` em todos os cartões e `end` no último — o
  balão fica sempre montado no DOM, então posição errada geraria rolagem horizontal no painel
  (regressão verificada em mobile).
  **Empilhamento**: o "levante" do hover (`translateY(-1px)`) fica no `.modeHit`, **nunca no
  `.modeCard`** — um `transform` no cartão criaria contexto de empilhamento e prenderia o balão
  dentro dele, deixando o cartão vizinho (depois na árvore) cobri-lo.
- **Nota de primeira vez**: leva um **selo "!"** amarelo no canto (`.noteWarn`) no lugar do
  emoji de milho — é aviso de download grande, não comemoração.
- **Card "Imagem Selecionada" enxuto** (Leva 3): o card mostra **só o nome da imagem e dois
  botões lado a lado** — **"Trocar imagem"** e **"Remover fundo"** (que vira **"Reverter
  fundo"** quando há `cutFrom`, porque aí não faz sentido recortar de novo). Quando há
  `cutFrom`, "Remover fundo" dá lugar a "Reverter fundo" — os dois não aparecem juntos.
  Espelhar ↔/↕, trazer/enviar entre camadas e excluir **saíram do card**: moram só no dock
  direito (`AlignToolbar`: "Espelhar horizontalmente/verticalmente", "Trazer para frente",
  "Enviar para trás", "Excluir (Delete)"). Regra: **um caminho só por ação** — o que está no
  dock não se repete no painel. **Leva 4**: as linhas da lista "Na folha" usam o componente
  `ElementListRow` — a **caixa inteira é clicável** para selecionar e a lixeira, irmã do botão,
  só exclui (sem selecionar junto); Imagens mantêm miniatura + nome, sem numeração nem ponto.
  Ver §2.15.

### 2.11 Seleção múltipla (Ctrl/Cmd/Shift + clique)
- **Seleção conjunta**: o usuário pode segurar `Ctrl`, `Cmd` (Mac) ou `Shift` e clicar em múltiplos elementos na folha para selecioná-los juntos.
- **Alternância**: clicar num elemento já selecionado com modificador o remove da seleção. Clicar sem modificador num elemento o seleciona isoladamente. Clicar no vazio desmarca tudo (a não ser que uma tecla modificadora esteja pressionada).
- **Transformações em lote**: o `Transformer` único do Konva engloba todos os nós selecionados. É possível mover o conjunto (com snap ímã no centro e nas guias de layout calculado sobre a caixa de união do grupo), redimensionar proporcionalmente (`keepRatio`) e rotacionar em torno do centro comum.
- **Regra de Texto em grupo**: durante o redimensionamento em conjunto, a regra `Texto ≤ Título` (seção 2.6) e os limites globais de fonte são checados sobre a proporção do conjunto; se o limite for atingido, o `boundBoxFunc` trava a escala e emite o toast amigável correspondente.
- **Ações em lote**: a `AlignToolbar` exibe o selo `N×` com as ações de alinhar à página pela caixa do grupo, trazer pra frente, enviar pra trás, duplicar (respeitando o limite de 5 imagens e ignorando logo duplicada com aviso) e excluir. Atalhos `Delete`, `Ctrl+D` e setas direcionais operam sobre todos os itens selecionados.

### 2.12 Home "Meus rascunhos" e persistência (release v3)

- **Primeira tela sempre**: `App.tsx` renderiza `boot` → `home` → `editor` conforme `draftsStore.screen`. O editor **só existe com um rascunho ativo**; `bootDrafts()` migra, reconcilia, roda GC e libera a home.
- **Estado**: `store/draftsStore.ts` guarda `screen`, `drafts`, `listStatus`, `activeDraftId`, `activeKind`, `activeTitle`, `saveStatus`.
- **Persistência** (`src/lib/drafts/`): banco IndexedDB `cuscuz-insta-kit` com stores `drafts` (`DraftMeta`), `documents` (`DraftBody`), `covers` (blob WebP), `meta` (marcador de migração) e `images`. `DRAFT_SCHEMA_VERSION = 2`. `DraftBody` é `SingleDraftBody { doc, finish }` ou `CarouselDraftBody { slides, activeSlideIndex, format }`. `DraftMeta` traz `title`, `titleSource: 'auto' | 'user'`, `kind`, `format`, `slideCount`, datas.
- **Autosave** (`session.ts`): `markDraftDirty()` → `scheduleSave(450ms)` → `persistIfDirty()` → `saveDraftRecord()` (transação nos dois stores) → `updateActiveMeta` + `setSaveState('saved')` + `broadcastDraftsChanged()` + `ensureCover()`. `flushSession()` roda em `visibilitychange`/`pagehide`/`beforeunload`. Uma única `saveChain` serializa os saves; `navigator.locks` impede duas abas editando o mesmo rascunho; `BroadcastChannel('cuscuz-insta-kit:drafts')` mantém a home sincronizada.
- **Capas** (`cover.ts`): `captureAndSaveCover()` e `ensureCover()` (primeira capa). O provedor em `EditorScreen.tsx` esconde Transformer/guias para capturar e **restaura seleção, edição e guias sem tocar em `step`**. `useDraftCovers` converte blobs em object URLs e os revoga na troca de lista.
- **Home**: card "Continuar de onde parou" (último aberto), grade com capa/selo/título/ações, estado vazio com **só o título e o `+ Criar novo`** (sem parágrafo explicativo), renomear/duplicar/excluir com "Desfazer", "Baixar backup" (ZIP) e aviso de cota. A criação fica num **único botão `+ Criar novo`** (`components/CreateDraftDropdown.tsx`, `data-testid="create-draft-trigger"`), com as duas opções do `ModeDropdown` do editor ("Post único" / "Carrossel", mesmos ícones `Sparkles`/`Images` e as mesmas dicas). **Sem rascunhos**, o `+ Criar novo` fica **somente no quadro central** (`showHeaderCreate = drafts.length > 0 || listStatus !== 'ready'`); com rascunhos, fica no header. O título da seção tem o balão `HelpTip` (`(?)`) em vez de descrição permanente.
- **Migração**: `migrateLegacyDrafts()` lê as chaves `localStorage` antigas, copia o JSON cru para `meta` (rollback) e grava os registros; é idempotente e **nunca apaga** as chaves legadas nesta versão.
- **Reconciliação/GC**: união dos `imageId`s de todos os rascunhos e slides; `reconcileBodyImages` remove elementos fantasmas e `collectGarbageImages` apaga blobs órfãos.
- **Pendência registrada (11/11/2026, fora da Leva 4)**: o item "incrementar a tela antes de haver rascunhos" foi **descartado** a pedido do Reni e será detalhado em outra oportunidade. Nenhuma alteração de boot/home foi feita por conta dele: `screen === 'boot'` segue com o `<div>` de 100vh em `App.tsx` e `showHeaderCreate` segue como está. Não antecipar uma interpretação sem o detalhamento.

### 2.13 Modo Carrossel

- **Dois modos**: `single` e `carousel` (`useCarousel.mode`), alternados pelo `ModeDropdown` do Header. Post único → Carrossel pede confirmação ("Trocar pra Carrossel?"); Carrossel → Post único usa `SlidePickerDialog` (escolher slide ou "Começar do zero") com toast "Desfazer". **A conversão preserva o `activeDraftId`** — não cria nem descarta rascunho.
- **Formato**: escolhido no diálogo de criação na home e **fixo** depois disso (`carouselStore.format`). `setFormat` do editor é ignorado no carrossel pelo subscriber; o Passo 1 não mostra o seletor.
- **Slides**: `SlideData { id, doc, finish }`, até `CAROUSEL_MAX_SLIDES = 10`. `finish` é **por slide**; `loadSlideIntoEditor` zera etapa/seleção/histórico e o subscriber de `main.tsx` grava `doc`/`finish` de volta com `updateActiveSlide`. Elementos **crossover** vazam entre slides adjacentes (ver `.kiro/specs/carousel-posts/`).
- **Tira de slides** (`SlideTray`): import **estático**, altura reservada (`min-height: 120px`), nasce no primeiro frame com botões **desativados**, `aria-busy` e "Preparando as miniaturas..."; `trayReady` libera quando a miniatura do slide ativo carrega **ou** após 1,5 s (nunca trava). Miniaturas via `useSlideThumb` (cache + hash, debounce 400 ms, largura 270 px) e `PreviewImage`.
- **Exportação**: no modo Post único o Header exibe o botão primário `Exportar`; no modo Carrossel exibe o dropdown `Exportação` (`ExportDropdown`) com duas opções: `"Somente este slide"` (exporta PNG apenas do slide ativo) e `"Todos os slides"` (`exportCarousel()` gera ZIP `cuscuz-carrossel-YYYY-MM-DD-HHmm.zip`, `slide-NN.png`, com progresso no botão e confete ao concluir).
- **Selo**: "Slide X de Y" aparece junto à folha (`role="status"`) e no contador da tira.

### 2.14 Header, Dock e nome do projeto

- **Nome editável** (Leva 2): clicar no `<h1>` abre `<input aria-label="Nome do projeto">`; Enter/blur confirma, `Escape` cancela, vazio/inalterado não salva. `renameActiveDraft()` (`session.ts`) atualiza **`activeMeta`** (senão o próximo autosave restaura o título automático), define `titleSource: 'user'`, chama `saveDraftRecord`, marca `isNewDraft = false` e transmite `drafts-changed`. Renomear um rascunho novo e vazio passa a persisti-lo.
- `shortcuts.ts` já ignora `INPUT`/`TEXTAREA`/`contentEditable` — digitar no nome não apaga elementos nem move a seleção. `Header.module.css` define `.titleInput` com `user-select: text` (o `body` tem `user-select: none`).
- **Renomear "sem salto" (Leva 3)**: ao entrar em edição, o título **permanece exatamente como estava** — a única mudança é a "pílula" creme (`--c-creme`) em volta, **sem borda, sem outline e sem empurrar nada**. O `<input>` fica em um `inline-grid` com um `.titleGhost` (`opacity: 0`, **não** `visibility: hidden`, que colapsa a largura em Chromium) que espelha o texto e dimensiona o campo; só cresce ao digitar (empurrando o selo `Salvo`, nunca no clique). Há limite de **80 caracteres** (`maxLength`) e `max-width: min(340px, 100%)` (inclusive no mobile, onde `60vw` fazia o `<h1>` cobrir o selo `Salvo`). O texto é **todo selecionado ao focar**.
- **Mesmo comportamento no card da home** (`HomeScreen.tsx`): clicar no título **ou** no botão `Renomear` (lápis) abre a mesma pílula inline (`.cardTitleGhost`). Não existe mais campo com borda verde. O card ganhou o botão direto **`Exportar`** (`HomeDraftExporter.tsx`, exporta PNG/ZIP sem abrir o editor), ao lado de Duplicar e Excluir.
- **Lápis some durante a edição (Leva 4)**: no card da home, o botão `Renomear` é renderizado só com `!isEditingTitle` — some ao clicar no lápis **ou** no nome e **só volta** quando o nome é confirmado (Enter/blur) ou cancelado (Escape). O `onMouseDown` + commit-duplo do lápis saíram; `.cardTitleEditWrapper` usa `max-width: 100%` (antes reservava 34 px para o ícone). Ver `e2e/rascunhos.spec.ts`.
- **Cor de seleção da marca**: `::selection` e `::-moz-selection` em `global.css` usam o **amarelo da marca** (`--c-amarelo`, `#f8ce2b`) com texto `--c-preto`; o mesmo vale para o realce de seleção em `ThumbGrid` e `EditorCanvas`. Nada de azul padrão do navegador.
- **Layout do Header e Dock**:
  - À esquerda no Header: botão Voltar, título editável + subtítulo (`FormatGlyph` + formato) e, logo ao lado, o **selo de autosave** (`Salvo` / `Salvando...` / `Alterações...`).
  - À direita no Header: `ModeDropdown` seguido da ação de exportação (`Exportar` em post único ou dropdown `Exportação` no carrossel). O antigo botão `"Começar do zero"` foi removido do Header.
  - **Gatilho do `ModeDropdown`** (Leva 3): segue o **mesmo modelo do `+ Criar novo`** (`CreateDraftDropdown`) — ícone `ArrowLeftRight` (15px, stroke 2.5) + rótulo **"Modo"** em `Londrina Solid` 900 + `ChevronDown` que gira ao abrir. O tamanho é o do `Exportar`/`Exportação` (`Button size="sm"`: `padding: 6px 12px`, `font-size: 16px`, borda 2px, `--radius-sm`, `--shadow-md`, `gap: 8px`), para os dois terem o mesmo peso visual no header. Diferença: o fundo é **creme** (`--c-creme`), não amarelo — o amarelo fica reservado para a ação primária de exportar. O gatilho **não mostra mais o modo atual nem o glifo de formato** (a prop `format` saiu de `ModeDropdownProps`; o formato continua como leitura no subtítulo do Header). Como o modo ativo não é visível, o `aria-label` do botão o informa (`Modo: {Post único|Carrossel}. Abrir lista de modos`). Hover/aberto usam `--c-surface-muted` (nunca amarelo) e o menu ganhou a animação `modeMenuPop`.
  - No Dock lateral direito (`EditorScreen.tsx`): `ZoomControls`, `BackgroundMirrorToolbar`, `AlignToolbar`, `GuideToolbar` e, na base (onde antes ficava o botão de download), o grupo de **Desfazer / Refazer (Undo / Redo)**.

### 2.15 Componentes de UI e convenções visuais

- **`PreviewImage`** (`components/ui/`): toda prévia de imagem passa por ele. Estados `empty/loading/loaded/error` escopados por `src`; `<img>` nasce com `opacity: 0` e só aparece no `onLoad` — **nunca** exibir `alt` cru nem ícone de imagem quebrada. Variantes `compact` (só o anel, dimensionado pelo container) e `full` (selo adesivo com anel + "Carregando prévia..."). Spinner: borda 3 px preta com arcos amarelo/barro, `0.9s linear infinite` (`--duration-loading`), **`1.6s` com `prefers-reduced-motion`** (giro é feedback essencial; o restante do app respeita a regra global). Fundo creme com pontilhado barro, estático.
- **`HelpTip`**: balão `(?)` com `role="tooltip"`, `aria-describedby`, `aria-expanded`; abre em hover, foco e toque; fecha em `Escape`, `blur` e clique fora. Props: `tip`, `label` e `align` (`'center'` padrão, `'start'`, `'end'` — a seta acompanha o gatilho). Usado no título "Meus rascunhos" e nos modos de recorte de fundo.
- **`BackgroundMirrorToolbar`**: reusa `AlignToolbar.module.css`; dois `IconButton` com `active` no dock direito, contextual (Passo 1 + fundo + sem seleção).
- **Scrollbars**: `global.css` aplica `scrollbar-color: var(--c-amarelo-quente) var(--c-surface-muted)` e `scrollbar-width: thin` em `html`, mantém `::-webkit-scrollbar*` (inclusive `:active` e `-corner`) e `summary:focus-visible` no seletor de foco. `scrollbar-gutter: stable` permanece nos containers de rolagem. Em macOS com overlay scrollbars o sistema pode ignorar a estilização.
- **`Checkbox`** (`components/ui/`): checkbox do tema usado nos cartões de textura.
- **`ElementListRow`** (`components/ui/ElementListRow.tsx` + `.module.css`, **Leva 4**): componente único do log "Na folha" dos Passos 2 (Enfeites), 3 (Imagens) e 4 (Textos). Um `<button>` com `aria-label="Selecionar …"` e `aria-pressed` **ocupa a caixa retangular inteira** (`padding-right` reserva a lixeira); a lixeira é um `<span>` **irmão** posicionado à direita, então **excluir nunca seleciona**. Props: `label`, `selectLabel`, `removeLabel`, `selected`, `onSelect`, `onRemove`, `leading?` (miniatura via `PreviewImage`, usada só em Imagens), `bullet?` (ponto de lista personalizado — `true` em Enfeites/Textos, no lugar da numeração `"1. …"`; `false` em Imagens), `title?`. Fundo amarelo quando selecionado; `:focus-visible` verde. As listas usam `.elementList` (`StepPanel.module.css`); `ImageStep.module.css` não tem mais `.row*`/`.rowLabel`.
- **Passo 4 · Editar Texto** (`steps/TextStep.tsx`): os botões de criação são **`+ Título`**, **`+ Texto`** e **`+ Texto com borda`** — rótulos curtos, **sem detalhes entre parênteses** (a fonte e o efeito são aplicados pela interface, não precisam ser ensinados à usuária leiga). O terceiro é o estilo `highlight`, que nasce com o Efeito da Marca ligado. O antigo botão **"Efeito da Marca" saiu do painel**. O card usa `.editStack` (gap 16 px) para dar respiro vertical. **Leva 4**: os três botões ficam **lado a lado** em `.buttonGrid3` (3 colunas, `Button size="sm"` com `.addTextButton`: ícone em cima, nome embaixo, `white-space: normal`); **"Cor da Marca" virou "Cor do texto"** (rótulo em `ColorSwatches.tsx`); **"Cor do texto"** (swatches em 2 colunas) e **"Caixa de destaque"** (Nenhuma/Amarela/Barro empilhadas com `Segmented direction="column"`) ficam **lado a lado** em `.dualColumn` (2 colunas, gap 14 px) com **`align-items: stretch`** — `Segmented` ganhou a prop `className` e usa `.borderSection`/`.borderSegmented` (`flex: 1` + segmentos `flex: 1 1 0` com `min-height: 38px`), de modo que **cada caixinha tem a altura de um swatch** e os dois blocos ficam simétricos.
- **`Toast`** (`components/Toast.tsx`): balão de aviso com `role="alert"` usado por todas as telas. Tem **barra de tempo amarela** no topo (`.timer`, `scaleX` da esquerda para a direita) preenchendo durante `duration` (4 s; 8 s quando há ação). Ao completar, o balão **sempre esmaece em 1,2 s** (rAF, não CSS) e só então é dispensado. Passar o mouse durante o esmaecimento, antes de a opacidade chegar a 5%, **zera o esmaecimento** e segura o balão em 100% enquanto o ponteiro estiver em cima; ao sair, ele volta a esmaecer do zero. Hover durante a contagem **não** pausa a barra — só o esmaecimento é resgatável. O X e uma ação (`Desfazer`) continuam dispensando na hora.
- **Scrollbar fina e arredondada em todos os navegadores** (Leva 3): 6 px com pontas redondas; no Firefox, onde o CSS não arredonda a barra nativa, `FirefoxRoundScrollbar.tsx` desenha uma barra própria sobre os containers de rolagem.
- **Ajuda no contexto**: descrições longas viram balão, não texto permanente. Microcopy em PT-BR, calorosa, sem diminutivos nos títulos das etapas.
- **Títulos das etapas** (`steps/*`): cada painel abre com `.titleRow` — o `<h2>` da etapa e, **fixo na borda direita do painel**, um `HelpTip` (`aria-label="Sobre esta etapa"`, `align="end"`) com a descrição. **Não existe mais** o `<p>` de descrição abaixo do título. O balão abre em hover, foco e toque.
- **Passo 2 · Enfeites**: o card **"Opções de {enfeite}"** e o bloco **"Encaixar nos cantos"** foram **removidos** (o `placeDecoration` saiu do store junto). Posição, espelhar e excluir ficam só no dock direito e na lista "Na folha" (um caminho por ação); `DECORATION_ANCHORS` permanece em `brand.ts` como contrato de dados.

### 2.16 Testes e verificação

- `npm run typecheck` · `npm run test` (Vitest + jsdom, **161 testes** em 15 arquivos) · `npm run build` · `npm run e2e` (**79 passed / 3 skipped**, 82 testes em desktop + mobile — Leva 4).
- **Obrigatório rodar `npm run build` antes de `npm run e2e`**: `playwright.config.ts` serve `dist/` na porta 4173 via `npm run preview`. Sem rebuild, os e2e testam código velho.
- Suíte e2e: `flow`, `format`, `image`, `multiselect`, `rascunhos`, `momento-zero`, `regressoes` (regressões das levas 1 a 4, com 3 testes novos da Leva 4) + `helpers.ts`. `openCreateMenu()` / `createSingle()` / `pickCarousel()` / `createCarousel()` centralizam a criação pela home (o gatilho `+ Criar novo` é o mesmo no header e no quadro vazio); `CREATE_SINGLE = /Post único/` e `CREATE_CAROUSEL = /Carrossel/` casam o nome acessível do item de menu, que inclui a dica ("Post único Uma arte só"); `waitForHome()` é independente da contagem de rascunhos.
- **Contratos de seletor a preservar**: `Papel/Borda/Grain (Desligado|Ligado)`, "Corte vertical", "Topo"/"Centro"/"Base", "Slide 1 de 1" (duas ocorrências no carrossel), "Espelhar fundo ↔/↕" no fundo, "Espelhar horizontalmente"/"Espelhar verticalmente" só no dock (enfeites e imagens), `Sobre esta etapa` (o `(?)` de cada etapa), `create-draft-trigger` (home), `mode-dropdown-trigger`, `slide-badge`, `export-dropdown-trigger`, `canvas-busy-overlay`, "Trocar imagem" / "Remover fundo" / "Reverter fundo" no card da imagem, "+ Título" / "+ Texto" / "+ Texto com borda" no Passo 4 (sem parênteses), **"Cor do texto:"**, `Selecionar {elemento}` / `Remover` / `Remover imagem` no log "Na folha", `Renomear` no card da home. **Removidos na Leva 4**: "Restaurar padrão", "Cor da Marca", "Encaixar nos cantos" e "Centralizar na folha" (não devem voltar).

### 2.17 Feedback de carregamento (Leva 3)

Problema: trocar o fundo ou adicionar enfeite/foto/logo/textura demorava (assets WebP de até 1,2 MB + decode) **sem nenhum sinal** na tela. Regra: **toda ação que leva tempo para aparecer na folha precisa de feedback imediato, temático e que nunca bloqueia a interação.**

- **Selo sobre a folha** (`EditorCanvas.tsx` + `.canvasBusyOverlay*`): adesivo "caderninho" com spinner (mesma linguagem do `PreviewImage`) e microcopy da marca — `"Colando o fundo na folha... 🌽"`, `"Trocando o fundo... 🌽"`, `"Colando {enfeite}... ✨"`, `"Colando sua foto na folha... 📸"`, `"Carimbando a logo... 🏷️"`, `"Aplicando textura... ✨"`. Fundo e textura ganham também um véu leve sobre a folha. `pointer-events: none`, `aria-hidden`, `data-testid="canvas-busy-overlay"` (contrato de teste). **Só aparece se a espera passar de ~200 ms** (`useDelayedFlag`, `CANVAS_FEEDBACK_DELAY_MS`) e **some no instante** em que o item fica pronto — não há tempo mínimo de exibição. Se o asset já está em cache (hover/preload), nada é mostrado. Regra: o loading nunca é obrigatório, só aparece quando a espera é perceptível.
- **Fonte do estado** (`lib/useImage.ts`): `announceCanvasActivity(kind, label, targetSrc?)` + `useCanvasActivity()` (intenção da usuária; encerra quando `targetSrc` entra no cache/falha, ou quando a importação de foto termina; não mostra nada sozinha), `useLoadingImages()` (qualquer imagem do canvas em carregamento) e `beginImageImport`/`endImageImport` + `useImageImportBusy()` (pipeline de foto: decode → downscale → WebP → IndexedDB). `EditorCanvas` combina os três em `activeFeedback`. `useDelayedFlag` (`lib/useDelayedFlag.ts`) aplica o atraso de 200 ms ao selo e ao spinner da miniatura. Os steps (`Background/Decoration/Logo/Texture/ImageStep`) só chamam `announceCanvasActivity` no clique.
- **Miniaturas**: `ThumbGrid` mostra um spinner no selo da miniatura escolhida (também só após 200 ms) enquanto o asset em alta ainda carrega (`.checkBadgeLoading`/`.badgeSpinner`) e dispara `preloadImage(src)` em `onMouseEnter`/`onFocus`, de modo que o clique costuma achar o asset já decodificado.
- **Fotos do usuário**: `ImageStep`/`imageImport` chamam `await preloadImage(entry.url)` antes de `addImage`/`replaceImage`, evitando segundo "vazio" ao montar o `ImageNode`.
- **Carregamento sob demanda**: `TextureOverlays.tsx` e `TextNode.tsx` só chamam `useImage` para `papel-textura.webp`/`textura-borda.webp` quando a textura/borda está **ligada** — antes eram 2,2 MB decodificados no boot, competindo com a escolha do fundo.
- `EditorCanvas` inclui `loadingUrls.size` nas dependências do efeito que anexa o `Transformer`, para que o elemento recém-adicionado receba as alças assim que a imagem termina de carregar.

---

## 3. Estrutura do Repositório

```
post-generator/                  # Raiz com os assets originais (NÃO editar diretamente)
├── INICIAR-CUSCUZ.bat          # Launcher de 1 clique para a cliente
├── BACKGROUNDS PRESETS/        # Fundos estilizados
├── BACKGROUND PUROS/           # Fundos texturizados puros
├── BORDER/  ·  CORES/  ·  DETALHES DE BORDA/
├── ENFEITE/  ·  GRAFISMOS/  ·  JANELA/
├── LOGO/  ·  TYPOGRAPHY/  ·  TEXTURE/
└── insta-kit/                  # Aplicação Web (React + TS + Vite + Konva)
    ├── AGENTS.md               # Este manual — fonte de verdade do projeto
    ├── README.md               # Comandos + créditos do BiRefNet
    ├── package.json · vite.config.ts · tsconfig.json · playwright.config.ts
    ├── vercel.json · public/_headers   # Cache /assets (1 ano) e /brand (7 dias)
    ├── scripts/build-assets.mjs # Otimização lossless + DECOR_OVERRIDES + manifest
    ├── .kiro/specs/            # cuscuz-insta-kit/ e carousel-posts/ (com Revisão no topo)
    ├── tmp/                    # PLANO-UX.md
    ├── e2e/
    │   ├── helpers.ts          # openCreateMenu / createSingle / createCarousel / waitForHome / snapshots
    │   ├── flow.spec.ts · format.spec.ts · image.spec.ts · multiselect.spec.ts
    │   ├── rascunhos.spec.ts · momento-zero.spec.ts
    │   └── regressoes.spec.ts  # Regressões das levas 1 a 4
    ├── public/brand/           # Assets WebP gerados (+ thumbs/)
    └── src/
        ├── App.tsx · main.tsx · types.ts · assets.ts · assets-manifest.json
        ├── brand/brand.ts      # Cores, fontes, presets, POST_FORMATS, limites de fonte
        ├── theme/              # tokens.css (--duration-loading) e global.css (scrollbars)
        ├── store/              # editorStore (zundo) · carouselStore · draftsStore
        ├── screens/            # HomeScreen ("Meus rascunhos") · EditorScreen
        ├── lib/drafts/         # types · db · repository · content · migration · session · cover · backup
        ├── lib/                # align · textRules · multiSelect · imageRules/imageImport/userImages
        │                       # bgRemoval* · carouselGC · crossover · export/exportCarousel
        │                       # fonts · grain · shortcuts · storage · useImage · zoom
        ├── canvas/             # EditorCanvas · Nodes · hooks (useSlideThumb, useCanvasFitWidth…)
        ├── components/
        │   ├── Header · Stepper · StepFooter · Toast · ConfirmDialog · ModeDropdown · CreateDraftDropdown
        │   ├── ZoomControls · GuideToolbar · AlignToolbar · BackgroundMirrorToolbar
        │   ├── carousel/       # SlideTray · SlideThumb · SlidePickerDialog
        │   └── ui/             # Button · IconButton · Card · Slider · Segmented · Checkbox
        │                       # ColorSwatches · ThumbGrid · FormatGlyph · PreviewImage · HelpTip
        │                       # ElementListRow (Leva 4: log "Na folha")
        └── steps/              # BackgroundStep · DecorationStep · ImageStep
                                # TextStep · LogoStep · TextureStep
```

---

## 4. Comandos e Workflows

Para a cliente (sem linha de comando): basta **duplo clique em `INICIAR-CUSCUZ.bat`**, na raiz.
Ele checa o Node.js, instala dependências, gera os assets e sobe o `npm run dev` abrindo o
navegador automaticamente (procura uma porta livre entre 5173 e 5180).

Para desenvolvimento, os comandos são executados a partir do diretório `insta-kit/`:

```powershell
cd "insta-kit"

# 1. Pipeline de otimização de assets (lê as pastas da raiz e gera public/brand)
npm run assets

# 2. Executar em modo de desenvolvimento local
npm run dev

# 3. Executar testes de unidade e regras (Vitest)
npm run test

# 4. Checagem estrita de tipos TypeScript
npm run typecheck

# 5. Compilação para produção
npm run build

# 6. Testes end-to-end (Playwright) — SEMPRE depois de um build
npm run build
npm run e2e

# 7. Servidor de prévia do build de produção (porta 4173)
npm run preview
```

**Ordem obrigatória:** `npm run typecheck` → `npm run test` → `npm run build` → `npm run e2e`.
O `playwright.config.ts` sobe `npm run preview` servindo **`dist/`** na porta 4173 — sem
rebuild, os testes e2e rodam código velho. Ao alterar `DECOR_OVERRIDES` (labels dos
enfeites), rodar `npm run assets` **antes** do build e conferir que os `id`s e os hashes
dos WebPs não mudaram.

---

## 5. Diretrizes de Código e UI

- **Estética da UI**: "Caderninho de receitas nordestino", fofa, com sombras sólidas (`0 4px 0 #0b0500`), bordas de 3px, botões estilo adesivo com micro-interações de pressão.
- **Microcopy**: Tom caloroso, amigável e descontraído em Português do Brasil ("Bora!", "Prontinho!", "Enfeita aí!", "Opa!").
  **Sem diminutivos nos títulos das etapas**: "1. Escolha o fundo" (não "fundinho") — o mesmo vale para toasts que repetem a instrução ("Escolha um fundo primeiro").
- **Performance**: Manter o bundle leve (`manualChunks` para `react`/`konva`/`carousel`), imagens sempre em WebP, `loading="lazy"` nas prévias via `PreviewImage` e fontes pré-carregadas. O carregamento pesado de `@huggingface/transformers` continua sob demanda.
- **Arquivos grandes do usuário**: vão para o IndexedDB, nunca para o localStorage (o doc persistido
  carrega apenas metadados; ver seção 2.9). No undo, blobs não são revogados — a coleta de órfãos
  acontece no boot, junto da reconciliação do doc.
- **Deploy**: site estático hospedado na **Vercel**. O cache é definido em `vercel.json` e `public/_headers`
  (conteúdo duplicado — altere os dois juntos): `/assets/*` imutável (1 ano) e `/brand/*` com revalidação de 7 dias,
  pois os assets da marca podem ser regenerados pelo pipeline `npm run assets`.
- **Imutabilidade das pastas raiz**: Nunca modifique diretamente os arquivos nas pastas raiz de assets sem autorização expressa do usuário. Novos assets devem ser processados pelo script `npm run assets`.
- **Ids de asset são contrato de dados**: `assetId` fica gravado nos `Doc` persistidos. Renomear só o `label` (seção 2.7); nunca trocar `id`, `src`, `thumb`, `blend` ou `fullSheet` de um asset existente sem migração explícita.
- **Prévias de imagem**: sempre via `PreviewImage` (seção 2.15). Nunca `<img>` com `alt` visível durante o carregamento nem placeholder "Vazio" piscando.
- **Ajuda e revelação progressiva**: texto explicativo longo vai para `HelpTip` ou `<details>`; o painel mostra só o essencial da etapa. Balões e disclosures precisam funcionar por teclado e toque (`focus-visible`, `Escape`, `aria-expanded`).
- **Undo em uma ação só**: ao criar ações que mexem em vários campos (ex.: `enableAllFinishes`), usar **um único `set`** para gerar um único passo de undo; nunca encadear vários setters.
- **Autosave e seleção**: qualquer rotina que capture o canvas (capas, miniaturas) deve preservar `selectedIds`, `editingId` e **nunca restaurar `step`** — a usuária pode ter mudado de etapa durante a captura.
- **Seletores e2e são contrato**: `e2e/helpers.ts` centraliza os rótulos de criação que mudam com o estado da home. Ao renomear botões usados por specs, atualizar o helper e as asserções correspondentes; não "afrouxar" testes para passar.
- **Sem `any` / sem `as T` forçado**, sem placeholders, sem dependência nova quando a biblioteca padrão resolve; comentários só para regra de negócio, exceção de segurança ou decisão não óbvia.
