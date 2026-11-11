# Documento de Requisitos — Cuscuz Records Insta Kit

> **Leva 4 (11/11/2026) — o que prevalece**
> - **Passo 6 · Textura**: o botão **"Restaurar padrão"** e a action `resetFinish()` foram **removidos**; "Ativar todas"/"Desativar todas" são o único caminho para ligar/desligar os três acabamentos de uma vez (um único passo de undo, preservando opacidades/intensidade). Ver `AGENTS.md` §2.8.
> - **Log "Na folha"** (Passos 2, 3 e 4): passa a usar o componente único `components/ui/ElementListRow.tsx` — **a caixa retangular inteira é clicável** para selecionar (menos a lixeira, que é irmã do botão e só exclui); a numeração `"1. ..."` deu lugar a um **ponto de lista personalizado** em Enfeites e Textos; Imagens mantêm miniatura + nome, sem ponto. Ver `AGENTS.md` §2.10 e §2.15.
> - **Card de rascunho na home**: ao clicar no lápis `Renomear` **ou** no título, o ícone **desaparece** durante a edição e só volta quando o nome é confirmado (Enter/blur) ou cancelado (Escape). Ver `AGENTS.md` §2.14.
> - **Passo 4 · Editar Texto**: os três botões (`+ Título` / `+ Texto` / `+ Texto com borda`) ficam **lado a lado** em `.buttonGrid3` (ícone em cima, nome embaixo); **"Cor da Marca" virou "Cor do texto"**; `Caixa de destaque` usa `.dualColumn` com `align-items: stretch` + `Segmented className`, para cada opção ter a **altura de um swatch (38 px)** e os dois blocos ficarem simétricos. Ver `AGENTS.md` §2.15.
> - **Testes**: 161 unitários em 15 arquivos; e2e **79 passed / 3 skipped** (82 testes em desktop + mobile), com 3 novos testes de regressão da Leva 4 em `e2e/regressoes.spec.ts`.
> - **Pendência registrada**: o defeito "incrementar a tela antes de haver rascunhos" foi **descartado** nesta leva e será detalhado pelo Reni depois; nada foi alterado no boot/home por conta dele.
>
> **Revisão 10/11/2026 — release v3 "Meus rascunhos" + levas de correção 1, 2 e 3.**
> Este documento descreve a implementação de base. As seções abaixo seguem válidas como
> histórico, mas os pontos desta revisão **prevalecem** sobre elas. A fonte de verdade
> do projeto é `AGENTS.md` (na raiz de `insta-kit/`).
>
> **Leva 3 (10/11/2026) — o que prevalece**
> - **Header/Dock**: logo da Cuscuz e botão "Começar do zero" removidos do Header; selo de autosave ao lado do título; `ModeDropdown` vem **antes** de `Exportar`/`Exportação`; Desfazer/Refazer ficam na base do dock direito.
> - **Criação unificada na home**: os antigos pares de botões ("Carrossel" + "Post único" no header, "Criar carrossel" + "Criar post único" no quadro vazio) viraram **um único `+ Criar novo`** (`components/CreateDraftDropdown.tsx`, `data-testid="create-draft-trigger"`), que abre as mesmas duas opções do `ModeDropdown` do editor (mesmos ícones `Sparkles`/`Images` e dicas). O gatilho fica no header quando há rascunhos e no quadro central quando a lista está vazia (critério 2 do Requisito 13).
> - **Passo 4 · Editar Texto**: o botão de criação virou **"+ Texto com borda"** (era "Destaque (com efeito)"); o rótulo **"Borda de Destaque"** virou **"Caixa de destaque"**; o botão **"Efeito da Marca"** saiu do painel; "Cor da Marca" (2 colunas) e "Caixa de destaque" (opções empilhadas) ficam lado a lado, com mais respiro vertical no card (`.editStack`). Ver `AGENTS.md` §2.5 e §2.15.
> - **Estado vazio da home**: sem o parágrafo explicativo — só o título e o `+ Criar novo`.
> - **Passo 2 · Enfeites**: o card "Opções de {enfeite}" e o bloco "Encaixar nos cantos" **saíram** (e `placeDecoration` do store); posição/espelho/exclusão ficam no dock e na lista "Na folha".
> - **Títulos das etapas**: a descrição de cada aba virou um balão `(?)` **fixo na borda direita do painel** (`HelpTip`, `align="end"`); não existe mais o `<p>` abaixo do título.
> - **Renomear sem salto**: título editável como pílula creme (sem borda/outline, auto-dimensionada, máx. 80 caracteres, texto selecionado ao focar) no Header **e** no card da home (clique no título ou no lápis "Renomear"); o card ganhou o botão direto "Exportar".
> - **Seleção** de texto/realces em amarelo da marca (`--c-amarelo`); scrollbars finas e arredondadas em todos os navegadores (`FirefoxRoundScrollbar`).
> - **Logo**: presets de posição seguem `layoutGuides.margin` (ou 0 com guias/margens desativadas).
> - **Feedback de carregamento**: selo temático `canvas-busy-overlay` sobre a folha ao trocar fundo / adicionar enfeite, foto, logo ou textura **apenas se a espera passar de ~200 ms** (some assim que o item fica pronto; sem tempo mínimo), spinner na miniatura escolhida, `preloadImage` em hover/foco, pré-decode das fotos importadas e texturas globais carregadas **só quando ligadas**. Ver `AGENTS.md` §2.14 e §2.17.
> - **Textura (Leva 3)**: cada acabamento vira um cartão compacto sem texto explicativo, com checkbox do tema (``Checkbox``) no canto superior direito e liga/desliga ao clicar no cartão todo; os botões "Ligado/Desligado" saíram; "Ver prévia da textura" virou o botão "Prévia da textura", visível só no hover do cartão; "Ativar todas" vira "Desativar todas" (``disableAllFinishes()``, um único passo de undo). Ver ``AGENTS.md`` §2.8.
>
> **Mudanças de arquitetura que substituem o texto original**
> - A aplicação **não abre mais direto no editor**: a home **"Meus rascunhos"**
>   (`src/screens/HomeScreen.tsx`) é sempre a primeira tela; o editor só existe com um
>   rascunho ativo (`src/store/draftsStore.ts` → `screen: 'boot' | 'home' | 'editor'`).
> - Rascunhos (post único **e** carrossel) são persistidos em **IndexedDB** por
>   `src/lib/drafts/` (stores `drafts`, `documents`, `covers`, `meta`, `images`; schema v2),
>   com autosave debounced de 450 ms, `navigator.locks` por aba e `BroadcastChannel`.
>   **Não há mais `persist` do Zustand escrevendo `Doc`/`FinishState` no `localStorage`.**
>   As chaves legadas `cuscuz-insta-kit:rascunho` e `cuscuz-insta-kit:carrossel` são
>   migradas de forma idempotente e mantidas como rollback.
> - `useEditor` e `useCarousel` passam a ser estado de sessão em memória; o subscriber
>   em `src/main.tsx` sincroniza `doc`/`finish` do slide ativo com `useCarousel`.
> - Capas de rascunho: `src/lib/drafts/cover.ts` (`ensureCover`, `captureAndSaveCover`),
>   geradas no autosave, na saída do editor e em `pagehide`/`visibilitychange`.
> - **Numeração**: este documento usa etapas 0–5; a UI e o `AGENTS.md` usam 1–6
>   ("1. Escolha o fundo" … "6. Textura final"). São as mesmas seis etapas.
>
> **Critérios superados neste documento**
> | Critério | Situação atual |
> |---|---|
> | 1.9, 9.9, 11.4 (persistência em `localStorage`) | `DraftBody` no IndexedDB; ver Req. 12 |
> | 5.10, 5.11, 8.8 (`FONT_SIZE_MAX = 320` para todo texto) | Corpo `BODY_FONT_SIZE_MAX = 320`; título `HEADING_FONT_SIZE_MAX = 4000` (Leva 1) |
> | 11.5 (seletor de formato sempre no cabeçalho) | Seletor no painel do Passo 1, **apenas no post único**; carrossel é somente leitura (Leva 1) |
> | 2.1–2.3 (nomes provisórios dos enfeites) | 12 labels padronizados via `DECOR_OVERRIDES`; `id`s preservados (Leva 2) |
> | 7 (prévias de textura sempre visíveis) | Prévias em `<details>` + botão "Ativar todas" (Leva 2) |
>
> **Novos requisitos:** 12 (home/rascunhos/confiança) e 13 (ajustes de UX da Leva 2),
> ao final deste documento.

## Introdução

O **Cuscuz Records Insta Kit** é uma aplicação web estática (React 18 + TypeScript + Vite + Konva) que permite à gravadora independente **Cuscuz Records** criar posts para o feed do Instagram nos formatos Vertical 3:4, Horizontal 4:3 e Quadrado 1:1, mantendo 100% de consistência com a identidade visual da marca. A criação segue um fluxo linear de 6 etapas: Fundo → Enfeites → Imagens → Texto → Logo → Textura. Toda a lógica roda no navegador; nenhuma imagem do usuário é enviada a servidores externos.

---

## Glossário

- **Editor**: a aplicação web Cuscuz Records Insta Kit como um todo.
- **Folha**: a área de canvas representando o post a ser gerado, nas dimensões do formato ativo.
- **Formato**: uma das três proporções suportadas — Vertical (3:4 · 1080×1440 px), Horizontal (4:3 · 1440×1080 px) ou Quadrado (1:1 · 1080×1080 px).
- **Fundo**: camada base da Folha, composta por um preset de imagem de marca mais opções de espelhamento e deslize vertical.
- **Preset de Fundo**: um dos 10 assets pré-definidos (`bg-pronto-1..5` e `bg-puro-1..5`) gerados pelo pipeline `npm run assets` e servidos de `public/brand/`.
- **Enfeite**: elemento decorativo da pasta `ENFEITE/`, colocado sobre o Fundo nas etapas de composição.
- **Grafismo**: elemento decorativo da pasta `GRAFISMOS/`, com modo de mesclagem `divide`.
- **Moldura**: a janela retrô (`deco-janela`), disponível na Etapa 2 para emoldurar composições.
- **Elemento**: qualquer nó interativo na Folha — `DecorationEl`, `ImageEl`, `TextEl` ou `LogoEl` (definidos em `src/types.ts`).
- **Doc**: estrutura de dados serializada que representa o estado do post (`src/types.ts → Doc`).
- **Transformer**: componente Konva que envolve um ou mais nós selecionados para transformações interativas.
- **IndexedDB**: banco de dados do navegador (`cuscuz-insta-kit`, store `images`) onde ficam os blobs de imagens do usuário.
- **GC** (Garbage Collector de Órfãos): rotina que remove blobs do IndexedDB sem referência no Doc, executada no boot.
- **Efeito da Marca**: combinação de traçado creme 2 px externo + sombra projetada preta, conforme especificado em `src/brand/brand.ts → BRAND_EFFECT`.
- **Borda de Destaque**: borda retangular ao redor de um elemento de texto, nas variantes Amarela ou Barro, com textura `textura-borda` em `soft-light`.
- **Finish**: conjunto dos três acabamentos da Etapa 6 (papel amassado, Craquelado, granulado), representados em `src/types.ts → FinishState`.
- **Snap**: comportamento magnético que alinha o elemento arrastado a guias de layout ou ao centro da Folha.
- **Undo/Redo**: histórico de 50 passos com debounce de 400 ms, gerenciado pelo Zustand com zundo (`src/store/editorStore.ts`).
- **Paleta Oficial**: as seis cores da marca definidas em `src/brand/brand.ts → COLORS`: Preto `#0b0500`, Barro `#942911`, Amarelo `#f8ce2b`, Amarelo Quente `#f6c01f`, Verde Ceará `#698f3f`, Creme `#f7ebcd`.
- **Pipeline de Assets**: script `scripts/build-assets.mjs` que otimiza imagens de marca e gera `src/assets-manifest.json` e `public/brand/`.
- **BiRefNet_lite**: modelo de remoção de fundo (`studioludens/birefnet-lite-512`, fp16 ~94 MB, MIT) operado 100% no navegador via `@huggingface/transformers`.
- **Mulberry32**: PRNG com seed usado para geração determinística do granulado, garantindo identidade entre preview e exportação.

---

## Requisito 1 — Etapa 0: Fundo (`background-step`)

**User Story:** Como criadora de conteúdo da Cuscuz Records, quero escolher e personalizar o fundo do post para que a arte já parta com a identidade visual certa.

**Arquivos de implementação:** `src/steps/BackgroundStep.tsx`, `src/canvas/BackgroundNode.tsx`, `src/store/editorStore.ts`, `src/brand/brand.ts → POST_FORMATS`.

### Critérios de Aceitação

1. THE Editor SHALL exibir, na Etapa 0, uma galeria de 10 Presets de Fundo — 5 estilizados (`bg-pronto-1..5`) e 5 puros (`bg-puro-1..5`) — carregados a partir de `public/brand/` com miniaturas de `public/brand/thumbs/`.
2. WHEN o usuário seleciona um Preset de Fundo, THE Editor SHALL renderizar o Fundo cobrindo toda a Folha sem distorção, sem margens brancas e sem perda de qualidade.
3. WHILE o Formato ativo for Vertical (3:4), THE Editor SHALL renderizar o Fundo em orientação original, com largura igual a 1080 px e altura mínima de 1440 px.
4. WHILE o Formato ativo for Horizontal (4:3), THE Editor SHALL aplicar o Fundo rotacionado 90° pivotado no centro da Folha, preenchendo 1440×1080 px sem distorção.
5. WHILE o Formato ativo for Quadrado (1:1), THE Editor SHALL renderizar o Fundo com largura de 1080 px e recortar verticalmente o excesso de 360 px, respeitando o `backgroundOffsetY`.
6. WHILE o passo ativo for a Etapa 0 (`step === 0`), THE Editor SHALL permitir que o usuário deslize o Fundo verticalmente por arrasto direto na Folha, pelo controle deslizante, ou pelos botões rápidos "Topo", "Centro" e "Base".
7. WHEN o usuário muda para qualquer etapa diferente de 0 (`step !== 0`), THE Editor SHALL travar o Fundo contra qualquer deslocamento acidental, definindo `draggable={false}` e `listening={false}` no nó do fundo.
8. THE Editor SHALL oferecer botões de espelhamento horizontal (↔) e vertical (↕) que flipem o Fundo pivotado no centro da Folha, sem vazar margens.
9. THE Editor SHALL persistir `backgroundId`, `backgroundFlipX`, `backgroundFlipY` e `backgroundOffsetY` no `Doc` do `DraftBody` do rascunho ativo, gravado no IndexedDB (ver Revisão e Requisito 12).
10. IF nenhum Preset de Fundo estiver selecionado ao tentar avançar de etapa, THEN THE Editor SHALL exibir a notificação: "Escolha um fundo primeiro".

---

## Requisito 2 — Etapa 1: Enfeites e Grafismos (`decoration-step`)

**User Story:** Como criadora de conteúdo, quero adicionar enfeites e grafismos opcionais sobre o fundo para enriquecer a composição com elementos visuais da marca.

**Arquivos de implementação:** `src/steps/DecorationStep.tsx`, `src/canvas/DecorationNode.tsx`, `src/brand/brand.ts → DECORATION_ANCHORS`.

### Critérios de Aceitação

1. THE Editor SHALL disponibilizar, na Etapa 1, os seguintes Enfeites: `deco-flores`, `deco-folhas-1`, `deco-folhas-2`, `deco-ondas-1`, `deco-ondas-2`, `deco-grade` (blend mode `soft-light`) e `deco-sobrepor`.
2. THE Editor SHALL disponibilizar os seguintes Grafismos: `deco-chain`, `deco-esqueleto`, `deco-mp3player` e `deco-papel-divisao` (blend mode `divide`).
3. THE Editor SHALL disponibilizar a Moldura `deco-janela` como opção adicional na Etapa 1.
4. WHEN o usuário adiciona um Enfeite ou Grafismo, THE Editor SHALL inserir o elemento no Doc como `DecorationEl` e renderizá-lo na Folha com posicionamento inicial centrado.
5. ~~THE Editor SHALL suportar posicionamento rápido por canto (TL, TR, BL, BR)~~ **Removido (11/11/2026)**: os botões "Encaixar nos cantos" e "Centralizar na folha" saíram do painel (e `placeDecoration` do store). O posicionamento é feito arrastando na folha ou pelos alinhamentos do dock direito; `DECORATION_ANCHORS` permanece em `brand.ts` como contrato de dados.
6. THE Editor SHALL permitir que o usuário transforme cada Enfeite individualmente: arrasto livre pela Folha, redimensionamento proporcional, rotação, flip horizontal (↔) e flip vertical (↕).
7. THE Editor SHALL suportar ordenação de camadas por elemento: trazer para frente e enviar para trás.
8. THE Editor SHALL permitir que o usuário remova qualquer Enfeite ou Grafismo individualmente, com suporte a Undo/Redo.
9. THE Editor SHALL suportar a adição de múltiplos Enfeites do mesmo tipo na mesma Folha.
10. IF o usuário não adicionar nenhum Enfeite, THEN THE Editor SHALL permitir avançar para a próxima etapa sem mensagem de erro.

---

## Requisito 3 — Etapa 2: Imagens do Usuário (`image-step`)

**User Story:** Como criadora de conteúdo, quero inserir fotos do artista ou produto no post para personalizar a arte com imagens reais.

**Arquivos de implementação:** `src/steps/ImageStep.tsx`, `src/canvas/ImageNode.tsx`, `src/lib/imageImport.ts`, `src/lib/imageRules.ts`, `src/lib/userImages.ts`, `src/lib/imageRules.test.ts`.

### Critérios de Aceitação

1. THE Editor SHALL aceitar imagens nos formatos raster PNG, JPEG, WebP, GIF, AVIF e BMP via seletor de arquivo ou arrastar-e-soltar no painel lateral.
2. THE Editor SHALL aceitar imagens arrastadas diretamente para a Folha, inserindo o elemento no ponto onde o arquivo foi solto, nas coordenadas do espaço da Folha.
3. IF o arquivo submetido for SVG, THEN THE Editor SHALL recusar a imagem e exibir uma mensagem informando que SVG não é suportado.
4. IF o arquivo submetido exceder 25 MB (`IMAGE_MAX_FILE_BYTES`), THEN THE Editor SHALL recusar o arquivo e exibir uma mensagem de tamanho máximo excedido.
5. THE Editor SHALL processar cada imagem aceita através do pipeline: downscale para no máximo 3000 px no maior lado (`IMAGE_MAX_SIDE`), encoding para WebP qualidade 0,92 com fallback JPEG, e geração de miniatura de 320 px.
6. THE Editor SHALL armazenar o blob processado e a miniatura no IndexedDB (`cuscuz-insta-kit`, store `images`) e persistir apenas os metadados (`imageId`, dimensões, transformações) no `Doc` do `DraftBody` (store `documents` do mesmo banco).
7. THE Editor SHALL processar arquivos importados de forma sequencial (fila FIFO), nunca em paralelo.
8. WHILE o número de `ImageEl` no Doc for igual a `IMAGE_MAX_COUNT` (5), THE Editor SHALL bloquear qualquer nova importação e exibir o toast: "Limite de 5 imagens atingido".
9. THE Editor SHALL permitir as seguintes transformações em cada `ImageEl`: arrasto livre, redimensionamento proporcional, rotação, flip horizontal (↔), flip vertical (↕), Snap a guias, reordenação de camadas, duplicação e exclusão.
10. WHEN o usuário duplica um `ImageEl`, THE Editor SHALL verificar o limite de `IMAGE_MAX_COUNT` antes de criar a cópia, e bloquear com toast se o limite estiver atingido.
11. THE Editor SHALL executar a reconciliação do Doc com o IndexedDB no boot, removendo da lista de elementos quaisquer `ImageEl` cujo `imageId` não tenha registro no IndexedDB.
12. THE Editor SHALL executar o GC de órfãos no boot, apagando do IndexedDB todos os blobs sem referência em nenhum `imageId` ou `cutFrom` do Doc.
13. WHEN o usuário apaga um `ImageEl`, THE Editor SHALL manter o blob no IndexedDB durante a sessão para suportar Undo/Redo, sem revogá-lo imediatamente.

---

## Requisito 4 — Remoção de Fundo (`bg-removal`)

**User Story:** Como criadora de conteúdo, quero remover o fundo de uma foto no próprio navegador para destacar o artista ou produto sem precisar de software externo.

**Arquivos de implementação:** `src/steps/ImageStep.tsx`, `src/lib/bgRemoval.ts`, `src/lib/bgRemovalStatus.ts`, `src/lib/bgRemoval.test.ts`.

### Critérios de Aceitação

1. THE Editor SHALL oferecer, para cada `ImageEl` selecionado, um botão "Remover fundo" no card da imagem no painel lateral, e um ícone de tesoura na linha da lista de imagens.
2. THE Editor SHALL executar a remoção de fundo 100% no navegador usando o modelo BiRefNet_lite 512 via `@huggingface/transformers`, sem enviar a imagem a servidores externos.
3. THE Editor SHALL oferecer dois modos de remoção: **Pessoa** (alpha suave para cabelo + decontaminação de cor nas bordas) e **Objeto** (máscara firme com median, curva estreita e erosão), conforme os presets em `src/lib/bgRemoval.ts`.
4. WHEN o modelo BiRefNet_lite não estiver cacheado, THE Editor SHALL exibir aviso descritivo e barra de progresso real durante o download (~94 MB fp16), completar o download antes de iniciar a inferência, e manter o modelo cacheado para uso offline posterior.
5. WHEN a remoção de fundo estiver ativa, THE Editor SHALL transformar o botão "Remover fundo" em um quadro dentro do card da imagem selecionada; WHEN o usuário deselecionar a imagem com o quadro aberto, THE Editor SHALL mover o quadro para o topo do painel sem fechá-lo.
6. THE Editor SHALL fechar o quadro de remoção de fundo exclusivamente pelo botão "X"; clicar fora do quadro não o fecha.
7. WHILE o download ou a inferência estiverem em andamento, THE Editor SHALL desabilitar o botão "X" e exibir o botão "Cancelar".
8. WHEN o usuário clica em "Cancelar", THE Editor SHALL invalidar o fluxo de recorte corrente via época sem interromper o download do modelo em background.
9. THE Editor SHALL processar apenas uma inferência por vez; solicitações simultâneas não são permitidas.
10. WHEN a remoção de fundo é concluída com sucesso, THE Editor SHALL registrar a imagem recortada pelo pipeline `registerProcessedImage → IndexedDB → replaceImage`, preservando posição, rotação e escala do `ImageEl` original, e armazenar a referência à imagem anterior em `el.cutFrom`.
11. THE Editor SHALL codificar a imagem resultante em WebP com canal alpha; fallback em PNG. JPEG nunca deve ser usado para imagens com fundo removido.
12. WHEN `el.cutFrom` estiver definido, THE Editor SHALL exibir o botão "Reverter fundo", que substitui a imagem recortada pela original e limpa `el.cutFrom`, com suporte a Undo/Redo.
13. THE Editor SHALL lembrar o último modo de remoção utilizado (Pessoa ou Objeto) em `localStorage`.

---

## Requisito 5 — Etapa 3: Texto (`text-step`)

**User Story:** Como criadora de conteúdo, quero adicionar e estilizar textos no post com a tipografia e efeitos oficiais da marca para garantir consistência visual.

**Arquivos de implementação:** `src/steps/TextStep.tsx`, `src/canvas/TextNode.tsx`, `src/canvas/InlineTextEditor.tsx`, `src/lib/textRules.ts`, `src/lib/textRules.test.ts`, `src/brand/brand.ts → TEXT_PRESETS, BRAND_EFFECT, BORDERS`.

### Critérios de Aceitação

1. THE Editor SHALL disponibilizar três estilos de texto pré-configurados: **Título** (`Londrina Solid` peso 900, 120 px, maiúsculas, preto), **Texto com borda** (estilo `highlight`: `Londrina Solid` peso 900, 80 px, maiúsculas, preto, Efeito da Marca ativo) e **Texto** (`PT Sans Narrow` bold 700, 44 px, preto). O botão de criação do `highlight` na UI é **"+ Texto com borda"**; o painel **não** oferece mais o botão "Efeito da Marca" (o efeito fica sempre ligado nesse estilo).
2. THE Editor SHALL restringir a paleta de cores de texto às 6 cores oficiais da Paleta Oficial (`src/brand/brand.ts → COLORS`).
3. WHEN o Efeito da Marca estiver ativado, THE Editor SHALL renderizar o texto com traçado na cor Creme (`#f7ebcd`) de 2 px em posição externa e sombra projetada na cor Preta (`#0b0500`) com opacidade 46%, ângulo 90°, distância 11 px e desfoque 4 px, conforme `BRAND_EFFECT`.
4. THE Editor SHALL oferecer a Borda Amarela (`#f8ce2b`) com textura `textura-borda` em blend mode `soft-light` à opacidade 100%, e a Borda Barro (`#942911`) com a mesma textura em `soft-light` à opacidade 44%, conforme `BORDERS`. Na UI o grupo é rotulado **"Caixa de destaque"** e vive ao lado de "Cor da Marca" (2 colunas), com as três opções empilhadas.
5. WHILE houver pelo menos um `TextEl` do estilo `title` ou `highlight` no Doc, THE Editor SHALL impedir que qualquer `TextEl` do estilo `body` tenha `fontSize` maior que o menor `fontSize` dentre os elementos `title` e `highlight` presentes.
6. WHILE não houver nenhum `TextEl` do estilo `title` ou `highlight` no Doc, THE Editor SHALL limitar o `fontSize` de `TextEl` do estilo `body` a no máximo 72 px (`BODY_MAX_WITHOUT_HEADING`).
7. WHEN o usuário tenta aumentar o `fontSize` de um `TextEl` do estilo `body` acima do limite, THE Editor SHALL travar no valor máximo permitido e exibir a notificação: "Opa! O texto não pode ficar maior que o título 🙈".
8. THE Editor SHALL impedir que um `TextEl` do estilo `title` ou `highlight` seja reduzido abaixo do maior `fontSize` de qualquer `TextEl` do estilo `body` presente no Doc.
9. THE Editor SHALL suportar edição inline ao duplo clique no `TextEl` na Folha, exibindo o `InlineTextEditor` posicionado sobre o nó e respeitando a escala atual do canvas.
10. THE Editor SHALL oferecer controles de `fontSize` (16–320 px para corpo, 16–4000 px para títulos/destaques), `lineHeight`, `letterSpacing`, alinhamento horizontal (esquerda, centro, direita) e alternância de maiúsculas (uppercase).
11. THE Editor SHALL limitar `fontSize` por estilo em todos os cenários: corpo em `[FONT_SIZE_MIN, BODY_FONT_SIZE_MAX]` = [16, 320] px (e ainda ao menor título, ou 72 px sem título); títulos/destaques em `[FONT_SIZE_MIN, HEADING_FONT_SIZE_MAX]` = [16, 4000] px, sem poder ficar abaixo do maior corpo.

---

## Requisito 6 — Etapa 4: Logo (`logo-step`)

**User Story:** Como criadora de conteúdo, quero adicionar a logo da Cuscuz Records ao post com controle de tamanho e posicionamento para finalizar a identidade da arte.

**Arquivos de implementação:** `src/steps/LogoStep.tsx`, `src/canvas/LogoNode.tsx`, `src/brand/brand.ts → LOGO_SIZES, LOGO_MARGIN`.

### Critérios de Aceitação

1. THE Editor SHALL limitar a presença de logo a **1 `LogoEl` por post**; tentar adicionar uma segunda logo enquanto uma já existe deve ser ignorado.
2. THE Editor SHALL disponibilizar duas variantes de logo: **Com papel** (`logo-paper.webp`) e **Sem fundo** (`logo-clean.webp`).
3. WHEN o usuário troca a variante da logo, THE Editor SHALL manter a largura visual do `LogoEl` sem redimensioná-la.
4. THE Editor SHALL oferecer três tamanhos rápidos: **P** (200 px), **M** (320 px) e **G** (460 px), conforme `LOGO_SIZES`.
5. THE Editor SHALL oferecer 7 posições rápidas de encaixe para a logo: 4 cantos, 2 centros de borda (esquerda, direita) e centro da Folha, com margem de `LOGO_MARGIN` (56 px) a partir da borda da Folha.
6. THE Editor SHALL permitir as seguintes transformações na logo: arrasto livre, redimensionamento proporcional, rotação e reordenação de camadas.
7. IF o usuário remover a logo, THEN THE Editor SHALL permitir adicionar uma nova logo na mesma sessão.
8. IF o usuário não adicionar nenhuma logo, THEN THE Editor SHALL permitir exportar o post sem logo e sem mensagem de erro.

---

## Requisito 7 — Etapa 5: Textura (`texture-step`)

**User Story:** Como criadora de conteúdo, quero aplicar acabamentos texturais opcionais ao post para dar profundidade e acabamento artesanal à arte final.

**Arquivos de implementação:** `src/steps/TextureStep.tsx`, `src/canvas/TextureOverlays.tsx`, `src/lib/grain.ts`, `src/lib/grain.test.ts`, `src/brand/brand.ts → GRAIN_SEED, GRAIN_TILE_SIZE, PAPER_OPACITY_DEFAULT, BORDER_TEXTURE_OPACITY_DEFAULT, GRAIN_INTENSITY_DEFAULT, GRAIN_SIZES`.

### Critérios de Aceitação

1. THE Editor SHALL oferecer três acabamentos independentes na Etapa 5: **Papel amassado** (overlay de `papel-textura.webp`), **Craquelado** (overlay de `textura-borda.webp`) e **Granulado** (grão gaussiano gerado via Mulberry32).
2. THE Editor SHALL inicializar todos os três acabamentos desativados (`FINISH_ENABLED_DEFAULT = false`); nenhum acabamento deve ser ativado automaticamente ao criar ou carregar um post.
3. THE Editor SHALL permitir que o usuário ajuste a opacidade do Papel amassado no intervalo 0–100% (`PAPER_OPACITY_MIN`–`PAPER_OPACITY_MAX`), com valor padrão de 40% (`PAPER_OPACITY_DEFAULT`).
4. THE Editor SHALL permitir que o usuário ajuste a opacidade da Craquelado no intervalo 0–100% (`BORDER_TEXTURE_OPACITY_MIN`–`BORDER_TEXTURE_OPACITY_MAX`), com valor padrão de 40% (`BORDER_TEXTURE_OPACITY_DEFAULT`).
5. THE Editor SHALL permitir que o usuário ajuste a intensidade do Granulado no intervalo 0–100% (`GRAIN_INTENSITY_MIN`–`GRAIN_INTENSITY_MAX`), com valor padrão de 50% (`GRAIN_INTENSITY_DEFAULT`).
6. THE Editor SHALL disponibilizar três tamanhos de grão: **P** (fino, `patternScale` 0,5), **M** (médio, `patternScale` 1) e **G** (grosso, `patternScale` 2), com padrão **P** (`GRAIN_SIZE_DEFAULT`).
7. THE Editor SHALL gerar o Granulado com distribuição gaussiana usando o PRNG Mulberry32 inicializado com o seed fixo `GRAIN_SEED` (20261016) e desvio padrão `GRAIN_STDDEV` (30), garantindo que o grão seja **idêntico** no preview interativo e na exportação.
8. THE Editor SHALL renderizar os acabamentos ativos sobre toda a Folha na camada de sobreposição final, acima de todos os Elementos, via `src/canvas/TextureOverlays.tsx`.

---

## Requisito 8 — Seleção Múltipla (`multiselect`)

**User Story:** Como criadora de conteúdo, quero selecionar e transformar vários elementos ao mesmo tempo para agilizar o reposicionamento e alinhamento de grupos.

**Arquivos de implementação:** `src/lib/multiSelect.ts`, `src/lib/multiSelect.test.ts`, `src/canvas/EditorCanvas.tsx`.

### Critérios de Aceitação

1. THE Editor SHALL iniciar a seleção múltipla quando o usuário clicar em um Elemento na Folha enquanto mantém pressionada a tecla `Ctrl`, `Cmd` (macOS) ou `Shift`.
2. WHEN o usuário clica com modificador em um Elemento já selecionado, THE Editor SHALL remover esse Elemento da seleção múltipla.
3. WHEN o usuário clica em qualquer área vazia da Folha sem modificador, THE Editor SHALL limpar a seleção.
4. THE Editor SHALL usar um único Transformer do Konva para englobar todos os Elementos selecionados simultaneamente.
5. THE Editor SHALL permitir mover o conjunto selecionado com Snap calculado sobre a caixa de união (bounding box) de todos os Elementos selecionados.
6. THE Editor SHALL permitir redimensionamento proporcional (`keepRatio`) do conjunto selecionado, calculando a escala relativa de cada Elemento em relação à caixa de união do grupo.
7. THE Editor SHALL permitir rotação em torno do centro comum da caixa de união do grupo.
8. WHILE o redimensionamento em grupo estiver ativo e o limite `Texto ≤ Título` for atingido para algum `TextEl` do conjunto, THE Editor SHALL travar a escala no `boundBoxFunc` e exibir o toast de aviso correspondente.
9. THE Editor SHALL exibir a `AlignToolbar` com um indicador `N×` quando dois ou mais Elementos estiverem selecionados, onde `N` é o número de Elementos selecionados.
10. WHILE múltiplos Elementos estiverem selecionados, THE Editor SHALL disponibilizar as seguintes ações na `AlignToolbar`: alinhar à página (esquerda, centro H, direita, topo, centro V, base), trazer para frente, enviar para trás, duplicar e excluir.
11. WHEN o usuário aciona duplicar com múltiplos Elementos selecionados, THE Editor SHALL respeitar o limite `IMAGE_MAX_COUNT` para `ImageEl` e exibir toast de aviso se o limite for atingido; uma `LogoEl` duplicada deve ser ignorada com aviso.
12. THE Editor SHALL aplicar os atalhos `Delete` (excluir), `Ctrl+D` (duplicar) e teclas direcionais (mover 1 px ou 10 px com `Shift`) a todos os Elementos selecionados.

---

## Requisito 9 — Exportação e Undo/Redo (`export`)

**User Story:** Como criadora de conteúdo, quero exportar o post em alta resolução nas dimensões exatas do formato escolhido e desfazer/refazer ações enquanto edito, para ter controle total sobre a criação.

**Arquivos de implementação:** `src/lib/export.ts`, `src/lib/fonts.ts`, `src/lib/shortcuts.ts`, `src/store/editorStore.ts`.

### Critérios de Aceitação

1. THE Editor SHALL exportar a Folha com `pixelRatio` calculado para produzir exatamente as dimensões do Formato ativo: 1080×1440 px (3:4), 1440×1080 px (4:3) ou 1080×1080 px (1:1).
2. THE Editor SHALL garantir que todas as fontes (`Londrina Solid` e `PT Sans Narrow`) estejam completamente carregadas — via `src/lib/fonts.ts` — antes de iniciar a renderização de exportação.
3. THE Editor SHALL nomear o arquivo exportado com o padrão `cuscuz-post-YYYY-MM-DD-HHmm.png`, usando a data e hora locais do momento da exportação.
4. WHEN o dispositivo suportar a Web Share API e o formato for compatível, THE Editor SHALL acionar a Web Share API para compartilhamento nativo; em caso de não suporte ou recusa, THE Editor SHALL realizar o download tradicional do arquivo.
5. WHEN a exportação for concluída com sucesso, THE Editor SHALL exibir uma animação de confete comemorativo.
6. THE Editor SHALL excluir as Guias de Layout do canvas exportado; somente Fundo, Elementos e Acabamentos devem aparecer na imagem exportada.
7. THE Editor SHALL manter um histórico de Undo/Redo de 50 passos, com debounce de 400 ms para agrupar mudanças contínuas, gerenciado pelo zundo no `editorStore`.
8. THE Editor SHALL suportar os atalhos `Ctrl+Z` (Undo) e `Ctrl+Shift+Z` ou `Ctrl+Y` (Redo) para navegar pelo histórico.
9. THE Editor SHALL persistir o `Doc` e o `FinishState` (apenas metadados, sem blobs) dentro do `DraftBody` do rascunho ativo no IndexedDB, com autosave e recarregamento pelo `openDraft()` a partir da home "Meus rascunhos" (ver Requisito 12).
10. IF a reconciliação com o IndexedDB no boot remover `ImageEl` do Doc, THEN THE Editor SHALL registrar a remoção no histórico de forma que o estado carregado seja consistente desde o início da sessão.

---

## Requisito 10 — Guias de Layout (`layout-guides`)

**User Story:** Como criadora de conteúdo, quero ver guias de alinhamento estilo Photoshop na Folha para posicionar os elementos com precisão e consistência.

**Arquivos de implementação:** `src/canvas/LayoutGuides.tsx`, `src/canvas/SnapGuides.tsx`, `src/brand/brand.ts → GUIDE_MARGIN_DEFAULT, GUIDE_MARGIN_PRESETS, GUIDE_SNAP_THRESHOLD, GUIDE_COLORS`.

### Critérios de Aceitação

1. THE Editor SHALL exibir guias de layout sobrepostas à Folha compreendendo: linhas de margem, linhas de centro horizontal e vertical, e linhas de terços horizontais e verticais.
2. THE Editor SHALL colorir as guias conforme `GUIDE_COLORS`: margem em Barro (`#942911`), centro em Verde Ceará (`#698f3f`) e terços em Preto (`#0b0500`).
3. THE Editor SHALL inicializar a margem das guias com o valor padrão `GUIDE_MARGIN_DEFAULT` (56 px) e permitir ajuste no intervalo `[GUIDE_MARGIN_MIN, GUIDE_MARGIN_MAX]` = [0, 160] px.
4. THE Editor SHALL oferecer os presets rápidos de margem: 32 px, 56 px, 80 px e 100 px (`GUIDE_MARGIN_PRESETS`).
5. THE Editor SHALL aplicar Snap magnético (`GUIDE_SNAP_THRESHOLD` = 8 px) quando o centro ou as bordas do Elemento arrastado estiverem dentro de 8 px de qualquer guia ativa, incluindo margens, centro e terços.
6. THE Editor SHALL excluir todas as guias do canvas exportado; as guias são renderizadas exclusivamente no preview interativo.
7. THE Editor SHALL permitir que o usuário oculte ou exiba as guias independentemente das demais configurações do Editor.

---

## Requisito 11 — Formatos de Exportação e Troca de Formato (`post-format`)

**User Story:** Como criadora de conteúdo, quero alternar entre os formatos Vertical, Horizontal e Quadrado a qualquer momento para adaptar o mesmo post a diferentes enquadramentos do feed.

**Arquivos de implementação:** `src/brand/brand.ts → POST_FORMATS, getPostDimensions`, `src/store/editorStore.ts`, `src/types.ts → Doc`.

### Critérios de Aceitação

1. THE Editor SHALL suportar três Formatos: Vertical (3:4 · 1080×1440 px), Horizontal (4:3 · 1440×1080 px) e Quadrado (1:1 · 1080×1080 px), definidos em `POST_FORMATS`.
2. WHEN o usuário troca o Formato, THE Editor SHALL reajustar imediatamente as dimensões da Folha no canvas e atualizar o `pixelRatio` de exportação de acordo com as novas dimensões.
3. WHEN o Formato for alterado, THE Editor SHALL preservar o `backgroundId`, `backgroundFlipX`, `backgroundFlipY`, `backgroundOffsetY` e todos os `elements` do Doc sem reinicializá-los.
4. THE Editor SHALL persistir o Formato ativo no `Doc` do `DraftBody` no IndexedDB; no carrossel o formato também fica em `CarouselDraftBody.format` e `DraftMeta.format`.
5. THE Editor SHALL exibir o seletor de Formato no painel do Passo 1 **apenas no Modo Post Único**; no Modo Carrossel o formato é definido na criação, é somente leitura e o seletor não deve ser renderizado (informação visível no Header via `FormatGlyph`).

---

## Requisitos Não Funcionais

### Desempenho

- NF-1: THE Editor SHALL manter o bundle JavaScript inicial abaixo de 500 kB comprimido (gzip), usando lazy loading para painéis de etapas e splitting de módulos pesados (ex.: `@huggingface/transformers`).
- NF-2: THE Editor SHALL pré-carregar as fontes `Londrina Solid` e `PT Sans Narrow` via `@fontsource` para garantir renderização correta no primeiro frame e na exportação offline.
- NF-3: THE Editor SHALL servir todos os assets de marca em formato WebP lossless a partir de `public/brand/`, gerados pelo script `scripts/build-assets.mjs`.

### Privacidade e Segurança

- NF-4: THE Editor SHALL processar todas as imagens do usuário exclusivamente no navegador; nenhuma imagem, blob ou dado pessoal deve ser enviado a servidores externos em nenhuma circunstância.
- NF-5: THE Editor SHALL armazenar blobs de imagens exclusivamente no IndexedDB (store `images`); `Doc`, `FinishState` e `DraftMeta` também ficam no IndexedDB (stores `documents`/`drafts`). O `localStorage` guarda apenas preferências de UI e o modo de remoção de fundo — **nunca** binários, base64 de imagens nem o documento do post.

### Consistência Visual

- NF-6: THE Editor SHALL restringir todas as cores utilizáveis nos Elementos à Paleta Oficial de 6 cores (`src/brand/brand.ts → COLORS`); nenhuma cor fora da paleta deve ser exposta ao usuário.
- NF-7: THE Editor SHALL usar exclusivamente as fontes `Londrina Solid` (headlines) e `PT Sans Narrow` (corpo), ambas auto-hospedadas via `@fontsource`, sem dependência de serviços externos de fontes.

### Experiência do Usuário

- NF-8: THE Editor SHALL exibir mensagens de notificação (toasts) em tom caloroso e descontraído em Português do Brasil, sem diminutivos nos títulos de etapas.
- NF-9: THE Editor SHALL funcionar corretamente offline após o primeiro carregamento (incluindo o cache do modelo BiRefNet_lite), com exceção do download inicial do modelo.
- NF-10: THE Editor SHALL suportar Undo/Redo para todas as ações de criação, edição, movimentação, redimensionamento, rotação, exclusão e importação de Elementos.

### Deploy e Infraestrutura

- NF-11: THE Editor SHALL ser deployado como site estático na Vercel com as seguintes políticas de cache definidas em `vercel.json` e `public/_headers`: `/assets/*` imutável (1 ano, Cache-Control: `public, max-age=31536000, immutable`) e `/brand/*` com revalidação de 7 dias (`public, max-age=604800, stale-while-revalidate=86400`).

---

## Requisito 12 — Home "Meus rascunhos", persistência e confiança (`drafts`, Leva 1)

**User Story:** Como criadora de conteúdo, quero meus posts salvos com nome, capa e histórico, para nunca perder um trabalho ao recarregar a página.

**Arquivos:** `src/App.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/EditorScreen.tsx`, `src/store/draftsStore.ts`, `src/lib/drafts/*`, `src/components/Header.tsx`, `src/components/carousel/SlideTray.tsx`, `src/components/carousel/SlideThumb.tsx`, `src/components/ui/PreviewImage.tsx`, `src/lib/textRules.ts`, `src/lib/multiSelect.ts`, `src/steps/BackgroundStep.tsx`.

### Critérios de Aceitação

1. THE App SHALL iniciar sempre na home "Meus rascunhos" (`screen === 'home'` após `bootDrafts()`), exibindo lista de rascunhos, card "Continuar de onde parou", estado vazio orientante e ações de abrir/renomear/duplicar/excluir com "Desfazer".
2. THE App SHALL persistir cada rascunho em IndexedDB (`DraftMeta` + `DraftBody` + capa WebP), com `schemaVersion = 2`, `titleSource: 'auto' | 'user'`, `kind: 'single' | 'carousel'`, `slideCount` e `format`.
3. THE App SHALL salvar com autosave debounced de 450 ms, expor o status no Header ("Alterações…" / "Salvando…" / "Salvo" / "Não salvou") e oferecer "Tentar de novo" em caso de erro.
4. WHEN a página é recarregada dentro do editor, THEN THE App SHALL voltar para a home com todos os textos, cards e capas íntegros — nenhum placeholder pode escapar para o viewport (regressão do item 12 da lista de problemas).
5. THE App SHALL gerar a primeira capa no autosave (`ensureCover`) e renová-la na saída do editor e em `pagehide`/`visibilitychange`, sem roubar a seleção, a edição inline ou a etapa ativa do usuário.
6. WHILE o Modo Carrossel está ativo, THE App SHALL renderizar a `SlideTray` no primeiro frame (import estático, altura reservada), com botões desativados, `aria-busy` e feedback "Preparando as miniaturas..."; THE App SHALL liberar os botões quando a miniatura do slide ativo carregar **ou** após 1,5 s de segurança.
7. THE App SHALL exibir em toda prévia de imagem o `PreviewImage` com spinner temático (anel preto/amarelo/barro, `0.9s linear infinite`; `1.6s` com movimento reduzido), sem `alt` cru e sem placeholder "Vazio" piscando.
8. THE App SHALL permitir título/destaque até `HEADING_FONT_SIZE_MAX` (4000 px) mantendo `Texto ≤ Título`, o piso de 16 px e o teto de corpo de 320 px (`BODY_FONT_SIZE_MAX`).
9. WHILE o Modo Carrossel está ativo, THE App SHALL ocultar o seletor "Formato do post" do Passo 1 e exibir a informação do formato apenas como leitura no Header.
10. THE App SHALL oferecer backup em ZIP (`exportDraftsBackup`) e migração idempotente das chaves `localStorage` legadas, sem apagá-las (rollback).

---

## Requisito 13 — Ajustes de UX e identidade (`ux-polish`, Leva 2)

**User Story:** Como criadora de conteúdo, quero uma interface limpa, com nomes compreensíveis e controles onde eu espero encontrá-los, para criar sem dúvida.

**Arquivos:** `src/components/ui/HelpTip.tsx`, `src/components/BackgroundMirrorToolbar.tsx`, `src/screens/HomeScreen.tsx`, `src/components/Header.tsx`, `src/lib/drafts/session.ts`, `src/steps/TextureStep.tsx`, `src/store/editorStore.ts`, `src/theme/global.css`, `scripts/build-assets.mjs`, `src/assets-manifest.json`, `e2e/helpers.ts`.

### Critérios de Aceitação

1. THE App SHALL exibir o título "Meus rascunhos" sem descrição permanente; a explicação SHALL ficar no balão do `HelpTip` (`(?)`), acessível por hover, foco, toque e fechável por `Escape`/clique fora, com `role="tooltip"` e `aria-describedby`.
2. WHEN `drafts.length === 0 && listStatus === 'ready'`, THEN THE App SHALL exibir a criação **apenas** dentro do quadro de rascunhos (`+ Criar novo`, `CreateDraftDropdown`) e ocultar o equivalente do header; THE App SHALL manter "Baixar backup" e, em `listStatus !== 'ready'`, manter o gatilho do header como saída. O menu SHALL oferecer "Post único" e "Carrossel" com os mesmos ícones/dicas do `ModeDropdown` do editor.
3. THE App SHALL oferecer o espelhamento do fundo na `BackgroundMirrorToolbar` do dock direito, com `aria-label` "Espelhar fundo ↔" / "Espelhar fundo ↕" e estado `active`, visível quando `step === 0`, há fundo escolhido e nenhum elemento selecionado; THE App SHALL remover o card "Opções do Fundo" do painel, mantendo os controles de corte 1:1 ("Corte vertical", "Topo", "Centro", "Base") como bloco inline.
4. THE App SHALL permitir renomear o projeto clicando no `<h1>` do Header: o nome vira `<input aria-label="Nome do projeto">`; Enter/blur confirma, `Escape` cancela, e `renameActiveDraft()` SHALL atualizar `activeMeta` com `titleSource: 'user'`, gravar `saveDraftRecord` e transmitir `drafts-changed` (o autosave não pode sobrescrever o nome).
5. THE App SHALL oferecer "Ativar todas" na Etapa 6 via `enableAllFinishes()` — um único `set`, um único passo de undo, preservando opacidades/intensidade — e SHALL desabilitá-lo quando os três acabamentos já estiverem ligados.
6. THE App SHALL manter as prévias de papel amassado e Craquelado fechadas por padrão em `<details>/<summary>` ("Ver prévia da textura"), montando o `PreviewImage` somente quando abertas; `summary:focus-visible` SHALL receber o outline verde.
7. THE App SHALL aplicar `scrollbar-color: var(--c-amarelo-quente) var(--c-surface-muted)` e `scrollbar-width: thin` em `html`, mantendo as regras `::-webkit-scrollbar*` (inclusive `:active` e `-corner`) e `scrollbar-gutter: stable` nos containers de rolagem.
8. THE App SHALL usar os 12 labels padronizados dos enfeites em Title Case (ex.: "Arabesco floral", "Faixa de espinhos", "Tocador retrô", "Janela retrô"), definidos em `DECOR_OVERRIDES`; THE App SHALL **preservar todos os `id`s**, pois estão gravados nos `Doc` dos rascunhos e `sanitize()` descarta enfeites com `id` desconhecido.
9. THE App SHALL manter `e2e/helpers.ts` com `openCreateMenu()` / `createSingle()` / `pickCarousel()` / `createCarousel()` sobre o gatilho `+ Criar novo` (`create-draft-trigger`) e `waitForHome()` independente do estado da lista, garantindo que nenhuma spec quebre com a mudança do item 2.
10. THE App SHALL manter a suíte de regressão em `e2e/regressoes.spec.ts` cobrindo reload após conversão para carrossel, tira no primeiro frame, formato somente no post único, balão `(?)`, o gatilho `+ Criar novo` no header e no quadro vazio, espelhamento no dock, rename inline, dropdown de prévias, "Ativar todas" com undo e `scrollbar-color`.
