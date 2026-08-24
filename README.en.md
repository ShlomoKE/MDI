# MDI — Inference Infrastructure Sizing Model

For mixed human and agent loads.
**A proposal by Shlomo Kalach**, 2026.

### → **[Read MDI](https://mdi.kesheratmex.workers.dev/en/)** · **[Leer en español](https://mdi.kesheratmex.workers.dev/)**

The full document and the calculator live on the site. This README explains
**what** MDI is and lays out the equations; the **why** —the derivation, the
diagrams, the regimes— is over there.

*[Léelo en español → `README.md`](README.md)*

## What this is

MDI answers two symmetric questions about serving a language model:

- Given a load —users, agents, context, SLO—, **how much hardware does it take?**
- Given the hardware you already have, **how much load does it cover?**

The answer does not come from a rule of thumb but from **three budgets
competing over the same GPU**: how many bytes fit in VRAM, how many bytes can be
moved within the time the user tolerates, and how many multiplications fit in
that same time. The result is always the most restrictive of the three, and
**which of the three is in charge matters as much as the number itself**: if
memory rules, you need more VRAM or less context; if latency rules, more
bandwidth —and adding VRAM buys nothing—; if compute rules, only a smaller model
or more units help.

## Why it exists

Because of the **mixed loads** part, which is where the usual calculations break
down. A human and an agent are nowhere near the same unit of demand: the human
types, waits and reads —generating maybe 15 % of the time, with a few thousand
tokens of context—; the agent chains tool calls without pausing and drags along
the whole conversation plus the results of every call —it can be generating 95 %
of the time with tens of thousands of tokens on its back—.

With the default values, **a single agent costs as much as 63 users**. Forty
coding agents weigh more than two thousand people using a chat. Treating the two
as the same session is the mistake that leaves a sizing exercise short by an
order of magnitude, and much of the model exists to put a number on that
difference.

## The site

The repository publishes a single-page site that combines the technical document
—where the equations are derived— with a calculator that applies them. It exists
in **Spanish (`/`) and English (`/en/`)**: each language is a complete,
prerendered page, not a variant switched on the fly, so the link you share opens
in the language you read it in.

Every calculation happens in the browser. There is no backend, no database and
no telemetry; the configuration travels in the query string, so **a link is
enough to share a specific scenario**.

## The equations

What follows is the **what**: the formulas, with one line on what each one means.
**The why —the derivation, where every term comes from, the diagrams, the
regimes and the limitations— is on the page, not here.** The README teaches the
what; the page teaches the why.

### Unit conventions

Inside the engine everything is SI: bytes, bytes/s, FLOP/s, seconds. Two details
worth keeping in mind so the formulas hold no surprises:

- **$N$ is in billions of parameters** —Qwen3.5-27B is `N = 27`, not
  `N = 27000000000`—, which is the convention of the code and of the catalogs.
  That is why the factor $10^{9}$ appears **explicitly in every compute
  equation**: without it they are not dimensionally correct, and the regime
  crossings land around a millionth of a token instead of the real ~1300.
- VRAM is counted in gibibytes ($1024^3$) and bandwidth in decimal gigabytes
  ($10^{9}$), which is how each vendor publishes them.

| Symbol | What it is |
| --- | --- |
| $N$ | model parameters, in billions |
| $b_w$, $b_{kv}$ | bytes per parameter and per cache value, given the quantization |
| $L_a$ | layers that generate KV cache — **not** the total layer count |
| $H$, $d_k$ | KV heads and dimension per head |
| $V_t$, $O$ | GPU VRAM and inference engine overhead, in bytes |
| $W$, $F$ | **effective** bandwidth and FLOPS: the nominal figure times the factor $\eta$ |
| $\mathrm{SLO}$ | the maximum acceptable TPOT, in seconds |
| $U$, $D$, $C$ | registered sessions, duty cycle and average context of a population |
| $B$, $G$ | batch per GPU and number of GPUs |

### What takes up the GPU

$$
P_m = N \cdot 10^{9} \cdot b_w
$$

**$P_m$ — the model weights in bytes.** They have to be resident in full, and
they are read back from memory on every token generated.

$$
\mathrm{KV}_t = 2 \cdot L_a \cdot H \cdot d_k \cdot b_{kv}
$$

**$\mathrm{KV}_t$ — what one token of context costs, in bytes.** The 2 is key and
value; $L_a$ is the layers that do attention, and that is where almost all the
difference between two models of the same size lives: a dense 27B spends 92 KB
per context token, a 27B hybrid spends 32 KB.

### The two phases of a request

$$
\mathrm{TTFT} = \frac{2 \cdot N \cdot 10^{9} \cdot T_{\text{in}}}{F}
$$

**TTFT — *time to first token*: the time the user spends staring at an empty
screen.** Prefill processes the $T_{\text{in}}$ prompt tokens in parallel and
saturates the Tensor Cores: it is a compute problem, and it scales with the
length of the prompt.

$$
\mathrm{TPOT} = \max\left( \frac{P_m + B \cdot C \cdot \mathrm{KV}_t}{W},\ \frac{2 N 10^{9} B}{F} \right)
$$

**TPOT — *time per output token*: the time between two tokens on screen.** It is
the metric that pins down the hardware. A maximum and not a sum, because reading
memory and multiplying happen at the same time in different units of the chip:
the step takes as long as the slower one. With $B = 1$ and negligible context
you are left with the theoretical floor $P_m / W$, which no serving optimization
gets below.

### The three ceilings

$$
\mathrm{KV}_{\max}^{\text{mem}} = V_t - P_m - O
$$

**Memory: the cache bytes that physically fit**, with the weights and the
overhead already discounted. If it comes out negative, the model does not fit on
that GPU.

$$
\mathrm{KV}_{\max}^{\text{lat}} = \mathrm{SLO} \cdot W - P_m
$$

**Latency: the cache bytes that can be read within the SLO.** The weights have
already eaten $P_m$ of that budget. If it comes out negative, the SLO is
unreachable on that GPU however much VRAM is left over.

$$
B_{\text{comp}} = \frac{\mathrm{SLO} \cdot F}{2 N \cdot 10^{9}}
$$

**Compute: the largest batch the Tensor Cores sustain within the SLO.** This
ceiling does not bound bytes but **sequences** — which is why the three cannot be
added or averaged: each one is compared against demand in its own unit.

### Demand

$$
A = U \cdot D
\qquad
\mathrm{KV}_{\text{total}} = \mathrm{KV}_t \cdot \left( U_h D_h C_h + U_a D_a C_a \right)
$$

**Sessions that are generating at any given instant, and the cache bytes they
demand between them all.** A registered user consumes nothing while reading.

$$
\kappa = \frac{D_a \cdot C_a}{D_h \cdot C_h}
$$

**$\kappa$ — how many users an agent costs.** It is the number to keep in your
head when planning, and also the slope of the trade-off frontier: every agent
added to the plan evicts $\kappa$ users.

### How many GPUs

$$
G_{\text{mem}} = \frac{\mathrm{KV}_{\text{total}}}{V_t - P_m - O}
\qquad
G_{\text{lat}} = \frac{\mathrm{KV}_{\text{total}}}{\mathrm{SLO} \cdot W - P_m}
\qquad
G_{\text{comp}} = \frac{A}{B_{\text{comp}}}
$$

$$
G = \max\left(1,\ \left\lceil \max\left(G_{\text{mem}},\ G_{\text{lat}},\ G_{\text{comp}}\right) \right\rceil \right)
$$

**Each constraint demands a minimum number of GPUs on its own; the result is the
worst of the three**, rounded up and with a floor of one unit. Whichever
dominates is the bottleneck the calculator reports. Once $G$ is decided, the
actual batch per GPU is $B = A / G$ and the achieved TPOT comes out of the same
equation above, usually below the SLO because the rounding hands you slack.

### Where the regime changes

$$
C_{\text{eq}1} = \frac{\left(\mathrm{SLO} \cdot W - P_m\right) \cdot 2 N \cdot 10^{9}}{\mathrm{SLO} \cdot F \cdot \mathrm{KV}_t}
$$

**$C_{\text{eq}1}$ — the context where compute and latency meet.** Below it the
system is a compute problem; above it the cache dominates the traffic.

$$
C_{\text{eq}3} = \frac{\left(V_t - P_m - O\right) \cdot 2 N \cdot 10^{9}}{\mathrm{SLO} \cdot F \cdot \mathrm{KV}_t}
$$

**$C_{\text{eq}3}$ — the same jump, measured against the memory ceiling.**
Whichever comes first is the real one. The crossing between memory and latency is
direct, because both bound bytes, and does not depend on context at all: memory
rules when $V_t - P_m - O \le \mathrm{SLO} \cdot W - P_m$.

> **There are two regimes, not three**, and the page explains why. It also
> explains where the efficiency factor $\eta = 0.5$ that discounts $W$ and $F$
> comes from, how capacity mode is solved, how to read the charts and what falls
> outside the model. None of that fits in a README.

## Provenance

For the sake of rigor, and because it is what published work ought to declare:

- **The research, the model and the derivation of the equations are Shlomo
  Kalach's own work**, done by hand.
- **The text was rewritten with the help of an LLM** so that it reads better. The
  technical content, the decisions and the judgment calls are his.
- **The site —the code, the components, the calculator— was transcribed and built
  by Claude** from that research.
- None of this is hidden: it is stated here, at the top, and not in a footnote.

The guarantee that the transcription did not change the math is mechanical, not a
promise: **`motor.py` is the source of truth** and `src/lib/motor.ts` is a direct
port —same formulas, same order of operations, same names—. Python and JavaScript
share 64-bit floating point, so **250 scenarios generated from Python verify the
parity with exact floating-point equality**, not with a tolerance. If the port
drifts, the tests fail.

## License and citation

Everything in this repository —**the model, the equations, the document text and
the code**— is released under **Creative Commons Attribution 4.0 International
(CC BY 4.0)**. The full license text is in [`LICENSE`](LICENSE), and the
attribution summary in [`NOTICE.md`](NOTICE.md).

You may copy, modify and use it for any purpose, commercial included, as long as
you give credit:

> Kalach, S. (2026). *MDI — Inference Infrastructure Sizing Model for mixed
> human and agent loads*. https://github.com/ShlomoKE/MDI

`CITATION.cff` makes GitHub show the **Cite this repository** button with those
same details, and the *How to cite* section of the site carries ready-to-paste
formats.

## Running the math and the tests

```
python motor.py                      # the reference output
python scripts/generar_referencia.py # freezes 250 scenarios into src/lib/referencia.json
npm test                             # compares the port against those 250 cases
```

If you touch a formula in `motor.py`, **regenerate the reference and run the
tests again**. The calculator starts up in exactly the scenario that
`python motor.py` prints —Qwen3.5-27B, 2000 users, 40 agents, a 30 ms SLO, 4 GB
of overhead, efficiency 0.5— so the two can be compared without touching a single
field.

The tests are split across three files: `motor.test.ts` (parity with Python and
model invariants), `formato.test.ts` (the SVG palette tied to the CSS tokens and
WCAG AA contrast) and `App.test.tsx` (mounts the whole page in jsdom and fails if
anything writes to the console).

## Development

```
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # client + server + prerender, output in dist/
npm run preview    # serves dist/ locally
```

Two further checks live in `scripts/` and do not run under `npm test` because
they need a real Chrome and the site already built:

```
npm run build
npx vite preview --port 4173 --strictPort     # in another terminal

npm i -D --no-save chrome-launcher puppeteer-core
node scripts/e2e.mjs                          # 13 checks in Chrome
node scripts/comparar.mjs                     # the acceptance criterion

npm i -D --no-save lighthouse chrome-launcher
node scripts/lighthouse.mjs http://localhost:4173/ mobile
node scripts/lighthouse.mjs http://localhost:4173/ desktop
```

`scripts/comparar.mjs` runs `python motor.py`, reads the table the site paints in
a real Chrome and compares the two cell by cell, including the messages for
unviable GPUs: the tests already verify engine parity with exact equality, and
this verifies the last stretch, the one that goes from the engine to the pixels.

Those dependencies are deliberately kept out of `package.json`: they drag in the
entire puppeteer tree and with it a couple of dozen security advisories that have
no business living in a static site.

## Structure

```
motor.py                        source of truth for the math
scripts/
  generar_referencia.py         freezes motor.py's output as a fixture
  prerender.mjs                 generates dist/index.html and dist/en/index.html
  e2e.mjs, comparar.mjs         checks in a real Chrome
  lighthouse.mjs                the performance measurements
plugins/
  rehype-katex-compacto.mjs     collapses each equation into a single HTML node
src/
  lib/
    motor.ts        direct port of motor.py, with no UI logic
    motor.test.ts   exact parity + theoretical TPOT + bottlenecks + mode consistency
    referencia.json the 250 scenarios generated from Python
    catalogos.ts    reference GPUs and models, editable by the user
    resultados.ts   joins the UI state to the engine
    formato.ts      presentation layer: the only one that leaves SI units
    urlEstado.ts    state serialization in the query string
    csv.ts          table export
  i18n/
    idioma.ts       the two languages and their routes (/ and /en/)
    textos.ts       every interface string, in both languages
    contexto.tsx    the active language, fixed once per page
    cuello.ts       the visible name of each constraint
  contenido/
    documento.mdx     the Spanish text, with KaTeX and interleaved components
    documento.en.mdx  the same document in English
  components/
    Calculadora.tsx         the complete calculator
    SeccionCalculadora.tsx  mounts it only when the reader gets close
    GraficaPareto.tsx       cost against latency (sizing mode)
    GraficaFrontera.tsx     agent/user frontier (capacity mode)
    TablaGPUs.tsx           a table on desktop, stacked cards on mobile
    BarrasPresion.tsx       the three constraints side by side
    EditorCatalogo.tsx      add, edit and delete GPUs and models
    Campos.tsx              accessible form pieces
    EntradaNumerica.tsx     a numeric field that does not destroy what you type
    Ecuacion.tsx            LaTeX with KaTeX, loaded on demand
    Diagramas.tsx           the document's SVGs
    Navegacion.tsx          sections that highlight the active one on scroll
    SelectorIdioma.tsx      the language switch, which is a link and not a state
    Cita.tsx                the citation formats, with the URL you are reading at
  entry-server.tsx  prerender entry point, once per language
  App.tsx
```

Stack: Vite + React + TypeScript + Tailwind CSS. The charts are hand-drawn SVG
—no charting library—. The equations in the document are resolved by
`rehype-katex` at build time, so they need no JavaScript to show up; KaTeX is
only downloaded if the calculator has to render a formula live.

## Performance

**Latest measurements** (Lighthouse, production build served locally):

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile, Spanish | 96 | 100 | 100 | 100 |
| Mobile, English | 95 | 100 | 100 | 100 |
| Desktop | 99 | 100 | 100 | 100 |

Five things hold that up, and all of them came out of measuring, not guessing.
Best not to undo them without measuring again:

1. **`content-visibility`** on the document blocks: they are 14,000 px tall and
   more than three thousand KaTeX elements. Measured: 1026 ms of *style &
   layout* with the rule, 2100–3300 ms without it.
2. **`plugins/rehype-katex-compacto.mjs`**, which collapses each equation into a
   single node instead of letting React build a hundred elements per formula.
3. **The prerender** (`src/entry-server.tsx` + `scripts/prerender.mjs`): the HTML
   arrives ready to paint and the browser hydrates on top of it. It brought
   main-thread blocking down from 310 ms to under 100.
4. **Preloading the four header fonts**, injected by the prerender script itself.
   Without it the browser does not discover them until it parses the CSS —three
   round trips in series— and the first paint splits in two: 1.7 s when they
   arrived in time, 2.6 s when they did not.
5. **`modulePreload: false`**: with the page already prerendered, JavaScript is
   not needed to paint, so preloading it only stole bandwidth from the CSS, which
   does block.

Two things that were tried and **made it worse**, so nobody retries them blind:
pulling KaTeX's CSS out into a separate sheet loaded afterwards (its `@font-face`
rules use `font-display: block`, so arriving late relayouts equations that were
already painted: LCP from 2.9 s to 3.1 s and twice the blocking), and stripping
the MathML out of KaTeX's output, which would save almost a thousand elements in
exchange for leaving the equations inaccessible to screen readers.

### The two languages

The site is published in Spanish (`/`) and English (`/en/`). They are not one
page switching language on the fly: they are **two complete, prerendered
pages**, each with its own HTML, `<title>` and citation metadata. Search engines
index both, a shared link opens in the language it was read in, and the citation
points at the right version.

- Interface text lives in `src/i18n/textos.ts`, both languages side by side.
  TypeScript requires the English object to have exactly the same keys as the
  Spanish one, so an untranslated string breaks the build.
- The document is two MDX files: `documento.mdx` and `documento.en.mdx`.
- The values the engine returns —`"memoria"`, `"latencia"`, `"computo"`, and the
  reason a GPU does not work— are **never translated**: they are data, they go
  into the CSV and the parity tests compare them. What gets translated is how
  they are displayed. See `src/i18n/motivo.ts`.

## What the model does not account for

The site develops this in its limitations section, but it bears repeating here:
MDI is a first-order bound, not a simulator. It does not model **prefix caching**
—so it oversizes when agents share a system prompt—, **MoE models** —the formula
assumes every parameter is read per token—, **tensor parallelism** —it assumes
one full replica per GPU—, **demand variability** —it uses averages; peaks need
slack— or **chunked prefill**. Duty cycles are pinned to the worst case and
prices are indicative, not a quote.

Even so, it gets right what actually has to be decided: which constraint rules,
what order of magnitude of hardware it takes, and how much each agent added to
the plan costs in users.
