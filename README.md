# MDI — Modelo de Dimensionamiento de Infraestructura de Inferencia

Para cargas mixtas de usuarios y agentes.
**Una propuesta de Shlomo Kalach**, 2026.

### → **[Leer MDI](https://mdi.kesheratmex.workers.dev/)** · **[Read it in English](https://mdi.kesheratmex.workers.dev/en/)**

El documento completo y la calculadora están en el sitio. Este README explica
**qué** es MDI y enseña las ecuaciones; el **porqué** —la derivación, los
diagramas, los regímenes— está allí.

*[Read this in English → `README.en.md`](README.en.md)*

## Qué es esto

MDI responde dos preguntas simétricas sobre servir un modelo de lenguaje:

- Dada una carga —usuarios, agentes, contexto, SLO—, **¿cuánto hardware hace falta?**
- Dado el hardware que ya tienes, **¿para cuánta carga alcanza?**

La respuesta no sale de una regla de dedo, sino de **tres presupuestos que
compiten sobre la misma GPU**: cuántos bytes caben en la VRAM, cuántos bytes se
alcanzan a mover dentro del tiempo que el usuario tolera, y cuántas
multiplicaciones caben en ese mismo tiempo. El resultado es siempre el más
restrictivo de los tres, y **cuál de los tres manda importa tanto como el
número**: si manda memoria, hace falta más VRAM o menos contexto; si manda
latencia, más ancho de banda —y agregar VRAM no sirve de nada—; si manda
cómputo, solo ayudan un modelo más chico o más unidades.

## Por qué existe

Por la parte de **cargas mixtas**, que es donde los cálculos habituales se
rompen. Un humano y un agente no son la misma unidad de demanda ni por asomo: el
humano escribe, espera y lee —genera quizá el 15 % del tiempo, con unos miles de
tokens de contexto—; el agente encadena llamadas a herramientas sin pausas y
arrastra la conversación completa más los resultados de cada una —puede estar
generando el 95 % del tiempo con decenas de miles de tokens encima—.

Con los valores por defecto, **un solo agente cuesta lo que 63 usuarios**.
Cuarenta agentes de código pesan más que dos mil personas usando un chat.
Tratar a los dos como la misma sesión es el error que deja un dimensionamiento
corto por un orden de magnitud, y buena parte del modelo existe para poner
número a esa diferencia.

## El sitio

El repositorio publica un sitio de una sola página que combina el documento
técnico —donde se derivan las ecuaciones— con una calculadora que las aplica.
Existe en **español (`/`) y en inglés (`/en/`)**: cada idioma es una página
completa y prerenderizada, no una variante que se cambia al vuelo, así que el
enlace que compartes abre en el idioma en que lo leíste.

Todo el cálculo ocurre en el navegador. No hay backend, ni base de datos, ni
telemetría; la configuración viaja en la query string, así que **un enlace basta
para compartir un escenario concreto**.

## Las ecuaciones

Lo que sigue es el **qué**: las fórmulas, con una línea de qué significa cada
una. **El porqué —la derivación, de dónde sale cada término, los diagramas, los
regímenes y las limitaciones— está en la página, no aquí.** El README enseña el
qué; la página enseña el porqué.

### Convenciones de unidades

Dentro del motor todo es SI: bytes, bytes/s, FLOP/s, segundos. Dos detalles que
hay que tener presentes para leer las fórmulas sin sorpresas:

- **$N$ está en miles de millones de parámetros** —el Qwen3.5-27B es `N = 27`,
  no `N = 27000000000`—, que es la convención del código y de los catálogos. Por
  eso el factor $10^{9}$ aparece **explícito en todas las ecuaciones de
  cómputo**: sin él no son dimensionalmente correctas, y los cruces de régimen
  salen del orden de una millonésima de token en vez de los ~1300 reales.
- La VRAM se cuenta en gibibytes ($1024^3$) y el ancho de banda en gigabytes
  decimales ($10^{9}$), que es como los publica cada fabricante.

| Símbolo | Qué es |
| --- | --- |
| $N$ | parámetros del modelo, en miles de millones |
| $b_w$, $b_{kv}$ | bytes por parámetro y por valor de caché, según la cuantización |
| $L_a$ | capas que generan caché KV — **no** las capas totales |
| $H$, $d_k$ | cabezas de KV y dimensión por cabeza |
| $V_t$, $O$ | VRAM de la GPU y overhead del motor de inferencia, en bytes |
| $W$, $F$ | ancho de banda y FLOPS **efectivos**: el nominal por el factor $\eta$ |
| $\mathrm{SLO}$ | el TPOT máximo aceptable, en segundos |
| $U$, $D$, $C$ | sesiones registradas, duty cycle y contexto promedio de una población |
| $B$, $G$ | lote por GPU y número de GPUs |

### Lo que ocupa la GPU

$$
P_m = N \cdot 10^{9} \cdot b_w
$$

**$P_m$ — el peso del modelo en bytes.** Tiene que estar residente entero, y se
vuelve a leer de memoria en cada token generado.

$$
\mathrm{KV}_t = 2 \cdot L_a \cdot H \cdot d_k \cdot b_{kv}
$$

**$\mathrm{KV}_t$ — lo que cuesta un token de contexto, en bytes.** El 2 son
clave y valor; $L_a$ son las capas que hacen atención, y ahí está casi toda la
diferencia entre dos modelos del mismo tamaño: un denso de 27B gasta 92 KB por
token de contexto, un híbrido de 27B gasta 32 KB.

### Las dos fases de una petición

$$
\mathrm{TTFT} = \frac{2 \cdot N \cdot 10^{9} \cdot T_{\text{in}}}{F}
$$

**TTFT — *time to first token*: lo que el usuario pasa mirando una pantalla
vacía.** El prefill procesa los $T_{\text{in}}$ tokens del prompt en paralelo y
satura los Tensor Cores: es un problema de cómputo, y escala con la longitud del
prompt.

$$
\mathrm{TPOT} = \max\left( \frac{P_m + B \cdot C \cdot \mathrm{KV}_t}{W},\ \frac{2 N 10^{9} B}{F} \right)
$$

**TPOT — *time per output token*: el tiempo entre dos tokens en la pantalla.** Es
la métrica que fija el hardware. Un máximo y no una suma, porque leer memoria y
multiplicar ocurren a la vez en unidades distintas del chip: el paso tarda lo que
tarde la más lenta. Con $B = 1$ y contexto despreciable queda el piso teórico
$P_m / W$, que ninguna optimización de servicio baja.

### Los tres techos

$$
\mathrm{KV}_{\max}^{\text{mem}} = V_t - P_m - O
$$

**Memoria: los bytes de caché que caben físicamente**, ya descontados los pesos y
el overhead. Si sale negativo, el modelo no cabe en esa GPU.

$$
\mathrm{KV}_{\max}^{\text{lat}} = \mathrm{SLO} \cdot W - P_m
$$

**Latencia: los bytes de caché que se alcanzan a leer dentro del SLO.** Los pesos
ya se comieron $P_m$ de ese presupuesto. Si sale negativo, el SLO es inalcanzable
en esa GPU aunque le sobre VRAM.

$$
B_{\text{comp}} = \frac{\mathrm{SLO} \cdot F}{2 N \cdot 10^{9}}
$$

**Cómputo: el lote máximo que los Tensor Cores sostienen dentro del SLO.** Este
techo no acota bytes sino **secuencias** — por eso los tres no se pueden sumar ni
promediar: cada uno se compara contra la demanda en su propia unidad.

### La demanda

$$
A = U \cdot D
\qquad
\mathrm{KV}_{\text{total}} = \mathrm{KV}_t \cdot \left( U_h D_h C_h + U_a D_a C_a \right)
$$

**Sesiones que están generando en un instante cualquiera, y los bytes de caché
que exigen entre todas.** Un usuario registrado no consume nada mientras lee.

$$
\kappa = \frac{D_a \cdot C_a}{D_h \cdot C_h}
$$

**$\kappa$ — cuántos usuarios cuesta un agente.** Es el número que hay que tener
en la cabeza al planear, y también la pendiente de la frontera de intercambio:
cada agente que se agrega al plan desaloja $\kappa$ usuarios.

### Cuántas GPUs

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

**Cada restricción exige por su cuenta un mínimo de GPUs; el resultado es la peor
de las tres**, redondeada hacia arriba y con un piso de una unidad. La que domina
es el cuello de botella que la calculadora reporta. Con $G$ decidido, el lote
real por GPU es $B = A / G$ y el TPOT logrado sale de la misma ecuación de
arriba, normalmente por debajo del SLO porque el redondeo regala holgura.

### Dónde cambia el régimen

$$
C_{\text{eq}1} = \frac{\left(\mathrm{SLO} \cdot W - P_m\right) \cdot 2 N \cdot 10^{9}}{\mathrm{SLO} \cdot F \cdot \mathrm{KV}_t}
$$

**$C_{\text{eq}1}$ — el contexto donde cómputo y latencia se igualan.** Por debajo
el sistema es un problema de cómputo; por encima, el caché domina el tráfico.

$$
C_{\text{eq}3} = \frac{\left(V_t - P_m - O\right) \cdot 2 N \cdot 10^{9}}{\mathrm{SLO} \cdot F \cdot \mathrm{KV}_t}
$$

**$C_{\text{eq}3}$ — el mismo salto, medido contra el techo de memoria.** El que
ocurre antes es el real. El cruce entre memoria y latencia es directo, porque
ambos acotan bytes, y no depende del contexto en absoluto: manda memoria cuando
$V_t - P_m - O \le \mathrm{SLO} \cdot W - P_m$.

> **Los regímenes son dos, no tres**, y la página explica por qué. También
> explica de dónde sale el factor de eficiencia $\eta = 0.5$ que descuenta $W$ y
> $F$, cómo se despeja el modo capacidad, cómo leer las gráficas y qué queda
> fuera del modelo. Nada de eso cabe en un README.

## Procedencia

Por rigor, y porque es lo que corresponde declarar en un trabajo que se publica:

- **La investigación, el modelo y la derivación de las ecuaciones son trabajo
  propio de Shlomo Kalach**, hechos a mano.
- **El texto se reescribió con ayuda de un LLM** para que se lea mejor. El
  contenido técnico, las decisiones y los criterios son suyos.
- **El sitio —el código, los componentes, la calculadora— lo transcribió y
  construyó Claude** a partir de esa investigación.
- Nada de esto se esconde: se dice aquí, arriba, y no en una nota al pie.

La garantía de que la transcripción no cambió la matemática es mecánica, no una
promesa: **`motor.py` es la fuente de verdad** y `src/lib/motor.ts` es un puerto
directo —mismas fórmulas, mismo orden de operaciones, mismos nombres—. Python y
JavaScript comparten el flotante de 64 bits, así que **250 escenarios generados
desde Python verifican la paridad con igualdad exacta de punto flotante**, no con
tolerancia. Si el puerto se desvía, las pruebas fallan.

## Licencia y cita

Todo lo que hay en este repositorio —**el modelo, las ecuaciones, el texto del
documento y el código**— se publica bajo **Creative Commons Attribution 4.0
International (CC BY 4.0)**. El texto completo de la licencia está en
[`LICENSE`](LICENSE), y el resumen de atribución en [`NOTICE.md`](NOTICE.md).

Puedes copiarlo, modificarlo y usarlo con cualquier fin, incluido el comercial,
siempre que des crédito:

> Kalach, S. (2026). *MDI — Modelo de Dimensionamiento de Infraestructura de
> Inferencia para cargas mixtas de usuarios y agentes*.
> https://github.com/ShlomoKE/MDI

`CITATION.cff` hace que GitHub muestre el botón **Cite this repository** con esos
mismos datos, y la sección *Cómo citar* del sitio trae los formatos listos para
pegar.

## Correr la matemática y las pruebas

```
python motor.py                      # la salida de referencia
python scripts/generar_referencia.py # congela 250 escenarios en src/lib/referencia.json
npm test                             # compara el puerto contra esos 250 casos
```

Si tocas una fórmula en `motor.py`, **regenera la referencia y vuelve a correr
las pruebas**. La calculadora arranca exactamente en el escenario que imprime
`python motor.py` —Qwen3.5-27B, 2000 usuarios, 40 agentes, SLO de 30 ms,
overhead de 4 GB, eficiencia 0.5— para que los dos se puedan comparar sin tocar
un solo campo.

Las pruebas se reparten en tres archivos: `motor.test.ts` (paridad con Python e
invariantes del modelo), `formato.test.ts` (la paleta de los SVG atada a los
tokens de CSS y el contraste WCAG AA) y `App.test.tsx` (monta la página entera en
jsdom y falla si algo escribe en la consola).

## Desarrollo

```
npm install
npm run dev        # http://localhost:5173
npm test           # 315 pruebas, en los dos idiomas
npm run build      # cliente + servidor + prerenderizado, sale a dist/
npm run preview    # sirve dist/ localmente
```

Dos verificaciones más viven en `scripts/` y no corren en `npm test` porque
necesitan un Chrome de verdad y el sitio ya construido:

```
npm run build
npx vite preview --port 4173 --strictPort     # en otra terminal

npm i -D --no-save chrome-launcher puppeteer-core
node scripts/e2e.mjs                          # 13 comprobaciones en Chrome
node scripts/comparar.mjs                     # el criterio de aceptación

npm i -D --no-save lighthouse chrome-launcher
node scripts/lighthouse.mjs http://localhost:4173/ mobile
node scripts/lighthouse.mjs http://localhost:4173/ desktop
```

`scripts/comparar.mjs` corre `python motor.py`, lee la tabla que pinta el sitio
en un Chrome real y compara las dos celda por celda, incluidos los mensajes de
las GPUs inviables: las pruebas ya verifican la paridad del motor con igualdad
exacta, y esto verifica el último tramo, el que va del motor a los píxeles.

Esas dependencias están deliberadamente fuera de `package.json`: arrastran el
árbol entero de puppeteer y con él una veintena de avisos de seguridad que no
tienen por qué vivir en un sitio estático.

## Estructura

```
motor.py                        fuente de verdad de la matemática
scripts/
  generar_referencia.py         congela la salida de motor.py como fixture
  prerender.mjs                 genera dist/index.html y dist/en/index.html
  e2e.mjs, comparar.mjs         verificaciones en un Chrome real
  lighthouse.mjs                las mediciones de rendimiento
plugins/
  rehype-katex-compacto.mjs     colapsa cada ecuación en un solo nodo de HTML
src/
  lib/
    motor.ts        puerto directo de motor.py, sin lógica de UI
    motor.test.ts   paridad exacta + TPOT teórico + cuellos + consistencia de modos
    referencia.json los 250 escenarios generados desde Python
    catalogos.ts    GPUs y modelos de referencia, editables por el usuario
    resultados.ts   une el estado de la UI con el motor
    formato.ts      capa de presentación: la única que sale de unidades SI
    urlEstado.ts    serialización del estado en la query string
    csv.ts          exportación de la tabla
  i18n/
    idioma.ts       los dos idiomas y sus rutas (/ y /en/)
    textos.ts       todas las cadenas de la interfaz, en los dos idiomas
    contexto.tsx    el idioma vigente, fijado una vez por página
    cuello.ts       el nombre visible de cada restricción
  contenido/
    documento.mdx     el texto en español, con KaTeX y componentes intercalados
    documento.en.mdx  el mismo documento en inglés
  components/
    Calculadora.tsx         la calculadora completa
    SeccionCalculadora.tsx  la monta solo cuando el lector se acerca
    GraficaPareto.tsx       costo contra latencia (modo dimensionar)
    GraficaFrontera.tsx     frontera agentes/usuarios (modo capacidad)
    TablaGPUs.tsx           tabla en escritorio, tarjetas apiladas en móvil
    BarrasPresion.tsx       las tres restricciones lado a lado
    EditorCatalogo.tsx      agregar, editar y eliminar GPUs y modelos
    Campos.tsx              piezas de formulario accesibles
    EntradaNumerica.tsx     un campo numérico que no destruye lo que tecleas
    Ecuacion.tsx            LaTeX con KaTeX, cargado bajo demanda
    Diagramas.tsx           los SVG del documento
    Navegacion.tsx          secciones con resaltado de la activa al hacer scroll
    SelectorIdioma.tsx      el cambio de idioma, que es un enlace y no un estado
    Cita.tsx                los formatos de cita, con la URL donde se está leyendo
  entry-server.tsx  entrada del prerenderizado, una vez por idioma
  App.tsx
```

Stack: Vite + React + TypeScript + Tailwind CSS. Las gráficas son SVG dibujado a
mano —ninguna librería de charts—. Las ecuaciones del documento las resuelve
`rehype-katex` en tiempo de build, así que no necesitan JavaScript para
mostrarse; KaTeX solo se descarga si la calculadora tiene que renderizar una
fórmula en vivo.

## Rendimiento

**Últimas mediciones** (Lighthouse, build de producción servido en local):

| | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| --- | --- | --- | --- | --- |
| Móvil, español | 96 | 100 | 100 | 100 |
| Móvil, inglés | 95 | 100 | 100 | 100 |
| Escritorio | 99 | 100 | 100 | 100 |

Cinco cosas lo sostienen, y todas salieron de medir, no de suponer. Conviene no
deshacerlas sin volver a medir:

1. **`content-visibility`** sobre los bloques del documento: son 14 000 px de
   alto y más de tres mil elementos de KaTeX. Medido: 1026 ms de *style &
   layout* con la regla, 2100–3300 ms sin ella.
2. **`plugins/rehype-katex-compacto.mjs`**, que colapsa cada ecuación en un solo
   nodo en vez de dejar que React construya cien elementos por fórmula.
3. **El prerenderizado** (`src/entry-server.tsx` + `scripts/prerender.mjs`): el
   HTML llega listo para pintar y el navegador hidrata encima. Bajó el bloqueo
   del hilo principal de 310 ms a menos de 100.
4. **La precarga de las cuatro fuentes del encabezado**, que inyecta el propio
   script de prerenderizado. Sin ella el navegador no las descubre hasta parsear
   el CSS —tres viajes en serie— y el primer pintado se parte en dos: 1.7 s
   cuando llegaban a tiempo, 2.6 s cuando no.
5. **`modulePreload: false`**: con la página ya prerenderizada el JavaScript no
   hace falta para pintar, así que precargarlo solo le quitaba ancho de banda al
   CSS, que sí bloquea.

Dos cosas que se probaron y **empeoraron**, para que nadie las reintente a
ciegas: sacar el CSS de KaTeX a una hoja aparte y cargarla después (sus
`@font-face` usan `font-display: block`, así que al llegar tarde re-maqueta las
ecuaciones ya pintadas: LCP de 2.9 s a 3.1 s y el doble de bloqueo), y quitar el
MathML de la salida de KaTeX, que ahorraría casi mil elementos a cambio de dejar
las ecuaciones inaccesibles para los lectores de pantalla.

### Los dos idiomas

El sitio se publica en español (`/`) y en inglés (`/en/`). No son la misma
página cambiando de idioma al vuelo: son **dos páginas completas y
prerenderizadas**, cada una con su HTML, su `<title>` y sus metadatos de cita.
Así los buscadores indexan las dos, un enlace compartido abre en el idioma en
que se leyó, y la cita apunta a la versión correcta.

- El texto de la interfaz vive en `src/i18n/textos.ts`, con los dos idiomas lado
  a lado. TypeScript exige que el inglés tenga exactamente las mismas claves que
  el español, así que una cadena sin traducir rompe el build.
- El documento son dos archivos MDX: `documento.mdx` y `documento.en.mdx`.
- Los valores que devuelve el motor —`"memoria"`, `"latencia"`, `"computo"`, y
  el motivo por el que una GPU no sirve— **no se traducen nunca**: son datos,
  viajan al CSV y los comparan las pruebas de paridad. Lo que se traduce es cómo
  se muestran. Ver `src/i18n/motivo.ts`.

## Lo que el modelo no contempla

El sitio lo desarrolla en su sección de limitaciones, pero conviene repetirlo
aquí: MDI es una cota de primer orden, no un simulador. No modela **prefix
caching** —por lo que sobredimensiona cuando los agentes comparten system
prompt—, **modelos MoE** —la fórmula supone que se leen todos los parámetros por
token—, **paralelismo tensorial** —asume una réplica completa por GPU—,
**variabilidad de la demanda** —usa promedios; los picos requieren holgura— ni
**chunked prefill**. Los duty cycles están fijados en el peor caso y los precios
son referenciales, no una cotización.

Aun así acierta en lo que hay que decidir: qué restricción manda, qué orden de
magnitud de hardware hace falta, y cuánto cuesta en usuarios cada agente que se
agrega al plan.
