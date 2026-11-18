# Take IG Easy - CUSCUZ RECORDS
<small>2.0.0</small>

[![Instagram](https://img.shields.io/badge/Instagram-Cuscuz%20Records-f8ce2b?style=flat-square&logo=instagram&logoColor=white)](https://instagram.com/cuscuzrecords)
[![Online demo](https://img.shields.io/badge/online-demo-f8ce2b?style=flat-square&labelColor=698f3f)](https://contentmaker-cuscuzrecords.vercel.app/)

# TLDR

Take IG Easy (TIE) é uma forma de fazer posts para instagram de maneira simplificada, garantindo um design descente mesmo sendo leigo na área.

A ferramenta é 100% client-side e já vem personalizada com o kit da marca. A curva de aprendizado é baixíssima, a cada atualização a interface fica mais fácil de usar.

Esse repositório é dedicado a uma instância do *Take IG Easy* para a **Cuscuz Records**, um coletivo de música independente da cidade de Fortaleza-CE.

Para rodar localmente, basta clicar em ***iniciar.bat***; vai rodar um script com todos os comandos especificados em [Como rodar localmente](#como-rodar-localmente) e no final abrir seu navegador na url.

---

## Filosofia

1. **Feito para quem quer facilidade.** Até quem tem prática com o Photoshop sabe que às vezes ele é *too much* para criar certas coisas. TIE garante postagens consistentes pra marca, com uma arte nível comercial, sem necessáriamente saber usar editores gráficos ou conceitos de design. Ideal para produção rápida de postagens sem o uso de IA Generativa.

2. **O produto guia as decisões.** Em vez de deixar o usuário escolher entre muitas opções ambiguas (gerando milhões de dúvidas), o sistema orienta as decisões. Dessa forma você garante um design de qualidade, mantendo a liberdade de escolha.

3. **Seguimos na contra-mão dos editores gerais.** Inúmeras funções, ferramentas que servem para mais de uma coisa, configurações avançadas e baixa explicabilidade, são características comuns em editores de utilidade geral. Nosso foco está na criação de conteúdo em imagens, por isso fornecemos apenas as ferramentas necessárias para cumprir esse objetivo, sempre fugindo da ambiguidade em cada passo da criação.

4. **Simples, mas poderoso.** Ter poucas opções não é fraqueza, para o usuário que necessita de praticidade é benefício. Uma interface simplificada não significa baixa qualidade; na verdade isso potencializa a criação de conteúdo para a marca, uma vez que você não se distrai com funcionalidades, efeitos ou extensões que vão quebrando a consistência da marca post após post. 

5. **Auto aprendizado.** O próprio produto guia e ensina o que cada recurso faz no instante em que ele é usado. O entendimento é imediato e a curva de aprendizado tende a ficar cada vez mais baixa.

8. **A experiência vem primeiro.** O sistema conversa com a pessoa, dá retorno sobre qualquer ação, é autoexplicativo e, acima de tudo, busca ser responsivo e funcional. É um produto feito de usuário para usuário.

9. **Tudo no navegador.** Não existe back-end. O usuário cria, remove fundo, salva e exporta sem depender de servidor.

## Funcionalidades

**O que dá pra fazer:**

- **Escolher o fundo** entre os estilos da marca e ajustar o enquadramento.
- **Colocar enfeites** (flores, folhas, ondas, molduras) e a **logo** da gravadora.
- **Adicionar suas fotos**; dá pra arrastar pra folha ou colar com `Ctrl + V`.
- **Recortar o fundo de uma foto** sem sair do navegador (funciona offline depois da primeira vez).
- **Escrever títulos e textos** com a fonte e o efeito da marca já aplicados.
- **Ajustar os acabamentos**: papel amassado, craquelado e granulado.
- **Salvar rascunhos** automaticamente e continuar de onde parou depois.
- **Exportar** em PNG ou, no carrossel, baixar tudo num ZIP.
- **Desfazer e refazer** sem medo de errar.

**Formatos disponíveis:**

| Formato | Tamanho da imagem |
|---|---|
| Vertical (padrão) | 1080 × 1440 |
| Horizontal | 1440 × 1080 |
| Quadrado | 1080 × 1080 |

Também dá pra criar **carrosséis** de até 10 slides.

---

## Como rodar localmente

Antes de começar, tenha o **Node.js 20 ou 22** instalado. O **npm** já vem junto com o Node.

### Forma prática

1. Dê duplo clique em **`iniciar.bat`**.
2. Ele instala as dependências, gera as imagens da marca e abre o navegador sozinho.

O `iniciar.bat` procura uma porta livre entre 5173 e 5180. Para encerrar digita **q** no terminal que abriu.

### Forma manual

Abra um terminal dentro da pasta e rode, nesta ordem:

**1. Instalar as dependências (só na primeira vez)**

```powershell
npm install
```

**2. Preparar as imagens da marca**

```powershell
npm run assets
```

**3. Iniciar o site**

```powershell
npm run dev
```

Depois abra o endereço que aparecer no terminal (algo como `http://localhost:5173`).

**Outros comandos úteis:**

| Comando | Para que serve |
|---|---|
| `npm run test` | Roda os testes das regras do programa |
| `npm run typecheck` | Confere se o TypeScript está sem erros |
| `npm run build` | Monta a versão final para publicar |
| `npm run e2e` | Testa o site de verdade no navegador (rode o `build` antes) |
| `npm run preview` | Mostra a versão final já montada |

---

## FAQ

**Preciso de internet pra usar?** Pra abrir e criar post, não. Só na primeira vez que
usar a remoção de fundo, porque o modelo precisa ser baixado uma vez.

**Por que pede Node 20 ou 22?** É a versão LTS que a gente usa e garante que o Vite e as
ferramentas de teste se comportem igual na sua máquina e na nossa.

**Onde foram parar meus rascunhos?** No navegador que você usou. Se trocar de navegador ou limpar os dados do site, você perde tudo. Por isso existe o **Baixar backup** na home.

---

Feito com carinho pra galera da Cuscuz Records <3
