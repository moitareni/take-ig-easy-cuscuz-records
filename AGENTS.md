# Diretrizes para Agentes de IA — Cuscuz Records Insta Kit

Este documento estabelece o contexto do negócio, regras inquebráveis de identidade visual, arquitetura de software e convenções para quaisquer agentes ou desenvolvedores que trabalhem neste repositório.

---

## 1. Contexto do Projeto

O **Cuscuz Records Insta Kit** é uma aplicação web estática criada sob medida para a gravadora independente **Cuscuz Records**.
O objetivo é permitir que o cliente crie de forma prática, rápida e intuitiva posts para o feed do Instagram nos formatos **Vertical 3:4 (1080×1440)** (padrão), **Horizontal 4:3 (1440×1080)** e **Quadrado 1:1 (1080×1080)**, mantendo 100% de consistência com a identidade visual da marca. Também é possível criar **carrosséis** de até 10 slides, exportados em ZIP.

> **Estado atual — release v2.0.0 "Leva 5: qualidade, acessibilidade e sincronização" (17/11/2026).**
> A aplicação é 100% estática, sem back-end, e **abre sempre na home "Meus rascunhos"**
> (`src/screens/HomeScreen.tsx`); o editor só existe com um rascunho ativo. Todos os
> posts — únicos ou carrosséis — são rascunhos persistidos em **IndexedDB**
> (`src/lib/drafts/`, schema v2) com autosave, capa WebP, backup em ZIP e bloqueio por
> aba. `useEditor` e `useCarousel` são stores de sessão **em memória** (não usam mais
> `persist`/`localStorage`); as chaves antigas `cuscuz-insta-kit:rascunho` e
> `cuscuz-insta-kit:carrossel` são apenas migradas e mantidas como rollback. As specs
> em `.kiro/specs/` registram a implementação de base e trazem, no topo de cada
> arquivo, uma **Revisão** com o que prevalece. **Este `AGENTS.md` é a fonte de verdade.**
> A **Leva 5** executa, em grande parte, o plano de melhorias de
> `tmp/RELATORIO-QUALIDADE.md` (13/11/2026): ponte de sincronização isolada
> (`syncEngine`), checkpoint síncrono antes de descarregar a página, memoização dos
> nós do canvas, gerenciamento de foco nos diálogos, renomeação e reordenação por
> teclado, colagem de imagem por Ctrl+V, correção de contraste e consolidação dos
> sanitizadores. Ver §§2.4, 2.9, 2.10, 2.12–2.16 e as novas seções 2.20–2.22.
>
> **Auditoria de consistência (12/11/2026) e revisão da Leva 5 (17/11/2026).** As specs
> em `.kiro/specs/` foram conciliadas com o código e os testes. A correção de
> integridade do carrossel (posse explícita de crossover, gravação do slide pelo `id`,
> reordenação estritamente posicional, prévias vivas e proteção da logo própria) continua
> vigente. As regras detalhadas em §2.13 prevalecem sobre qualquer mecanismo histórico
> citado nas specs (por exemplo, cache/captura de miniatura, `ModeSelector`,
> `useSlideThumb` ou persistência do store em `localStorage`). A revisão de 17/11
> prevalece sobre as auditorias de 12/11 em todos os arquivos de spec.

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
- **Traçado**: cor `#f7ebcd` (Creme) por padrão, largura visível de `2px`, posição externa.
- **Sombra projetada**: cor `#0b0500` (Preto), opacidade `46%`, ângulo de 90° (direção vertical para baixo), distância `11px`, desfoque `4px`.
- Implementado em Canvas sobrepondo a camada preenchida sobre a camada contornada com sombra, preservando os cantos internos da tipografia.
- **Cor do traçado configurável (Leva 5)**: o campo opcional `TextEl.brandEffectColor` (`BrandColor`) escolhe a cor do traçado entre `TEXT_BORDER_COLORS` (`preto`, `barro`, `amarelo`, `verde`, `creme`), resolvida por `getBrandEffectStrokeColor()` (`src/brand/brand.ts`); ausente ou inválida → Creme. A mesma cor é aplicada no canvas (`TextNode`, `CrossoverMirrorNode`) e no `<textarea>` in-place (`textEditorStyle.ts`, via `WebkitTextStroke`). Na UI é o swatch **"Cor da borda:"** do Passo 4.

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
- **Logo é opcional**: só aparece se o usuário decidir adicionar. Apenas uma logo é permitida por post, podendo alternar entre "Com papel" e "Sem fundo". Os presets de posição da logo (`tl`, `tr`, `bl`, `br`, `tc`, `bc`) seguem dinamicamente a margem ativa das guias de layout (`layoutGuides.margin`, ex.: 32, 56, 80, 100); quando as guias estão ocultas (`visible = false`) ou a guia de margens está desativada (`showMargins = false`), a margem efetiva é `0` (a logo cola na borda da folha). **Leva 5**: a seção **"Posições Rápidas"** saiu do `LogoStep.tsx` — o posicionamento passa a ser feito pelo dock (`Alinhar à...`) ou pela action `placeLogo(preset)` do store, que permanece como API e contrato de teste; os botões P/M/G continuam no painel.
- **Nomes padronizados dos enfeites** (Leva 2): os 12 `label`s são definidos em `DECOR_OVERRIDES` (`scripts/build-assets.mjs`) e gravados em `src/assets-manifest.json`. Todos em Title Case, sem CAIXA ALTA e sem sufixo numérico nu: `Arabesco floral`, `Folhagem rendada`, `Vinha vertical`, `Onda de canto`, `Traço ondulado`, `Trama amarela`, `Xadrez amarelo`, `Faixa de espinhos`, `Esqueleto solar`, `Tocador retrô`, `Fita de papel verde`, `Janela retrô`.
  - **REGRA INEGOCIÁVEL:** os **`id`s são imutáveis** (`flores`, `folhas-1`, `folhas-2`, `ondas-1`, `ondas-2`, `grade`, `sobrepor`, `chain`, `esqueleto`, `mp3player`, `papel-divisao`, `janela`). Estão gravados nos `Doc` dos rascunhos; `sanitize()` descarta qualquer enfeite com `id` desconhecido. Só o `label` pode mudar. `DECORATION_ANCHORS` (`brand.ts`) é chaveado por `id` e permanece intacto. Rodar `npm run assets` após alterar o mapa; conferir que nenhum WebP mudou de hash.

### 2.8 Textura Final (opcional, desligada por padrão)
- Etapa **6. Textura** com três acabamentos independentes:
  - **Papel amassado**: overlay da textura `TEXTURE/` (`public/brand/papel-textura.webp`) sobre a folha, com opacidade regulável (sugestão: 50%).
  - **Craquelado**: overlay da textura `BORDER/TEXTURA-BORDA.png` (`public/brand/textura-borda.webp`) sobre a folha, com opacidade regulável (sugestão: 10%).
  - **Granulado**: grão monocromático com distribuição gaussiana, gerado por RNG **com seed** (`mulberry32`) para o grão ficar **idêntico no preview e no export** (sugestão: M 60%).
- Todos vêm com checagem desligada; nunca devem ser aplicados automaticamente na criação de um post (`FINISH_ENABLED_DEFAULT = false`). Isso continua valendo com o botão **"Ativar todas as texturas"** — ele é uma ação **explícita** da usuária.
- **"Ativar todas as texturas"** (Leva 2): `enableAllFinishes()` em `editorStore.ts` liga os três em **um único `set`** (= um único passo de undo), preservando opacidades/intensidade; quando os três já estão ligados o **mesmo botão vira "Desativar todas as texturas"** (Leva 3), que chama `disableAllFinishes()` — também um único `set`/passo de undo, preservando os valores. **Leva 4**: o botão **"Restaurar padrão"** e a action `resetFinish()` foram **removidos** (não havia mais ponto de entrada e zera valores que "Desativar todas as texturas" preserva); hoje esses dois botões são o **único** caminho para ligar/desligar os três de uma vez. No **Modo Carrossel**, ao lado dele (`.togglePair`, secundário à esquerda e primário à direita), aparece o toggle **"Aplicar em todos os slides"** (`applyFinishToAll` em `carouselStore.ts`, padrão `true`, com o indicador `✓` e `aria-pressed`): quando ativo, copia as texturas do slide atual para todos os slides, propaga mudanças/novos slides e persiste no `CarouselDraftBody`; quando desligado, para de propagar futuras alterações sem apagar as texturas que os outros slides já possuem.
- **Cartões compactos de acabamento** (Leva 3, `TextureStep.tsx` + `TextureStep.module.css`): cada acabamento (Papel amassado, Craquelado, Granulado) é um cartão **sem texto explicativo**, com o nome e um **checkbox do tema** (`components/ui/Checkbox.tsx`, quadrado "adesivo" amarelo quando marcado, `<input type="checkbox">` real) no canto superior direito. **Clicar em qualquer parte do cartão liga/desliga**; a área de ajustes (sliders, tamanho do grão) e o botão de prévia não alternam (`stopPropagation`). Opacidade/intensidade mantêm o comportamento (mexer no controle liga o acabamento). Os botões "Ligado/Desligado" foram removidos.
- **Prévia da textura** (Leva 3): botão "Prévia da textura" (não mais `<details>`) no cabeçalho do cartão de papel e de borda; fica **invisível (`opacity: 0`) e só aparece no hover do cartão**, no foco do teclado, quando aberto e sempre em telas de toque (`@media (hover: none)`). O `PreviewImage` só é montado quando aberto. Granulado não tem imagem, logo não tem botão.
- **Contrato de teste**: checkboxes com nome acessível `Papel amassado`, `Craquelado`, `Granulado`; botões `Ativar todas as texturas` / `Desativar todas as texturas` e `Aplicar em todos os slides` (no carrossel); `Prévia da textura` — `e2e/flow.spec.ts` e `e2e/regressoes.spec.ts` dependem deles. (Os antigos rótulos `Papel (Desligado|Ligado)` etc. não existem mais.)

### 2.9 Imagens do Usuário (etapa 3, opcional)
- **Limite total: até `IMAGE_MAX_COUNT` (5) imagens por post**, contando duplicatas; a 6ª é bloqueada com toast amigável.
- Entrada por seletor de arquivos, **arrastar e soltar** no painel e direto **na folha** (a imagem nasce no ponto do drop, posicionada nas coordenadas da folha ativa) e, desde a Leva 5, **Ctrl/Cmd+V** (`usePasteImage()` em `EditorScreen.tsx` + `src/lib/clipboardImages.ts`): lê `ClipboardItem`s de imagem (ignora texto/HTML/PDF), renomeia `image.png` genérico para **`Imagem colada.png`** (`jpeg` → `jpg`), preserva nomes reais, passa pelo mesmo pipeline (`importImageFiles`), seleciona a última imagem nova e abre automaticamente o **Passo 3 ("3. Sua imagem")**. Não cola nada dentro de `INPUT`/`TEXTAREA`/`contentEditable`, com texto em edição (`editingId`) ou com diálogo modal aberto; `preventDefault()` só quando há imagem. Contrato de teste: `e2e/image.spec.ts`, `button[title="Imagem colada"]`.
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
  (`studioludens/birefnet-lite-512`, fp16 ≈ 94MB, MIT) via `@huggingface/transformers`.
  Download **único** na primeira utilização, com aviso e barra de progresso reais; depois
  fica cacheado e funciona offline. Créditos no `README.md`.
- **Seleção de backend e resiliência (Leva 5)**: `bgUsesWebGPU()` desliga WebGPU no Firefox
  (`isFirefoxBrowser()`) e quando `preferWasm` foi ativado. `probeWebGPUFp16()` chama
  `navigator.gpu.requestAdapter()` e exige `shader-f16` **antes** do download — evita baixar
  fp16 à toa em adaptador sem suporte. Se o carregamento **ou a inferência** falharem em
  WebGPU, `preferWasm = true` para o restante da sessão: `resetBgModel()` descarta a sessão,
  recarrega em `wasm`/`fp32` e `inferMatte()` tenta **uma** vez mais. `runInference()` libera
  tensores de entrada/saída em `finally` (`disposeTensor`) e rejeita máscara com `NaN`
  (`bg-inference`). O `ImageStep` registra `console.error('[bgRemoval] …')` no catch; o toast
  amigável permanece. Contrato de teste: `src/lib/bgRemoval.test.ts` (`bgUsesWebGPU`).
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
- **Persistência** (`src/lib/drafts/`): banco IndexedDB `cuscuz-insta-kit` com stores `drafts` (`DraftMeta`), `documents` (`DraftBody`), `covers` (blob WebP), `meta` (marcador de migração) e `images`. `DRAFT_SCHEMA_VERSION = 2`. `DraftBody` é `SingleDraftBody { doc, finish }` ou `CarouselDraftBody { slides, activeSlideIndex, format, applyFinishToAll }` (a flag, padrão `true`, passou a ser persistida na Leva 5). `DraftMeta` traz `title`, `titleSource: 'auto' | 'user'`, `kind`, `format`, `slideCount`, datas.
- **Autosave** (`session.ts`): `markDraftDirty()` → `scheduleSave()` (**200 ms** desde a Leva 5; antes 450 ms) → `persistIfDirty()` → `saveDraftRecord()` (transação nos dois stores) → `updateActiveMeta` + `setSaveState('saved')` + `broadcastDraftsChanged()` + agendamento de capa. `SAVE_DEBOUNCE_MS = 200`; `COVER_REFRESH_DEBOUNCE_MS = 1200` recaptura a capa 1,2 s após a edição, fora da cadeia de save (pula se exportando ou com texto em edição). `flushSession({fromBlur?})` roda em `visibilitychange`, `pagehide`, `beforeunload` e **`window.blur`** (novo), todos com `.catch(() => undefined)` e com `try/catch` no corpo. Uma única `saveChain` serializa os saves; `navigator.locks` impede duas abas editando o mesmo rascunho; `BroadcastChannel('cuscuz-insta-kit:drafts')` mantém a home sincronizada. `changeRevision`/`latestSavedRevision` evitam exibir `Salvo` quando houve edição durante o save (volta para `Alterações...` e agenda outro); `activeSaves`/`savingInFlight` controlam saves em voo.
- **Estado da sessão (Leva 5)**: as nove variáveis soltas de `session.ts` foram consolidadas num único objeto `DraftSessionState` em `globalThis.__cuscuzDraftSession` (`getSession()`; 17 campos: `activeId`, `activeMeta`, `isNewDraft`, `dirty`, `coverDirty`, `changeRevision`, `latestSavedRevision`, `activeSaves`, `installed`, `saveTimer`, `coverTimer`, `saveChain`, `savingInFlight`, `channel`, `releaseLockFn`, `lockedDraftId`, `disposeSubscribers`). `ensureActiveSessionRecovered()` reconstrói a sessão após HMR se a UI estiver em `editor` e o estado tiver se perdido; `resetDraftSessionForTests()` expõe reset para testes. `installDraftSession()` devolve `dispose` e reinstala sob `import.meta.hot`.
- **Checkpoint síncrono contra perda no unload (Leva 5)**: `PENDING_CHECKPOINT_KEY = 'cuscuz-insta-kit:pending-checkpoint'` no `localStorage` guarda `{ meta, body, savedAt }` — o `DraftBody` completo **sem blobs/base64**, só metadados de imagem. É escrito **antes** de `saveDraftRecord()` em `persistIfDirty`/`renameActiveDraft` e em todo unload (`snapshotOnPageExitSync()`), e drenado em `bootDrafts()` (logo após `migrateLegacyDrafts`) e `openDraft()` por `flushPendingCheckpointToDb()` (sanitiza, só sobrescreve se `meta.updatedAt >= existing`, limpa a chave no sucesso e a mantém na falha). `getStorageSafe()` e `getOpenEditorDbSync()` abrem transação no mesmo tick do unload; `saveDraftRecord` só engole `InvalidStateError`. O checkpoint é limpo em close/delete/rename feito na home. **Exceção documentada à regra "localStorage nunca guarda o documento"**: aqui ele guarda uma cópia de sobrevivência para `beforeunload`, sem binários; se a cota falhar, o save no IndexedDB segue normalmente.
- **Slides e textura no carrossel (Leva 5)**: `buildBody()` persiste `CarouselDraftBody.applyFinishToAll` (default `true`); `applyBodyToStores()` usa `safeIndex`, aplica o `finish` do slide ativo a todos quando a flag está ligada e carrega via `loadSlideIntoEditor`. `openDraft()` atualiza `lastOpenedAt` (`touchOpened`) para o card "Continuar de onde parou"; `createDraft()` já nasce com `lastOpenedAt: now`. `syncEditorToCarouselIfNeeded()` roda antes de persistir para evitar snapshot com `doc` mais novo que o do carrossel.
- **Capas** (`cover.ts`): `captureAndSaveCover()` e `ensureCover()` (primeira capa). O provedor em `EditorScreen.tsx` esconde Transformer/guias para capturar e **restaura seleção, edição e guias sem tocar em `step`**. Desde a Leva 5, as guias são escondidas **direto no Konva** (`Group name="editor-guides-group"`) e restauradas no `finally`; o store só é tocado quando há texto em edição (`needsReactHide`). O throttle de 5 s de `lastCapturedDraftId` é **por rascunho**, não global. `useDraftCovers` converte blobs em object URLs e os revoga na troca de lista.
- **Home**: card "Continuar de onde parou" (último aberto), grade com capa/selo/título/ações, estado vazio com **só o título e o `+ Criar novo`** (sem parágrafo explicativo), renomear/duplicar/excluir com "Desfazer", "Baixar backup" (ZIP) e aviso de cota. A criação fica num **único botão `+ Criar novo`** (`components/CreateDraftDropdown.tsx`, `data-testid="create-draft-trigger"`), com as duas opções do `ModeDropdown` do editor ("Post único" / "Carrossel", mesmos ícones `Sparkles`/`Images` e as mesmas dicas). **Com rascunhos**, o `+ Criar novo` **saiu do header** e vira um bloco adesivo **do mesmo tamanho do card "Continuar de onde parou", à esquerda dele** (`.startRow` + `.createTile` em `HomeScreen.module.css`, `CreateDraftDropdown block`); **sem rascunhos**, fica **somente no quadro central**. O header só mantém o gatilho enquanto a lista não está pronta (`showHeaderCreate = drafts.length === 0 && listStatus !== 'ready'`), para nunca faltar caminho de criação. O título da seção tem o balão `HelpTip` (`(?)`) em vez de descrição permanente.
- **Migração**: `migrateLegacyDrafts()` lê as chaves `localStorage` antigas, copia o JSON cru para `meta` (rollback) e grava os registros; é idempotente e **nunca apaga** as chaves legadas nesta versão.
- **Reconciliação/GC**: união dos `imageId`s de todos os rascunhos e slides; `reconcileBodyImages` remove elementos fantasmas e `collectGarbageImages` apaga blobs órfãos. A Leva 5 acrescentou `cleanupOrphanDraftIds()` em `getAllDraftRecords()`: apaga em `drafts`/`documents`/`covers` tanto metas sem corpo quanto corpos sem meta (transação única). `duplicateDraftRecord()` agora cria `slideIdMap`, remapeia `crossFrom` para os novos ids de slide e roda `normalizeCrossoverOwnership()` antes de gravar a cópia — duplicar carrossel não deixa crossover apontando para o rascunho original.
- **Pendência registrada (11/11/2026, fora da Leva 4)**: o item "incrementar a tela antes de haver rascunhos" foi **descartado** a pedido do Reni e será detalhado em outra oportunidade. Nenhuma alteração de boot/home foi feita por conta dele: `screen === 'boot'` segue com o `<div>` de 100vh em `App.tsx` e `showHeaderCreate` segue como está. Não antecipar uma interpretação sem o detalhamento.

### 2.13 Modo Carrossel

- **Dois modos**: `single` e `carousel` (`useCarousel.mode`), alternados pelo `ModeDropdown` do Header. Post único → Carrossel pede confirmação ("Trocar pra Carrossel?"); Carrossel → Post único usa `SlidePickerDialog` (escolher slide ou "Começar do zero") com toast "Desfazer". **A conversão preserva o `activeDraftId`** — não cria nem descarta rascunho.
- **Formato**: escolhido no diálogo de criação na home e **fixo** depois disso (`carouselStore.format`). `setFormat` do editor é ignorado no carrossel pelo subscriber; o Passo 1 não mostra o seletor.
- **Slides**: `SlideData { id, doc, finish }`, até `CAROUSEL_MAX_SLIDES = 10`. `finish` é **por slide** — a menos que `applyFinishToAll` esteja ligado (padrão `true`, ver §2.8) —; `loadSlideIntoEditor` zera etapa/seleção/histórico e **`installEditorCarouselSync()`** (`src/store/syncEngine.ts`, chamado em `main.tsx`) grava `doc`/`finish` de volta com `updateActiveSlide`. Elementos **crossover** vazam entre slides adjacentes (ver `.kiro/specs/carousel-posts/`). `addSlide()` limpa `crossover` residual à direita do antigo último slide (`canElementBleedToSide(el, 'left', postW)`), herda o `finish` ativo quando `applyFinishToAll` e usa a mensagem de limite **"Máximo de 10 slides atingido!"**. O card `+` da tira cria o slide e foca a miniatura ativa.
- **Identidade e posse dos elementos**: cada slide é dono dos seus elementos — os `id`s são únicos **entre slides**. `duplicateSlide` gera ids novos no clone e **descarta as cópias de crossover** (o clone nasce só com os donos; o reconcile materializa a vizinhança nova). O crossover tem **posse explícita** (`lib/crossover.ts`): quem vaza é **dono** (`crossover: true`, sem `crossFrom`) e o que aparece na vizinha é **cópia** (`crossFrom: <id do slide dono>`). Regras: **(a)** só o dono materializa, atualiza e remove cópia — cópia nunca é fonte de sangria; **(b)** a cópia só espelha de volta para o **dono declarado** e só se ele for uma das **vizinhas** (`crossFrom` = `id` da anterior ou da seguinte) — o lado vem da posse declarada, nunca do `x` da cópia (que fazia uma cópia larga arrastada para dentro da página ser descartada em silêncio); quem limpa “vizinha, mas do lado errado” depois de reordenar é o `pruneOrphanCrossoverCopies`; **(c)** excluir apaga a arte inteira (dono + cópias) casada pela posse, nunca o homônimo real de outra página; **(d)** arrastar a cópia para dentro da página transfere a arte para ela (a edição bidirecional continua valendo); **(e)** a cópia só vale se **já existia** no doc anterior daquela página e o dono declarado é uma das vizinhas — cópia inventada (palco dessincronizado, doc herdado) é descartada e **nunca** reivindica a arte do dono; **(f)** cópia de logo **nunca** substitui a logo própria da vizinha (a regra de uma logo por post vale para a arte do slide) — `upsertElementInSlide` é o ponto único, então vale também para o `reconcileAllCrossovers`; `EditorCanvas` e `SlidePreview` também não desenham o espelho de logo de uma vizinha quando a página já tem logo própria. **(g)** arrastar a arte **inteira** para fora da página (sem tocar mais a folha e além da Zona de Sangria), havendo vizinha daquele lado, faz **handoff**: ela sai de todas as páginas (dono + cópias) e entra na vizinha como arte própria, com `x ± postW` e sem `crossover`/`crossFrom` (`adoptElementInSlide`). Sem isso o elemento deixava de sangrar, a cópia era removida e o dono ficava recortado fora da folha — desaparecia das duas páginas, em “limbo”, mesmo continuando no doc. Sem vizinha daquele lado não há handoff (o elemento continua na página). `sanitizeDraftBody` roda `normalizeCrossoverOwnership` ao carregar: adota pares antigos sem `crossFrom`, descarta cópias órfãs e limpa a marca de elemento fora da folha sem dono vizinho. `dedupeSlideElementIds` (`lib/slideIds.ts`) cicatriza ids duplicados. **Dono com o centro fora da folha continua dono**: `canSourceBleed` só trata um elemento como cópia legada quando existe o par dono/cópia na vizinhança (mesmo `id` deslocado em ±postW); antes o teste era só de posição, e o dono virava cópia inerte assim que o centro passava da borda (±0,5 px) — a vizinha ficava com o espelho (que não recebe clique) no lugar da cópia e uma cópia existente congelava na posição antiga. `setActiveSlide` e `applyBodyToStores` (abrir rascunho) rodam `reconcileAllCrossovers`, então a cópia já está no `doc` da vizinha no primeiro frame, e `updateActiveSlide` devolve o doc normalizado ao `useEditor` (`resyncEditorDoc`). Regressão: `src/store/crossoverBetweenPages.test.ts`.
- **Gravação por id (nunca por índice)**: `loadSlideIntoEditor` chama `primeEditorForSlide(slide)`, que registra o id em **`editorLoadedSlideId`** (`getEditorLoadedSlideId()`) **antes** de qualquer subscriber e roda `resetEditorFor()` dentro de `withApplyingState`; em seguida grava `activeSlideId` no state da store. `updateActiveSlide` grava **nesse slide** e corrige `activeSlideIndex` se estiver defasado, com duas guardas (Leva 5): `isApplyingState()` e `editorLoadedSlideId !== activeSlideId` (descarta a gravação se o palco e a store divergirem). `activeEditorSlideId()` permanece exportado mas **sem chamadores** — não é o mecanismo ativo; a fonte de verdade é `editorLoadedSlideId` + `activeSlideId`. Era a gravação por índice que fazia fundo/textura/elementos de uma página caírem na outra. `setActiveSlide` e `switchSingleToCarousel` reconciliam/primem **antes** de um único `set`, para nenhum subscriber ver o editor apontando para o slide antigo. `resyncEditorDoc` também roda sob `withApplyingState`.
- **Tira de slides** (`SlideTray`): import **estático**, layout compacto em **uma única linha** no desktop (`.thumbList` com miniaturas + card `+` de borda **tracejada no fim da lista** e `.actions` com `Duplicar slide atual` / `Remover slide` à direita; no mobile até 640 px as ações descem em barra própria), sem o antigo botão redundante `+ Novo slide vazio` nem o contador inferior — o card `+` é o único caminho, com `aria-label="Novo slide vazio"` e dimensões por formato. Nasce no primeiro frame com botões **desativados** (`aria-busy` + "Preparando as miniaturas..." em overlay `role="status" aria-live="polite"` que não desloca a folha); `trayReady` libera no primeiro frame (`rAF`) com timeout de 1,5 s como rede de segurança. `pendingFocusSlideRef` foca `button[aria-current="true"]` e rola a miniatura para dentro da tira após criar/duplicar. Miniaturas via **`SlidePreview`** (`canvas/SlidePreview.tsx`): renderiza o `doc` do slide ao vivo com os mesmos nós do canvas principal, em modo somente-leitura (`listening={false}`), com supersampling de **160 px** (reduzido de 240 px na Leva 5) e `React.memo`. **Não há captura, cache de sessão nem `toDataURL`** — ao abrir um rascunho, todos os slides mostram a arte imediatamente, inclusive os nunca visitados. `SlidePickerDialog` usa o mesmo componente.
- **Exportação**: no modo Post único o Header exibe o botão primário `Exportar`; no modo Carrossel exibe o dropdown `Exportação` (`ExportDropdown`) com duas opções: `"Somente este slide"` (exporta PNG apenas do slide ativo) e `"Todos os slides"` (`exportCarousel()` gera ZIP `cuscuz-carrossel-YYYY-MM-DD-HHmm.zip`, `slide-NN.png`, com progresso no botão e confete ao concluir).
- **Selo**: "Slide X de Y" aparece apenas junto à folha (`slide-badge`, `role="status"`). O contador redundante da tira foi removido.
- **Reordenar por drag & drop** (`SlideThumb`/`SlideTray` + `lib/slideOrder.ts`): é **estritamente posicional** — `reorderSlides` só move posições no array e **nunca** roda `reconcileAllCrossovers`/`enforceValidCrossover`. Os objetos `SlideData` (e seus `doc`, `finish` e `elements`) permanecem os **mesmos por referência**; nenhum elemento **dono** migra, é duplicado ou apagado. A única limpeza é `pruneOrphanCrossoverCopies`: cópias de crossover que perderam o dono (ou que ficaram do lado errado) saem da página — a arte continua íntegra na página dona. A página ativa é resolvida pelo `id` do slide que está no editor, não pelo índice antigo. Se o prune tirou uma cópia do slide que está no palco, `resyncEditorDoc` devolve o doc podado ao `useEditor` (mesma referência, sem resetar etapa nem criar passo de undo) — senão o canvas continuava exibindo e deixando selecionar uma cópia fantasma que a página não tinha mais. Soltar sobre uma miniatura insere **antes** ou **depois** dela conforme a metade do ponteiro (`resolveReorderIndex`, com indicador `.dropIndicator` / `data-drop-indicator`), então arrastar uma página para o lado de outra não "substitui" a posição dela. O DnD aceita exclusivamente o MIME interno `application/x-cuscuz-slide-index`: arquivos, texto ou outro arraste externo não alteram a ordem. Os handlers de drag fazem `stopPropagation` para não vazar para o canvas. Regressão: `src/store/reorderCrossover.test.ts` (sequências do relatório do vídeo, com as invariantes de posse), `src/store/crossoverOwnershipBugs.test.ts` (fantasma no palco, cópia inventada não rouba arte, logo-cópia não apaga logo real), `src/store/reorderImmutability.test.ts`, `src/lib/slideOrder.test.ts` e e2e em `regressoes.spec.ts`. O movimento é GSAP (`src/hooks/useSlideReorderMotion.ts`): o card arrastado persegue o ponteiro com inércia (atraso + tilt/`rotationY` proporcionais à velocidade e um leve lift ao pegar), o ghost tracejado entra e sai com fade rápido, as irmãs abrem o espaço com `power3.out` (chegando em onda pela distância) e o pouso voa até o slot com ease-out, com troca invisível para a miniatura real. **Com `prefers-reduced-motion: reduce` o movimento não é zerado**: ele dura no máximo 0,12 s e perde inércia/tilt (`calm()`), porque a troca instantânea de posição escondia o destino do drop. **Leva 5 — alternativa por teclado (WCAG 2.5.7)**: o `SlideThumb` renderiza, só no slide ativo e com mais de um slide, os botões **`Mover slide N para a esquerda` / `Mover slide N para a direita`** (`title` com `Alt+←`/`Alt+→`, `data-no-drag`, `stopPropagation`, desabilitados nas extremidades) e o botão da miniatura aceita **Alt+Setas**; ambos chamam `reorderSlides` direto. Cada `.thumbCell` reserva a `.moveBar` de 26 px em todas as miniaturas para a tira não pular. **Leva 5 — robustez da animação**: `LANDING_SAFETY_MS = 1200` libera o arraste se a store não devolver novo `slides`; `resetMotionArtifacts()` centraliza limpeza (kills, `opacity`, `pointerEvents`, `clearProps`, `data-motion-active`, `data-slide-dragging`, timeout, `sessionRef`); o card flutuante nasce invisível para não pintar em (0,0); a física começa na posição **atual do ponteiro** (`startSession(index, downX, downY, currentX, currentY)`), com `followFactor 0,72`, `smoothVx 0,55`, tilt ±12°/±7° e escala 1,06; `Konva.stages.find(...).draw()` roda no `useLayoutEffect` junto com a ocultação da miniatura real, eliminando o piscar; setters `scaleX`/`scaleY` substituíram `gsap.quickSetter(el, 'scale')`, que não renderizava.

### 2.14 Header, Dock e nome do projeto

- **Nome editável** (Leva 2): clicar no `<h1>` abre `<input aria-label="Nome do projeto">`; Enter/blur confirma, `Escape` cancela, vazio/inalterado não salva. `renameActiveDraft()` (`session.ts`) atualiza **`activeMeta`** (senão o próximo autosave restaura o título automático), define `titleSource: 'user'`, chama `saveDraftRecord`, marca `isNewDraft = false` e transmite `drafts-changed`. Renomear um rascunho novo e vazio passa a persisti-lo. **Leva 5 — acessível por teclado no editor (WCAG 2.1.1)**: o `<h1>` continua clicável, mas agora há também um botão lápis **`aria-label="Renomear"` / `title="Renomear"`** ao lado dele (`renameBtnRef`), com `Pencil` 14 px; `Enter` e `Escape` devolvem o foco ao lápis via `requestAnimationFrame`, enquanto o `blur` não rouba foco. Antes o header do editor era mouse-only; a home já tinha o lápis no card.
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
  - **Dock em duas colunas (Leva 5 + ajuste visual)**: o card `AlignToolbar` mostra **Alinhamento** na coluna da esquerda e **Camadas**, **Espelhar** (quando aplicável) e **Cópia e exclusão** na direita (`.columns`/`.column` em `AlignToolbar.module.css`). No desktop, `.columns` usa `align-items: stretch` e a coluna da direita (`.actionsColumn`) usa `justify-content: space-between`, alinhando perfeitamente a base dos botões de "Cópia e exclusão" com a base dos botões de "Alinhamento" (linha tracejada inferior) e eliminando o espaço ocioso quando elementos sem espelhamento (como texto) estão selecionados. O alinhamento virou **dois trios verticais lado a lado** (horizontal à esquerda, vertical à direita — 2 colunas × 3 linhas), sem mexer nos rótulos acessíveis. Para caber, o dock passou de **148px para 210px** no desktop; **todos** os cards do dock continuam esticando na mesma largura (`align-items: stretch`). No mobile (≤640px) o dock segue com **148px** e o card volta a **uma coluna**. A medida da faixa reservada ao dock vive em **`--dock-reserve`** (`EditorCanvas.module.css`: 236px no desktop, 176px no mobile) e `useCanvasFitWidth` **lê essa variável** (fallback 176) em vez de repetir o número — se a largura do dock mudar, esses dois pontos continuam juntos. **Etiquetas do dock (Leva 5)**: o componente `components/ui/ToolGroupTitle.tsx` expõe `ToolGroupTitle` (Londrina Solid 900, 13 px, barro, uppercase, sublinhado) e `ToolSubgroupTitle` (PT Sans Narrow 700, 11 px, cinza). Estão em `AlignToolbar` ("Opções do elemento" / "Alinhamento", "Camadas", "Espelhar", "Cópia e exclusão"), `BackgroundMirrorToolbar` ("Opções do fundo" / "Espelhar"), `GuideToolbar` ("Guias" / "Linhas de Referência"), `ZoomControls` ("Zoom") e no novo card `.dockHistoryCard` ("Histórico", envolvendo o `role="group" aria-label="Histórico de ações"` de Desfazer/Refazer). O `role="group" aria-label="Zoom da folha"` migrou do `.controls` externo para a `.row` interna dos botões.

### 2.15 Componentes de UI e convenções visuais

- **`PreviewImage`** (`components/ui/`): toda prévia de imagem passa por ele. Estados `empty/loading/loaded/error` escopados por `src`; `<img>` nasce com `opacity: 0` e só aparece no `onLoad` — **nunca** exibir `alt` cru nem ícone de imagem quebrada. Variantes `compact` (só o anel, dimensionado pelo container) e `full` (selo adesivo com anel + "Carregando prévia..."). Spinner: borda 3 px preta com arcos amarelo/barro, `0.9s linear infinite` (`--duration-loading`), **`1.6s` com `prefers-reduced-motion`** (giro é feedback essencial; o restante do app respeita a regra global). Fundo creme com pontilhado barro, estático.
- **`HelpTip`**: balão `(?)` com `role="tooltip"`, `aria-describedby`, `aria-expanded`; abre em hover, foco e toque; fecha em `Escape`, `blur` e clique fora. Props: `tip`, `label` e `align` (`'center'` padrão, `'start'`, `'end'` — a seta acompanha o gatilho). Usado no título "Meus rascunhos" e nos modos de recorte de fundo.
- **`BackgroundMirrorToolbar`**: reusa `AlignToolbar.module.css`; dois `IconButton` com `active` no dock direito, contextual (Passo 1 + fundo + sem seleção).
- **`GuideToolbar`** (Leva 5 + ajuste): o card mostra o liga/desliga das guias e, com elas visíveis, o trio **Linhas de Referência** (margens, centrais, terços). A grade de presets **"Margem (px)"** (32/56/80/100) foi **removida** a pedido do Reni; a margem fica no padrão do store (`layoutGuides.margin`) e continua alimentando os presets da logo. `setGuideMargin` e `GUIDE_MARGIN_PRESETS` **permanecem** em `editorStore`/`brand.ts` como contrato de dados e de teste (não recriar a grade na UI).
- **Scrollbars**: `global.css` aplica `scrollbar-color: var(--c-amarelo-quente) var(--c-surface-muted)` e `scrollbar-width: thin` em `html`, mantém `::-webkit-scrollbar*` (inclusive `:active` e `-corner`) e `summary:focus-visible` no seletor de foco. **Leva 5 — ocultar na área de trabalho**: os containers de painel/área de trabalho (`.container` de `StepPanel`, `.stepContent` e `.dock` de `App.module.css`, `.container` de `EditorCanvas.module.css`, `.thumbList` da tira) usam `scrollbar-width: none` + `-ms-overflow-style: none` + `::-webkit-scrollbar { display: none }`, **mantendo `scrollbar-gutter: stable`** para a rolagem por wheel continuar sem deslocar o conteúdo. `FirefoxRoundScrollbar.tsx` tem guarda `if (style.scrollbarWidth === 'none') return;` e não desenha a barra própria nesses containers. A barra amarela temática segue valendo para o `html` e demais containers de rolagem. Contrato de teste: `Melhoria #01` em `e2e/regressoes.spec.ts`.
- **`Checkbox`** (`components/ui/`): checkbox do tema usado nos cartões de textura.
- **`ElementListRow`** (`components/ui/ElementListRow.tsx` + `.module.css`, **Leva 4**): componente único do log "Na folha" dos Passos 2 (Enfeites), 3 (Imagens) e 4 (Textos). Um `<button>` com `aria-label="Selecionar …"` e `aria-pressed` **ocupa a caixa retangular inteira** (`padding-right` reserva a lixeira); a lixeira é um `<span>` **irmão** posicionado à direita, então **excluir nunca seleciona**. Props: `label`, `selectLabel`, `removeLabel`, `selected`, `onSelect`, `onRemove`, `leading?` (miniatura via `PreviewImage`, usada só em Imagens), `bullet?` (ponto de lista personalizado — `true` em Enfeites/Textos, no lugar da numeração `"1. …"`; `false` em Imagens), `title?`. Fundo amarelo quando selecionado; `:focus-visible` verde. As listas usam `.elementList` (`StepPanel.module.css`); `ImageStep.module.css` não tem mais `.row*`/`.rowLabel`.
- **Passo 4 · Editar Texto** (`steps/TextStep.tsx`): **Leva 5 — `+ Texto com borda` deixou de ser botão de criação**. Os botões de criação em "Adicionar à folha" são **dois — `+ Título` e `+ Texto`** — em `.buttonGrid` (2 colunas, `Button size="sm"` com `.addTextButton`: ícone em cima, nome embaixo, `white-space: normal`); o antigo `.buttonGrid3` e o terceiro botão saíram (e2e afirma `+ Texto com borda` com `toHaveCount(0)`). O Efeito da Marca agora é um **toggle do texto selecionado**, no mesmo par de botões do card de edição, lado a lado em `.togglePair`: **"Tudo maiúsculo"** (`variant="secondary"`, ícone `CaseUpper`, badge `AA`/`aa`, `aria-pressed={selectedText.uppercase}`) e **"Texto com borda"** (`variant="primary"`, ícone `Sparkles`, `aria-pressed={selectedText.brandEffect}`, ✓ verde). Ambos chamam `updateElement(id, { uppercase | brandEffect })`. Quando "Texto com borda" está ligado, aparece o swatch **"Cor da borda:"** (`TEXT_BORDER_COLORS`, 5 colunas, ligado a `TextEl.brandEffectColor`, default `creme`) — ver §2.4. **"Cor do texto"** (swatches em 2 colunas) e **"Caixa de destaque"** (Nenhuma/Amarela/Barro empilhadas com `Segmented direction="column"`) seguem lado a lado em `.dualColumn` (gap 14 px, `align-items: stretch`; `Segmented` com `.borderSection`/`.borderSegmented`, segmentos `flex: 1 1 0` e `min-height: 38px`). O card mantém `.editStack` (gap 16 px). O antigo botão **"Efeito da Marca"** segue fora do painel. `ColorSwatches` foi generalizado com props `value`, `label`, `colors`, `columns: 2|4|5`, `ariaLabelPrefix` e **`aria-pressed`** em cada cor; nomes acessíveis `Cor da borda: {Preto|Barro|Amarelo|Verde Ceará|Creme}`.
- **`Toast`** (`components/Toast.tsx`): balão de aviso com `role="alert"` usado por todas as telas. Tem **barra de tempo amarela** no topo (`.timer`, `scaleX` da esquerda para a direita) preenchendo durante `duration` (4 s; 8 s quando há ação). Ao completar, o balão **sempre esmaece em 1,2 s** (rAF, não CSS) e só então é dispensado. Passar o mouse **ou focar o balão por teclado** durante o esmaecimento, antes de a opacidade chegar a 5%, **zera o esmaecimento** (`rescueFade()` em `pointerenter`/`pointermove`/`focusin`) e segura o balão em 100% enquanto o ponteiro ou o foco estiverem nele; `handleFocusOut` libera só se `relatedTarget` estiver fora e `handlePointerLeave` só se não houver foco dentro (Leva 5 — antes o resgate era pointer-only). Hover durante a contagem **não** pausa a barra — só o esmaecimento é resgatável. O X (`Fechar notificação`) e uma ação (`Desfazer`) continuam dispensando na hora. O fundo do toast de sucesso passou a `--c-toast-success-bg: #3f621a` (≈7,1:1 com branco; antes `#698f3f` dava 3,75:1).
- **Scrollbar fina e arredondada em todos os navegadores** (Leva 3): 6 px com pontas redondas; no Firefox, onde o CSS não arredonda a barra nativa, `FirefoxRoundScrollbar.tsx` desenha uma barra própria sobre os containers de rolagem.
- **Ajuda no contexto**: descrições longas viram balão, não texto permanente. Microcopy em PT-BR, calorosa, sem diminutivos nos títulos das etapas.
- **Títulos das etapas** (`steps/*`): cada painel abre com `.titleRow` — o `<h2>` da etapa e, **fixo na borda direita do painel**, um `HelpTip` (`aria-label="Sobre esta etapa"`, `align="end"`) com a descrição. **Não existe mais** o `<p>` de descrição abaixo do título. O balão abre em hover, foco e toque.
- **Stepper (Leva 5)**: o botão do passo ativo ganhou `aria-current="step"` e a tag "opcional" virou `<span aria-label="opcional">`. Por isso o nome acessível do botão passa a incluir "opcional" (ex.: "2. Enfeites opcional") — o e2e `flow.spec.ts` usa `getByRole('button', { name: 'P', exact: true })` para não capturar a tag. `.stepButton.active:focus-visible` usa `outline: 3px solid var(--c-preto)` + `box-shadow: 0 0 0 2px var(--c-creme), 0 2px 0 var(--c-border)`, resolvendo o foco verde sobre o amarelo do passo ativo.
- **Diálogos modais (Leva 5)**: novo hook `src/hooks/useDialogFocus.ts` — salva `document.activeElement`, foca `initialFocusRef ?? primeiro focusable ?? diálogo`, registra `keydown` em **captura no `document`** (`Escape` → `preventDefault`/`stopPropagation`/fecha, impedindo vazamento para os atalhos globais; `Tab`/`Shift+Tab` → focus trap) e devolve o foco ao gatilho no cleanup se `isConnected`. `FOCUSABLE_SELECTOR` ignora desabilitados e `aria-hidden`/`display:none`/`visibility:hidden`. Aplicado em `ConfirmDialog` (foco inicial no **botão cancelar seguro**, via `cancelBtnRef`), `SlidePickerDialog` (primeiro botão de slide) e no diálogo de formato do carrossel na home (`Vertical (3:4)`); os três ganharam `aria-labelledby`/`aria-describedby` quando aplicável. `Button` virou `forwardRef` para suportar o `cancelBtnRef`. Limitação: sem `inert` no fundo, o trap cobre só `Tab`. Contrato de teste: `diálogos modais focam botão seguro e fecham com Escape` em `e2e/regressoes.spec.ts`.
- **Passo 2 · Enfeites**: o card **"Opções de {enfeite}"** e o bloco **"Encaixar nos cantos"** foram **removidos** (o `placeDecoration` saiu do store junto). Posição, espelhar e excluir ficam só no dock direito e na lista "Na folha" (um caminho por ação); `DECORATION_ANCHORS` permanece em `brand.ts` como contrato de dados.

### 2.16 Testes e verificação

- **Verificação da release v2.0.0 (Leva 5, 17/11/2026), executada nesta árvore**: `npm run typecheck` ✅ · `npm run test` (Vitest + jsdom, **250 testes em 28 arquivos**) · `npm run build` ✅ · `npm run e2e` (**109 passed / 3 skipped**, 112 execuções desktop + mobile). A suíte cobre miniaturas vivas, integridade de slides, colagem Ctrl+V, foco de diálogos, renomeação por teclado, reordenação acessível, checkpoint em `beforeunload` e scrollbars ocultas. Números anteriores (auditoria de 12/11: 215/23 e 87/3 em 90 execuções) estão superados.
- **Obrigatório rodar `npm run build` antes de `npm run e2e`**: `playwright.config.ts` serve `dist/` na porta 4173 via `npm run preview`. Sem rebuild, os e2e testam código velho.
- Suíte e2e: `flow`, `format`, `image`, `multiselect`, `rascunhos`, `momento-zero`, `regressoes` (histórico das levas + área de texto + reordenação + miniaturas + integridade de slides) + `helpers.ts`. `openCreateMenu()` / `createSingle()` / `pickCarousel()` / `createCarousel()` centralizam a criação pela home (o gatilho `+ Criar novo` é o mesmo no header e no quadro vazio); `CREATE_SINGLE = /Post único/` e `CREATE_CAROUSEL = /Carrossel/` casam o nome acessível do item de menu, que inclui a dica ("Post único Uma arte só"); `waitForHome()` é independente da contagem de rascunhos.
- **Contratos de seletor a preservar**: "Corte vertical", "Topo"/"Centro"/"Base", "Slide 1 de 1" (ocorrência única no `slide-badge`), "Espelhar fundo ↔/↕" no fundo, "Espelhar horizontalmente"/"Espelhar verticalmente" só no dock (enfeites e imagens), `Sobre esta etapa` (o `(?)` de cada etapa), `create-draft-trigger` (home), `mode-dropdown-trigger`, `slide-badge`, `export-dropdown-trigger`, `canvas-busy-overlay`, "Trocar imagem" / "Remover fundo" / "Reverter fundo" no card da imagem, **"+ Título" / "+ Texto"** no Passo 4 (sem parênteses), **"Cor do texto:"**, `Selecionar {elemento}` / `Remover` / `Remover imagem` no log "Na folha", `Renomear` **no card da home e no Header do editor**, `data-handle="e|w"` (alças laterais da área de texto), `textarea[aria-label="Editar texto"]`, `data-slide-index`, `data-slide-preview`/`data-slide-elements`, `data-slide-id` e `data-drop-indicator="before|after"` na tira de slides. **Leva 5 — novos contratos**: `button[title="Imagem colada"]`, `role="region"` + `aria-label="Palco da arte"`, "Cor da borda: {cor}", "Mover slide N para a esquerda/direita", "Novo slide vazio", "Tudo maiúsculo" / "Texto com borda" (`aria-pressed`), "Ativar/Desativar todas as texturas" (nomes completos), "Aplicar em todos os slides" (`aria-pressed`), `Alinhar à base da página` / `Alinhar à esquerda da página`, foco inicial + Escape em `Escolha o formato do carrossel 🎠` / `Trocar pra Carrossel?` / `SlidePickerDialog`, `aria-current="step"` no Stepper.
- **Removidos — não devem voltar**: **Leva 4**: "Restaurar padrão", "Cor da Marca", "Encaixar nos cantos", "Centralizar na folha". **Leva 5**: botão de criação **"+ Texto com borda"** (virou toggle `Texto com borda`), "Posições Rápidas" e "Canto Sup. Esq./Dir.", "Canto Inf. Esq./Dir.", "Centro Inferior", "Centro da Folha" no `LogoStep`, grade **"Margem (px)"**, chevrons "Slide anterior"/"Próximo slide" da tira, o contador da tira (segundo "Slide X de Y") e a barra de rolagem visível na área de trabalho.

### 2.17 Feedback de carregamento (Leva 3)

Problema: trocar o fundo ou adicionar enfeite/foto/logo/textura demorava (assets WebP de até 1,2 MB + decode) **sem nenhum sinal** na tela. Regra: **toda ação que leva tempo para aparecer na folha precisa de feedback imediato, temático e que nunca bloqueia a interação.**

- **Selo sobre a folha** (`EditorCanvas.tsx` + `.canvasBusyOverlay*`): adesivo "caderninho" com spinner (mesma linguagem do `PreviewImage`) e microcopy da marca — `"Colando o fundo na folha... 🌽"`, `"Trocando o fundo... 🌽"`, `"Colando {enfeite}... ✨"`, `"Colando sua foto na folha... 📸"`, `"Carimbando a logo... 🏷️"`, `"Aplicando textura... ✨"`. Fundo e textura ganham também um véu leve sobre a folha. `pointer-events: none`, `aria-hidden`, `data-testid="canvas-busy-overlay"` (contrato de teste). **Só aparece se a espera passar de ~200 ms** (`useDelayedFlag`, `CANVAS_FEEDBACK_DELAY_MS`) e **some no instante** em que o item fica pronto — não há tempo mínimo de exibição. Se o asset já está em cache (hover/preload), nada é mostrado. Regra: o loading nunca é obrigatório, só aparece quando a espera é perceptível.
- **Fonte do estado** (`lib/useImage.ts`): `announceCanvasActivity(kind, label, targetSrc?)` + `useCanvasActivity()` (intenção da usuária; encerra quando `targetSrc` entra no cache/falha, ou quando a importação de foto termina; não mostra nada sozinha), `useLoadingImages()` (qualquer imagem do canvas em carregamento) e `beginImageImport`/`endImageImport` + `useImageImportBusy()` (pipeline de foto: decode → downscale → WebP → IndexedDB). `EditorCanvas` combina os três em `activeFeedback`. `useDelayedFlag` (`lib/useDelayedFlag.ts`) aplica o atraso de 200 ms ao selo e ao spinner da miniatura. Os steps (`Background/Decoration/Logo/Texture/ImageStep`) só chamam `announceCanvasActivity` no clique.
- **Miniaturas**: `ThumbGrid` mostra um spinner no selo da miniatura escolhida (também só após 200 ms) enquanto o asset em alta ainda carrega (`.checkBadgeLoading`/`.badgeSpinner`) e dispara `preloadImage(src)` em `onMouseEnter`/`onFocus`, de modo que o clique costuma achar o asset já decodificado.
- **Fotos do usuário**: `ImageStep`/`imageImport` chamam `await preloadImage(entry.url)` antes de `addImage`/`replaceImage`, evitando segundo "vazio" ao montar o `ImageNode`.
- **Carregamento sob demanda**: `TextureOverlays.tsx` e `TextNode.tsx` só chamam `useImage` para `papel-textura.webp`/`textura-borda.webp` quando a textura/borda está **ligada** — antes eram 2,2 MB decodificados no boot, competindo com a escolha do fundo.
- `EditorCanvas` inclui `loadingUrls.size` nas dependências do efeito que anexa o `Transformer`, para que o elemento recém-adicionado receba as alças assim que a imagem termina de carregar.

### 2.18 Área de texto (largura/altura persistidas)

Problema corrigido: o texto era **cortado ao reentrar em edição** (o `EditorCanvas` zerava a medida num efeito que rodava depois do filho, e o CSS tinha `min-width: 220px`), e a **caixa de destaque colapsava na montagem do slide** porque o `TextNode` lia `textMeasurerRef.current` durante o render (null na primeira passada, sem re-render até a seleção mudar).

- **Modelo**: **só largura** — `TextEl.boxWidth` (px do post, **sem** os pads da borda). Ausente = **área automática** (criação): a largura é a do conteúdo e não há quebra automática. Com área definida, o texto quebra em `boxWidth`. A **altura é sempre automática** (`conteúdo + largura`, auto-height): cresce e diminui sozinha, nunca é definida manualmente e nunca corta o texto. `boxHeight` foi **removido do modelo**; rascunhos antigos são limpos pelo `sanitize()`.
- **Medição** (`lib/textLayout.ts`): `measureTextLayout(el)` usa um `Konva.Text` reaproveitado (a **mesma engine** do desenho) e devolve conteúdo/pads/caixa externa de forma **síncrona no render**. `TextNode` e `CrossoverMirrorNode` desenham a tarja e o offset do grupo a partir dela; `useFontsReady` força uma re-medição quando as fontes terminam de carregar. Nada depende de ref, seleção, etapa ou slide.
- **Definição da área**: ao sair da edição (`setEditing`, `setStep` e `flushTextEditing` em troca de slide), a largura automática é **congelada** com a largura atual do conteúdo (`setTextBoxMeasurer` registrado pelo `EditorCanvas` — o store não importa Konva). `sanitize()` normaliza `boxWidth` para inteiro > 0.
- **Alças da área** (`InlineTextEditor`, só no modo de edição): **apenas 2 alças laterais** em HTML (`data-handle="e|w"`, verdes, distintas das alças amarelas do Transformer). `resizeTextBoxWidth`/`screenDeltaToLocal` (`lib/textBox.ts`) aplicam o delta no referencial local, mantêm a alça oposta presa e nunca mudam `fontSize` nem a altura. **Não existem alças verticais/diagonais** — a altura é automática, então uma alça vertical só criaria uma caixa "fantasma".
- **Uma única caixa na edição**: o `<textarea>` herda o foco, e o `outline` global de `:focus-visible` (verde **sólido**) desenhava uma segunda caixa no tamanho do **conteúdo**, "descolada" da área durante o arraste (só aparecia na vertical, porque na horizontal as bordas coincidem). `InlineTextEditor.module.css` zera o `outline` do textarea em `:focus`/`:focus-visible`; a indicação de foco é o tracejado da `.editorBox`.
- **Sem salto visual**: a caixa de edição usa a mesma medida do canvas (sem `min-width`), `box-sizing: border-box` no `textarea`, `white-space: pre` (área automática) ou `pre-wrap` (área definida) e altura acompanhando o conteúdo.
- **Contrato de teste**: `e2e/regressoes.spec.ts` cobre alças (2), ausência de alça vertical/diagonal, `outline-style: none` no textarea (caixa fantasma), aumento horizontal, altura automática ao digitar, ausência de clipping ao reabrir, largura persistida e tarja correta após reload (geometria do `Rect` do Konva). Unitários: `textBox.test.ts` e `textAreaScaling.test.ts`.

### 2.19 Seleção adaptativa (cor que se adapta ao fundo)

- **Problema**: a caixa de seleção (Transformer) e o realce de seleção de texto eram amarelos fixos. Sobre fundos amarelos ou creme (muito comuns na marca) a caixa e o realce praticamente somem.
- **Regra**: a cor da seleção se adapta ao **ambiente do elemento**, não a uma preferência fixa. `src/lib/selectionContrast.ts` amostra um anel de 20 blocos de 4×4 px em volta da caixa do elemento no canvas **já renderizado** (primeiro o anel de fora; se boa parte cair fora da folha, o de dentro) e escolhe entre os dois extremos da paleta por contraste WCAG: **amarelo** (`#f8ce2b`) quando o contraste é ≥ 2,2; **preto** (`#0b0500`) quando o fundo é claro (amarelo, creme, branco). Empate ou ambiente ambíguo fica com o amarelo, que é a cor da marca; sem amostras (canvas ilegível/contaminado) também.
- **Aplicação**: `useSelectionAccent` (`src/canvas/hooks/`) alimenta `borderStroke`, `anchorFill` e `anchorStroke` do Transformer — o contorno das alças é sempre o **oposto** do accent, então a alça nunca some mesmo onde o traço se confunde com o fundo — e o realce de seleção do `<textarea>` da edição in-place (variáveis `--selection-bg`/`--selection-fg` herdadas por `::selection`; o padrão do `global.css` continua amarelo/preto para a interface).
- **Sem piscar e sem custo**: a remedição só acontece em mudança de seleção/edição, de fundo, de slide, de posição **comitada** e de imagens carregadas (nunca no meio de um arraste, porque o `doc` só recebe a posição no fim). É leitura de poucos pixels do canvas da camada, sem redesenhar o palco.
- **Testes**: `src/lib/selectionContrast.test.ts` (contraste WCAG; amarelo/creme → preto; escuro, verde e barro → amarelo; par accent/onAccent legível).

### 2.20 Atalhos de teclado e edição sem mouse (Leva 5)

`src/lib/shortcuts.ts` ignora `INPUT`/`TEXTAREA`/`contentEditable` e, desde a Leva 5, também `INTERACTIVE_TARGET_SELECTOR = 'button, a, select, summary, [role="button"], [role="menuitem"], [role="option"]'` para certos atalhos.

| Tecla | Ação | Guardas |
|---|---|---|
| `Delete` / `Backspace` | Exclui elemento(s) selecionado(s) | fora de input |
| `Ctrl/Cmd + D` | Duplica (respeita limite de 5 imagens; logo duplicada avisa) | — |
| Setas | Move a seleção 1 px (10 px com Shift) | `G` exige `!altKey` para não conflitar com AltGr |
| `F2` ou `Enter` | Entra em edição de texto com **exatamente 1 texto selecionado** | sem Mod/Shift/Alt; `Enter` exige alvo fora de controles interativos |
| `[` / `{` e `]` / `}` | Rotaciona −5° / +5° (Shift: ±1°) via `buildTransformPatches` | sem Mod/Alt |
| `+` / `=` e `-` / `_` | Escala +5% / −5% (Shift: ±1%) sobre a seleção | sem Ctrl/Cmd/Alt; usa `groupScaleBounds` + `groupLimitMessage` e **emite o toast de `Texto ≤ Título`** quando bate no limite |
| `G` | Alterna guias | sem Mod/Alt |
| `Alt + ←/→` na miniatura | Reordena slide (ver §2.13) | só na tira, slide ativo |

Mitiga a limitação histórica de edição/rotação/escala pointer-only; as alças do `Transformer` continuam sem foco de teclado. Os atalhos novos (`F2`, `[ ]`, `+ -`) **não têm cobertura unitária ou e2e dedicada** — cobertura indireta via fluxos de arraste e duplo clique.

### 2.21 Confiabilidade e arquitetura de sincronização (Leva 5)

- **`src/store/syncEngine.ts`** (novo): substitui o subscriber inline de `main.tsx`. Exporta `isApplyingState()`, `withApplyingState<T>(fn)` e `installEditorCarouselSync(): () => void`. O estado vive em `globalThis.__cuscuzSyncEngineState` (`applyingStateDepth`, `installed`, `unsubscribeFn`); o contador é aninhado e restaurado no `finally`. A instalação é idempotente e HMR-safe, e o subscriber só grava quando `!isApplyingState()`, `mode === 'carousel'` e `doc`/`finish` mudaram **por referência**. Usado por `main.tsx`, `carouselStore.ts` e `lib/drafts/session.ts`. Teste: `src/store/syncEngine.test.ts`.
- **`src/lib/sanitize.ts`** (novo): ponto único de `VALID_FORMATS`, `uid()`, `clampInt()`, `isPostFormat()`, `sanitizeFormat()`, `emptyDoc()`, `defaultFinish()`, `defaultSlide()`, `sanitize()`, `sanitizeSlide()`, `sanitizeFinish()`, `boxSize()`, `sanitizeTextElement()`, `isSlideEmpty()`. Antes duplicados em `editorStore`/`carouselStore`, com `repository.ts` importando dos stores (inversão de dependência corrigida). `editorStore`/`carouselStore` reexportam os nomes antigos; `resetEditorFor(doc, finish)` substitui os quatro blocos duplicados de reset (um único `set` + `temporal.clear()`).
- **Exportação desacoplada**: `exportCarousel()` recebe `activateSlide: (slide, index) => void` em vez de importar a action do store; `EditorScreen` e `HomeDraftExporter` injetam a função. Antes de exportar, `EditorScreen` chama `select(null)`, `setEditing(null)`, **`flushTextEditing()`** e **`await flushDraft()`** — congela a área automática do texto e grava no slide correto. No `finally`: `setActiveSlide(originalActiveIndex)` → restaurar guias → limpar `isExporting` (essa ordem evita que o autosave capture um índice temporário). `HomeDraftExporter` só limpa `mode: null` se `screen !== 'editor'`.
- **Overlay de alças**: `OVERLAY_SLACK_MIN = 160`, `OVERLAY_SLACK_MAX = 320`, `clampSlack()` — antes era 520 px **por lado**, o que podia fazer o overlay superar o canvas principal em GPU em zoom alto. O patch do protótipo do Konva foi unificado em `applyMirrorTransformerSlack()` (`mirrorTransformer.ts`), usado também por `useOverlayGeometry.ts` (HMR-safe). Trade-off: com muito scroll, alças em extremos podem ficar fora da área do overlay (sem teste e2e cobrindo).
- **Memoização do canvas**: `BackgroundNode`, `CrossoverMirrorNode`, `DecorationNode`, `ImageNode`, `LogoNode` e `TextNode` agora são `React.memo(...Impl)`. Os callbacks do `EditorCanvas` foram estabilizados com `useCallback` e **recebem o `id` como primeiro argumento** — `onSelect(id, e)`, `onChange(id, patch)`, `onDoubleClick(id, e)`, `onApplyTextSize(id, requested)` —, em vez de closures `(e) => handle(el.id, e)`. `changeEl` não captura mais `doc` (lê `useEditor.getState()` para decidir `crossover`). **Contrato a preservar**: reintroduzir closures por elemento no mapa de nós invalida a memoização. `handleDragMoveSnap` ainda muda quando `layoutGuides`/`postW`/`postH` mudam (raros).
- **`src/lib/textEditorStyle.ts`** (novo, 6 testes): `editorTextStyle()` puro replica fonte/tamanho/cor/`textTransform`/`WebkitTextStroke`/`textShadow` do Efeito da Marca no `<textarea>` in-place, usando a mesma cor resolvida do canvas.

### 2.22 Contraste, foco e ressalvas conhecidas

- Tokens (Leva 5): `--c-toast-success-bg: #3f621a` (≈7,1:1 com branco; antes 3,75:1), `--c-focus-ring: #2d5a18` (≈5,3:1 sobre amarelo, ≈6,9:1 sobre creme) usado pelo `:focus-visible` global; `color-scheme: light` evita controles nativos escuros em SO dark. Selo `Salvo` do Header usa o mesmo token de sucesso.
- `EditorCanvas` ganhou `role="region" aria-label="Palco da arte"`; o overlay de alças é `aria-hidden="true"`.
- **Ressalvas registradas (não corrigidas nesta release, não tratar como requisito implícito)**:
  1. `window.__useEditor` / `__useCarousel` / `__useDraftsStore` continuam expostos em produção — agora com comentário justificando o uso pelo Playwright (`vite preview`). Os e2e de colagem e snapshot dependem deles.
  2. `activeEditorSlideId()` é export morto (sem chamadores); a identidade real é `editorLoadedSlideId` + `activeSlideId`.
  3. `updateActiveSlide()` descarta silenciosamente a edição quando `editorLoadedSlideId !== activeSlideId` — protege contra gravação no slide errado, mas não notifica a usuária.
  4. `Alt+←/→` com um elemento selecionado no canvas aciona **também** o atalho de mover elemento 1 px: o `SlideThumb` dá `preventDefault()` mas não `stopPropagation()`, e o handler de setas de `shortcuts.ts` não tem guarda `e.altKey`.
  5. `useDialogFocus` não aplica `inert`/`aria-hidden` no restante da página; só o `Tab` é aprisionado. O `SlidePickerDialog` tem `titleId` órfão (usa `aria-label`) e as opções de slide não expõem `aria-pressed`/`aria-selected`.
  6. `sessionController` completo e a virtualização dos Stages do carrossel (até 10 vivos) seguem fora de escopo; `RENDER_WIDTH` caiu de 240 para 160 e mitigou o custo. `resetDraftSessionForTests()` não zera `editorLoadedSlideId` nem `lastCapturedDraftId` — lacuna de isolamento entre suites/HMR.
  7. `ExportDropdown`/`CreateDraftDropdown` usam `role="menu"`/`menuitem` enquanto `ModeDropdown` usa `listbox`/`option` — inconsistência semântica pendente.
  8. `tmp/RELATORIO-QUALIDADE.md` (13/11) descreve os 18 itens como pendentes; a Leva 5 resolveu a maioria — ler este `AGENTS.md` como fonte de verdade, não aquele relatório.

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
        ├── store/              # editorStore (zundo, resetEditorFor) · carouselStore (activeSlideId,
        │                       # applyFinishToAll) · draftsStore · syncEngine (novo na Leva 5)
        ├── screens/            # HomeScreen ("Meus rascunhos") · EditorScreen
        ├── lib/drafts/         # types · db (getOpenEditorDbSync) · repository (cleanupOrphanDraftIds)
        │                       # content · migration · session (checkpoint, 200 ms, blur) · cover · backup
        ├── lib/                # align · textRules · multiSelect · imageRules/imageImport/userImages
        │                       # bgRemoval* · carouselGC · crossover · export/exportCarousel
        │                       # fonts · grain · shortcuts · storage · useImage · zoom · selectionContrast
        │                       # sanitize · clipboardImages · pasteImage · textEditorStyle (Leva 5)
        ├── canvas/             # EditorCanvas · SlidePreview (RENDER_WIDTH 160) · Nodes (React.memo)
        │                       # hooks (useCanvasFitWidth · useOverlayGeometry) · mirrorTransformer
        ├── hooks/              # useSlideReorderMotion (GSAP) · useDialogFocus (Leva 5)
        ├── components/
        │   ├── Header · Stepper · StepFooter · Toast · ConfirmDialog · ModeDropdown · CreateDraftDropdown
        │   ├── ZoomControls · GuideToolbar · AlignToolbar · BackgroundMirrorToolbar
        │   ├── carousel/       # SlideTray · SlideThumb (setas de mover) · SlidePickerDialog
        │   └── ui/             # Button (forwardRef) · IconButton · Card · Slider · Segmented · Checkbox
        │                       # ColorSwatches · ThumbGrid · FormatGlyph · PreviewImage · HelpTip
        │                       # ElementListRow (Leva 4) · ToolGroupTitle (Leva 5)
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
  acontece no boot, junto da reconciliação do doc. **Exceção de sobrevivência (Leva 5)**: o
  checkpoint `cuscuz-insta-kit:pending-checkpoint` guarda o `DraftBody` sem binários no
  localStorage para não perder a última edição em `beforeunload`; ver §2.12.
- **Versão da aplicação**: `package.json` declara `"version": "2.0.0"` e a linha de release é
  `release/v.2`. A release anterior era chamada "v3 Meus rascunhos" na documentação — a partir
  de 17/11/2026 o rótulo canônico é **v2.0.0 / Leva 5**; ver `tmp/RELEASE-NOTES.md` e
  `tmp/CHANGELOG.md` (fora do controle de versão, em `tmp/`).
- **Deploy**: site estático hospedado na **Vercel**. O cache é definido em `vercel.json` e `public/_headers`
  (conteúdo duplicado — altere os dois juntos): `/assets/*` imutável (1 ano) e `/brand/*` com revalidação de 7 dias,
  pois os assets da marca podem ser regenerados pelo pipeline `npm run assets`.
- **Imutabilidade das pastas raiz**: Nunca modifique diretamente os arquivos nas pastas raiz de assets sem autorização expressa do usuário. Novos assets devem ser processados pelo script `npm run assets`.
- **Ids de asset são contrato de dados**: `assetId` fica gravado nos `Doc` persistidos. Renomear só o `label` (seção 2.7); nunca trocar `id`, `src`, `thumb`, `blend` ou `fullSheet` de um asset existente sem migração explícita.
- **Prévias de imagem**: sempre via `PreviewImage` (seção 2.15). Nunca `<img>` com `alt` visível durante o carregamento nem placeholder "Vazio" piscando.
- **Ajuda e revelação progressiva**: texto explicativo longo vai para `HelpTip` ou `<details>`; o painel mostra só o essencial da etapa. Balões e disclosures precisam funcionar por teclado e toque (`focus-visible`, `Escape`, `aria-expanded`).
- **Undo em uma ação só**: ao criar ações que mexem em vários campos (ex.: `enableAllFinishes`), usar **um único `set`** para gerar um único passo de undo; nunca encadear vários setters.
- **Autosave e seleção**: qualquer rotina que capture o canvas (capas) deve preservar `selectedIds`, `editingId` e **nunca restaurar `step`** — a usuária pode ter mudado de etapa durante a captura.
- **Seletores e2e são contrato**: `e2e/helpers.ts` centraliza os rótulos de criação que mudam com o estado da home. Ao renomear botões usados por specs, atualizar o helper e as asserções correspondentes; não "afrouxar" testes para passar.
- **Sem `any` / sem `as T` forçado**, sem placeholders, sem dependência nova quando a biblioteca padrão resolve; comentários só para regra de negócio, exceção de segurança ou decisão não óbvia.
