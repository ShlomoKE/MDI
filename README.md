# MDI — Modelo de Dimensionamiento de Infraestructura de Inferencia

Para cargas mixtas de usuarios y agentes.

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
| Móvil | 91–96 | 100 | 100 | 100 |
| Escritorio | 99 | 100 | 100 | 100 |

Tres cosas sostienen ese rendimiento y conviene no deshacerlas sin medir:
`content-visibility` sobre los bloques del documento (son 14 000 px de alto y
más de tres mil elementos de KaTeX), el plugin `plugins/rehype-katex-compacto.mjs`
—que colapsa cada ecuación en un solo nodo con `dangerouslySetInnerHTML` en vez
de dejar que React construya cien elementos por fórmula— y el montaje diferido
de la calculadora en `SeccionCalculadora.tsx`.

Stack: Vite + React + TypeScript + Tailwind CSS. Las gráficas son SVG dibujado a
mano —ninguna librería de charts—. Las ecuaciones del documento las resuelve
`rehype-katex` en tiempo de build, así que no necesitan JavaScript para
mostrarse; KaTeX solo se descarga si la calculadora tiene que renderizar una
fórmula en vivo.

## Despliegue en Cloudflare Pages

El repositorio está pensado para la integración de Git de Cloudflare Pages:
cada push a `main` dispara un despliegue automático.

**Configuración del proyecto en el panel de Cloudflare:**

| Campo | Valor |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 — ya fijada por `.node-version` y por `engines` en package.json |

Los pasos, una sola vez:

1. En el panel de Cloudflare → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Autoriza la cuenta de GitHub y elige este repositorio.
3. Rellena la tabla de arriba y despliega.

> **Si el repositorio no aparece en la lista de Cloudflare**, casi siempre es una
> de dos cosas. La primera: la app de GitHub de *Cloudflare Pages* se instala con
> acceso a *repositorios seleccionados*, y un repo privado recién creado no entra
> solo — se arregla en <https://github.com/settings/installations> → *Cloudflare
> Pages* → *Repository access* → **All repositories**, o añadiendo este repo a la
> lista. La segunda: tener varias cuentas de GitHub y estar mirando la que no es;
> el desplegable de cuenta en Cloudflare tiene que ser la dueña del repositorio.

Desde ahí, cada push a `main` publica solo; las ramas y los pull requests
generan despliegues de vista previa con su propia URL.

`wrangler.toml` está en el repositorio para que `npx wrangler pages deploy`
también funcione desde la terminal si alguna vez hace falta publicar sin pasar
por Git. `public/_headers` fija el cacheado de los assets con hash, las
cabeceras de seguridad y una CSP que le prohíbe a la página hablar con el
exterior —cosa que no necesita hacer, porque calcula todo localmente—.

## Lo que el modelo no contempla

El sitio lo declara en su sección de limitaciones, pero conviene repetirlo aquí:
no modela **prefix caching** (por lo que sobredimensiona cuando los agentes
comparten system prompt), **modelos MoE** (la fórmula supone que se leen todos
los parámetros por token), **paralelismo tensorial** (asume una réplica completa
por GPU), **variabilidad de la demanda** (usa promedios; los picos requieren
holgura) ni **chunked prefill**. Los duty cycles están fijados en el peor caso y
los precios son referenciales, no una cotización.
