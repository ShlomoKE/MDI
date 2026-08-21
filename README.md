# MDI — Modelo de Dimensionamiento de Infraestructura de Inferencia

Para cargas mixtas de usuarios y agentes.

**Una propuesta de Shlomo Kalach**, 2026. El modelo, la derivación de las
ecuaciones y el criterio de las tres restricciones son suyos. Si lo usas para
algo publicable, hay formatos de cita listos en la sección *Cómo citar* del
propio sitio, y `CITATION.cff` hace que GitHub muestre el botón **Cite this
repository**:

> Kalach, S. (2026). *MDI — Modelo de Dimensionamiento de Infraestructura de
> Inferencia para cargas mixtas de usuarios y agentes*.

Sitio de una sola página que combina un documento técnico y una calculadora
interactiva: dadas una carga (usuarios, agentes, contexto, SLO) y un catálogo de
GPUs, calcula cuánto hardware hace falta —o para cuánta carga alcanza el que ya
tienes— aplicando las tres restricciones de memoria, latencia y cómputo.

Todo el cálculo ocurre en el navegador. No hay backend, ni base de datos, ni
telemetría; la configuración viaja en la query string, así que un enlace basta
para compartir un escenario concreto.

## La matemática

**`motor.py` es la fuente de verdad.** `src/lib/motor.ts` es un puerto directo:
mismas fórmulas, mismo orden de operaciones, mismos nombres. Python y JavaScript
comparten el flotante de 64 bits, así que los dos motores devuelven bit a bit lo
mismo, y las pruebas lo verifican con igualdad exacta —no con tolerancia— sobre
250 escenarios generados desde Python.

```
python motor.py                      # la salida de referencia
python scripts/generar_referencia.py # congela 250 escenarios en src/lib/referencia.json
npm test                             # compara el puerto contra esos 250 casos
```

Si tocas una fórmula en `motor.py`, regenera la referencia y vuelve a correr las
pruebas. Si el puerto se desvía, fallan.

La calculadora arranca exactamente en el escenario que imprime `python motor.py`
—Qwen3.5-27B, 2000 usuarios, 40 agentes, SLO de 30 ms, overhead de 4 GB,
eficiencia 0.5— para que los dos se puedan comparar sin tocar un solo campo.

## Estructura

```
motor.py                      fuente de verdad de la matemática
scripts/generar_referencia.py congela la salida de motor.py como fixture
src/
  lib/
    motor.ts        puerto directo de motor.py, sin lógica de UI
    motor.test.ts   paridad exacta + TPOT teórico + cuellos + consistencia de modos
    catalogos.ts    GPUs y modelos de referencia, editables por el usuario
    resultados.ts   une el estado de la UI con el motor
    formato.ts      capa de presentación: la única que sale de unidades SI
    urlEstado.ts    serialización del estado en la query string
    csv.ts          exportación de la tabla
  components/
    Calculadora.tsx    la calculadora completa
    GraficaPareto.tsx  costo contra latencia (modo dimensionar)
    GraficaFrontera.tsx frontera agentes/usuarios (modo capacidad)
    TablaGPUs.tsx      tabla en escritorio, tarjetas apiladas en móvil
    BarrasPresion.tsx  las tres restricciones lado a lado
    EditorCatalogo.tsx agregar, editar y eliminar GPUs y modelos
    Ecuacion.tsx       LaTeX con KaTeX, cargado bajo demanda
    Diagramas.tsx      los SVG del documento
    Navegacion.tsx     secciones con resaltado de la activa al hacer scroll
  contenido/
    documento.mdx   el texto, con ecuaciones en KaTeX y componentes intercalados
  App.tsx
```

## Desarrollo

```
npm install
npm run dev        # http://localhost:5173
npm test           # 303 pruebas
npm run build      # sale a dist/
npm run preview    # sirve dist/ localmente
```

Las pruebas se reparten en tres archivos: `motor.test.ts` (paridad con Python e
invariantes del modelo), `formato.test.ts` (la paleta de SVG atada a los tokens
de CSS y el contraste WCAG AA) y `App.test.tsx` (monta la página entera en jsdom
y falla si algo escribe en la consola).

Dos verificaciones más viven en `scripts/` y no corren en `npm test` porque
necesitan un Chrome de verdad y el sitio ya construido:

```
npm run build
npx vite preview --port 4173 --strictPort     # en otra terminal

npm i -D --no-save chrome-launcher puppeteer-core
node scripts/e2e.mjs                          # 13 comprobaciones en Chrome

npm i -D --no-save lighthouse chrome-launcher
node scripts/lighthouse.mjs http://localhost:4173/ mobile
node scripts/lighthouse.mjs http://localhost:4173/ desktop

node scripts/comparar.mjs                     # el criterio de aceptación
```

`scripts/comparar.mjs` es el criterio de aceptación automatizado: corre
`python motor.py`, lee la tabla que pinta el sitio en un Chrome real y compara
las dos celda por celda, incluidos los mensajes de las GPUs inviables. Las
pruebas ya verifican la paridad del motor con igualdad exacta; esto verifica el
último tramo, el que va del motor a los píxeles.

Esas dependencias están deliberadamente fuera de `package.json`: arrastran el
árbol entero de puppeteer y con él una veintena de avisos de seguridad que no
tienen por qué vivir en un sitio estático.

**Últimas mediciones** (Lighthouse, build de producción servido en local):

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| --- | --- | --- | --- | --- |
| Móvil | 93 | 100 | 100 | 100 |
| Escritorio | 99 | 100 | 100 | 100 |

Cinco cosas sostienen ese rendimiento y conviene no deshacerlas sin volver a
medir. Todas salieron de medir, no de suponer:

1. **`content-visibility`** sobre los bloques del documento. Son 14 000 px de
   alto y más de tres mil elementos de KaTeX; sin esto el navegador recalcula
   estilo y layout de todo el artículo cada vez que llega una fuente. Medido:
   1 026 ms de *style & layout* con la regla, 2 100–3 300 ms sin ella.
2. **`plugins/rehype-katex-compacto.mjs`**, que colapsa cada ecuación en un solo
   nodo con `dangerouslySetInnerHTML` en vez de dejar que React construya cien
   elementos por fórmula.
3. **El prerenderizado** (`src/entry-server.tsx` + `scripts/prerender.mjs`): el
   HTML llega listo para pintar y el navegador hidrata encima. Bajó el bloqueo
   del hilo principal de 310 ms a menos de 100.
4. **La precarga de las cuatro fuentes del encabezado**, que inyecta el propio
   script de prerenderizado. El navegador no las descubre hasta parsear el CSS
   —HTML, CSS, fuente: tres viajes en serie—, y eso partía el primer pintado en
   dos: 1.7 s cuando llegaban a tiempo, 2.6 s cuando no.
5. **`modulePreload: false`**: con la página ya prerenderizada el JavaScript no
   hace falta para pintar, así que precargarlo solo le quitaba ancho de banda al
   CSS, que sí bloquea.

Dos cosas que se probaron y **empeoraron**, para que nadie las reintente a
ciegas: sacar el CSS de KaTeX a una hoja aparte y cargarla después (sus
`@font-face` usan `font-display: block`, así que al llegar tarde re-maqueta las
ecuaciones ya pintadas: LCP de 2.9 s a 3.1 s y el doble de bloqueo), y quitar el
MathML de la salida de KaTeX, que ahorraría casi mil elementos a cambio de dejar
las ecuaciones inaccesibles para los lectores de pantalla.

Stack: Vite + React + TypeScript + Tailwind CSS. Las gráficas son SVG dibujado a
mano —ninguna librería de charts—. Las ecuaciones del documento las resuelve
`rehype-katex` en tiempo de build, así que no necesitan JavaScript para
mostrarse; KaTeX solo se descarga si la calculadora tiene que renderizar una
fórmula en vivo.

## Despliegue en Cloudflare

El sitio se publica con **Workers Static Assets**: cada push a `main` dispara un
despliegue automático. No hay código de Worker, solo los archivos que
`npm run build` deja en `dist/`.

**Configuración del proyecto en el panel de Cloudflare:**

| Campo | Valor |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | 22 — ya fijada por `.node-version` y por `engines` en package.json |

Los pasos, una sola vez:

1. Panel de Cloudflare → **Workers & Pages** → **Create** → **Import a repository**.
2. Autoriza GitHub y elige este repositorio.
3. Deja el build command y despliega.

> **Si el repositorio no aparece en la lista**, casi siempre es una de dos cosas.
> La primera: la app de GitHub de Cloudflare se instala con acceso a
> *repositorios seleccionados*, y un repo privado recién creado no entra solo —
> se arregla en <https://github.com/settings/installations> → la app de
> Cloudflare → *Repository access* → **All repositories**, o añadiendo este repo
> a la lista. La segunda: tener varias cuentas de GitHub y estar mirando la que
> no es; el desplegable de cuenta en Cloudflare tiene que ser la dueña del repo.

`public/_headers` acaba en `dist/_headers`, y Static Assets lo interpreta: de ahí
salen el cacheado de los assets con hash, las cabeceras de seguridad y una CSP
que le prohíbe a la página hablar con el exterior —cosa que no necesita hacer,
porque calcula todo localmente—. Ese archivo no se publica como asset, solo se
lee. Ojo con una línea suya: `font-src` necesita `data:` porque Vite incrusta una
de las fuentes de KaTeX como data: URI, y sin eso las ecuaciones con paréntesis
grandes se quedan en blanco **solo en producción** (`vite preview` no aplica
`_headers`).

### Si prefieres Cloudflare Pages

Funciona igual, pero es otro tipo de proyecto y otro `wrangler.toml`. Sustituye
el bloque `[assets]` por:

```toml
pages_build_output_dir = "dist"
```

y crea el proyecto desde **Workers & Pages** → **Create** → **Pages** →
**Connect to Git**, con build `npm run build` y directorio de salida `dist`.
Cloudflare Pages no ejecuta un deploy command: publica `dist` directamente.

## Lo que el modelo no contempla

El sitio lo declara en su sección de limitaciones, pero conviene repetirlo aquí:
no modela **prefix caching** (por lo que sobredimensiona cuando los agentes
comparten system prompt), **modelos MoE** (la fórmula supone que se leen todos
los parámetros por token), **paralelismo tensorial** (asume una réplica completa
por GPU), **variabilidad de la demanda** (usa promedios; los picos requieren
holgura) ni **chunked prefill**. Los duty cycles están fijados en el peor caso y
los precios son referenciales, no una cotización.
