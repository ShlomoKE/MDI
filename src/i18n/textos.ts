/**
 * Todas las cadenas de la interfaz, en los dos idiomas.
 *
 * Están juntas a propósito, en un solo archivo y con las dos versiones lado a
 * lado: así se ve de un vistazo si algo quedó sin traducir, y TypeScript exige
 * que `en` tenga exactamente las mismas claves que `es` —si añades una cadena
 * en español y te olvidas del inglés, el build falla—.
 *
 * El texto del documento largo NO vive aquí: son dos archivos MDX,
 * `documento.mdx` y `documento.en.mdx`.
 */

import type { Idioma } from "./idioma";

const es = {
  meta: {
    titulo: "MDI — Dimensionamiento de infraestructura de inferencia",
    tituloCita:
      "MDI — Modelo de Dimensionamiento de Infraestructura de Inferencia para cargas mixtas de usuarios y agentes",
    descripcion:
      "MDI: modelo de dimensionamiento de infraestructura de inferencia para cargas mixtas de usuarios y agentes. Memoria, latencia y cómputo deciden cuánto hardware hace falta; incluye calculadora.",
    descripcionCorta:
      "Las tres restricciones que deciden cuánto hardware hace falta para servir un LLM con cargas mixtas de usuarios y agentes, con calculadora.",
    sinJs:
      "Esta página calcula todo en el navegador, así que necesita JavaScript. El documento y la calculadora no se pueden mostrar sin él.",
  },

  /**
   * El id de la sección de cita lo genera rehype-slug a partir del título del
   * documento, así que cambia con el idioma. Si renombras ese encabezado en el
   * MDX, hay que actualizarlo aquí — la prueba de enlaces internos lo detecta.
   */
  anclaCita: "#cómo-citar",

  encabezado: {
    rotulo: "MDI · Nota técnica",
    titulo: "Modelo de Dimensionamiento de Infraestructura de Inferencia",
    firma: "Propuesta por",
    entradilla:
      "Para cargas mixtas de usuarios y agentes. Tres restricciones —memoria, latencia y cómputo— deciden cuánto hardware hace falta para servir un modelo; abajo, una calculadora que las aplica a tu carga concreta.",
    irCalculadora: "Ir a la calculadora ↓",
    comoCitar: "Cómo citar",
    sinServidor: "Todo el cálculo ocurre en tu navegador. Nada se envía a ningún servidor.",
  },

  pie: {
    motor:
      "El motor de cálculo está escrito en Python (motor.py) y portado a TypeScript sin cambiar ninguna fórmula. Las pruebas comparan los dos, valor por valor, con igualdad exacta de punto flotante sobre 250 escenarios.",
    aviso:
      "Los precios por hora son referenciales y editables; los duty cycles están fijados en el peor caso. Lee la sección de limitaciones antes de usar estos números para comprar hardware.",
    autoria: (autor: string, anio: number) =>
      `MDI es una propuesta de ${autor}, ${anio}.`,
    citaEnlace: "cómo citar",
    citaResto: "Si te sirve para algo publicable, hay formatos de cita listos en",
  },

  idioma: {
    etiqueta: "Idioma",
    cambiar: "Ver esta página en inglés",
  },

  navegacion: {
    seccion: "Sección",
    contenido: "Contenido",
    secciones: "Secciones",
    irCalculadora: "Ir a la calculadora ↓",
  },

  calculadora: {
    titulo: "Calculadora MDI",
    cargando: "Preparando la calculadora…",
    entradillaDim:
      "Define la carga: la calculadora devuelve el mínimo de GPUs que cumple memoria, latencia y cómputo.",
    entradillaCap: "Fija el hardware: la calculadora escala la mezcla de carga hasta donde alcance.",
    modoAria: "Modo de cálculo",
    modoDim: "¿Cuánto hardware?",
    modoCap: "¿Para cuánto alcanza?",

    secHardware: "Hardware disponible",
    secUsuarios: "Usuarios",
    secAgentes: "Agentes",
    secObjetivo: "Objetivo",
    secModelo: "Modelo",

    gpusPorConfig: "GPUs por configuración",
    notaGpusPorConfig: (g: string) =>
      `Se evalúa cada GPU del catálogo como si tuvieras ${g} unidades de ese tipo.`,
    usuarios: "Usuarios",
    agentes: "Agentes",
    calculado: "calculado",
    dutyCycle: "Duty cycle",
    peorCaso: "peor caso",
    contexto: "Contexto",
    tok: "tok",
    notaAgentesDim:
      "Duty cycles fijos en el peor caso. Trazas reales de agentes de código dan ~0.42 (13 s de generación por 18 s de herramientas); 0.95 corresponde a herramientas rápidas.",
    notaAgentesCap:
      "Fijas cuántos agentes quieres; la calculadora devuelve cuántos usuarios caben además de ellos.",
    sloPorToken: "SLO por token",
    notaSlo: (n: string) => `${n} tokens/s por sesión`,

    modeloAria: "Modelo",
    nParametros: "N parámetros",
    capasAtn: "Lₐ capas atn.",
    ayudaCapasAtn: "Capas que generan KV cache, no las totales",
    cabezasKV: "H cabezas KV",
    dimension: "dₖ dimensión",
    pesos: "Pesos",
    cache: "Caché",
    overheadMotor: "Overhead motor",
    eficiencia: "Eficiencia de W",
    notaEficiencia:
      "El TPOT teórico sale optimista por un factor cercano a dos: el caché compite por el mismo ancho de banda y hay overhead de kernels. 0.5 es lo que respaldan los benchmarks públicos en modelos grandes; ajústalo con tu medición real. También descuenta los FLOPS.",

    exportarCSV: "Exportar CSV",
    tituloExportar: "Descargar la tabla de resultados",
    copiarEnlace: "Copiar enlace",
    copiado: "Copiado ✓",
    tituloCopiar: "Copiar el enlace con esta configuración",

    kpiPesos: "Pesos en VRAM",
    kpiKV: "KV por token",
    kpiActivas: "Sesiones activas",
    kpiContextoProm: "Contexto promedio",
    kpiKappa: "κ agente/usuario",

    graficaDim: "Costo contra latencia",
    graficaCap: (g: string) => `Frontera de capacidad con ${g} GPUs`,
    limita: "limita",

    comparar: "pasa el cursor sobre otra GPU para comparar",
    kpiPorSesion: "Por sesión activa",
    kpiLote: "Lote por GPU",
    sesiones: "sesiones",
    kpiConsumoUsuarios: "Consumo usuarios",
    kpiConsumoAgentes: "Consumo agentes",
    kpiAgentesFijados: "Agentes fijados",
    kpiUsuariosCaben: "Usuarios que caben",
    kpiCostoAgente: "Costo por agente",
    noAlcanza: "no alcanza",

    manda: "Manda",
    porqueMemoria: "La VRAM que sobra después de los pesos y del overhead no alcanza para el caché.",
    porqueLatencia: "Leer los pesos más el caché en cada paso no cabe dentro del SLO.",
    porqueComputo: "El lote saturó los Tensor Cores: la multiplicación ya no es gratis.",
    presionPorRestriccion: "Presión por restricción",

    cierreDim: (pct: string) =>
      `Cada sesión del lote recibe un token por ciclo, así que usuarios y agentes generan a la misma velocidad. El ${pct} % de las sesiones activas son agentes y se llevan esa misma fracción de la producción.`,
    cierreCap: (g: string, cuello: string, kappa: string) =>
      `Con ${g} unidades manda ${cuello}. Cada agente que agregues cuesta ${kappa} usuarios, así que la curva de la gráfica es el intercambio real entre ambos.`,

    cierreBarras:
      "Las barras muestran cuántas GPUs exige cada restricción por separado; la que domina define el total.",
    cierreCurvas:
      "Cada curva es una GPU: todos los puntos sobre ella saturan el sistema. No hay un óptimo único, es un intercambio — la pendiente es κ.",
    consejoSi: "Si manda",
    consejo: {
      memoria: ", conviene más VRAM o recortar contexto.",
      latencia: ", conviene más ancho de banda.",
      computo: ", el lote saturó los Tensor Cores y solo ayuda un modelo más chico o más GPUs.",
    },
    consejoPrecios:
      "Los precios por hora son editables y sirven como referencia, no como cotización.",
  },

  /**
   * El mensaje de por qué una GPU no sirve. La versión española reproduce
   * `motor.py` palabra por palabra a propósito: ver src/i18n/motivo.ts.
   */
  motivo: {
    noCabe: (modelo: string, gpu: string) => `${modelo} no cabe en ${gpu}`,
    sloInalcanzable: (slo: string, gpu: string) => `SLO de ${slo} ms inalcanzable en ${gpu}`,
  },

  tabla: {
    caption: (modo: string) => `Resultado por GPU en modo ${modo}`,
    modoDim: "dimensionar",
    modoCap: "capacidad",
    colGPU: "GPU",
    colVRAM: "VRAM",
    colAncho: "GB/s nom → efect",
    colPrecio: "USD/h",
    colGPUs: "GPUs",
    colPresion: "Presión mem / lat / cpu",
    colTPOT: "TPOT",
    colTokS: "tok/s sesión",
    colCosto: "Costo/h",
    colUsuarios: "Usuarios",
    colSoloAgentes: "Solo agentes",
    colCuello: "Cuello",
    masBarata: "más barata",
    masCapacidad: "más capacidad",
    incluir: (gpu: string) => `Incluir ${gpu} en la comparación`,
    eliminar: (gpu: string) => `Eliminar ${gpu} del catálogo`,
    precioDe: (gpu: string) => `Precio por hora de ${gpu}`,
    precioUSD: "Precio USD/h",
    usuariosCon: (g: string) => `Usuarios con ${g} GPUs`,
    noAlcanza: "no alcanza",
    presionManda: "Presión por restricción · manda",
  },

  barras: {
    memCorto: "mem",
    latCorto: "lat",
    compCorto: "cpu",
    aria: (restriccion: string, n: string) => `${restriccion}: ${n} GPUs`,
  },

  cuellos: {
    memoria: "memoria",
    latencia: "latencia",
    computo: "cómputo",
    ninguno: "—",
  },

  graficas: {
    ejeTPOT: "TPOT logrado (ms/token)",
    ejeCosto: "Costo (USD/hora)",
    ejeAgentes: "Agentes",
    ejeUsuarios: "Usuarios",
    slo: (n: string) => `SLO ${n} ms`,
    vacioPareto: "Ninguna GPU del catálogo admite esta configuración.",
    vacioFrontera: (g: string) => `Ninguna GPU del catálogo sostiene esta carga con ${g} unidades.`,
    ariaPareto: (n: number) => `Costo por hora contra TPOT logrado para ${n} GPUs`,
    ariaFrontera: (g: string) =>
      `Frontera de capacidad con ${g} GPUs: usuarios que caben según cuántos agentes se fijen`,
    puntoPareto: (gpu: string, g: string, tpot: string, costo: string) =>
      `${gpu}: ${g} GPUs, ${tpot} ms, ${costo} por hora`,
    puntoFrontera: (gpu: string, cuantos: string, agentes: string) =>
      `${gpu}: ${cuantos} con ${agentes} agentes`,
    usuariosSufijo: "usuarios",
    agentesSufijo: "agentes",
  },

  catalogo: {
    titulo: "Catálogo",
    resumen: (gpus: number, modelos: number) => `${gpus} GPUs · ${modelos} modelos`,
    pestanaGPUs: "GPUs",
    pestanaModelos: "Modelos",
    agregarGPU: "+ Agregar GPU",
    agregarModelo: "+ Agregar modelo",
    restaurar: "Restaurar",
    tituloRestaurar: "Volver al catálogo de fábrica",
    colNombre: "Nombre",
    colVRAM: "VRAM GB",
    colAncho: "BW GB/s",
    colTFLOPS: "TFLOPS",
    colPrecio: "USD/h",
    colN: "N (B)",
    colCapas: "Lₐ",
    colCabezas: "H",
    colDim: "dₖ",
    colPesos: "Pesos",
    colCache: "Caché",
    colDerivados: "Derivados",
    nombreGPU: "Nombre de la GPU",
    nombreModelo: "Nombre del modelo",
    vramDe: (n: string) => `VRAM de ${n}`,
    anchoDe: (n: string) => `Ancho de banda de ${n}`,
    tflopsDe: (n: string) => `TFLOPS de ${n}`,
    precioDe: (n: string) => `Precio de ${n}`,
    paramsDe: (n: string) => `Parámetros de ${n}`,
    capasDe: (n: string) => `Capas de atención de ${n}`,
    cabezasDe: (n: string) => `Cabezas KV de ${n}`,
    dimDe: (n: string) => `Dimensión por cabeza de ${n}`,
    quantPesosDe: (n: string) => `Cuantización de pesos de ${n}`,
    quantCacheDe: (n: string) => `Cuantización de caché de ${n}`,
    duplicar: (n: string) => `Duplicar ${n}`,
    tituloDuplicar: "Duplicar",
    sufijoCopia: " (copia)",
    eliminar: (n: string) => `Eliminar ${n}`,
    campoVRAM: "VRAM (GB)",
    campoAncho: "Ancho de banda (GB/s)",
    campoTFLOPS: "TFLOPS",
    campoPrecio: "Precio (USD/h)",
    campoN: "N (miles de millones)",
    campoCapas: "Lₐ capas de atención",
    campoCabezas: "H cabezas KV",
    campoDim: "dₖ dimensión",
    notaGPUs:
      "Los precios son referenciales: CAPEX amortizado más OPEX, no una cotización. El factor de eficiencia se aplica por igual a todo el catálogo desde el panel de parámetros.",
    notaModelos:
      "Lₐ son las capas que generan KV cache, no las totales. En arquitecturas híbridas solo cuenta una fracción de las capas, y ahí está casi toda la diferencia de caché entre modelos del mismo tamaño.",
  },

  cita: {
    referencia: "Referencia",
    bibtex: "BibTeX",
    copiar: "Copiar",
    copiado: "Copiado ✓",
    consultado: (fecha: string) => `(consultado el ${fecha})`,
  },
};
// Sin `as const` a propósito: con él cada cadena española sería su propio tipo
// literal y el inglés no encajaría nunca. Lo que hace falta es la FORMA —qué
// claves hay y de qué tipo—, y eso es justo lo que da `typeof es` sin congelar.

/** El inglés tiene que tener exactamente las mismas claves; TypeScript lo exige. */
type Textos = typeof es;

const en: Textos = {
  meta: {
    titulo: "MDI — Inference infrastructure sizing",
    tituloCita: "MDI — Inference Infrastructure Sizing Model for mixed human and agent loads",
    descripcion:
      "MDI: an inference infrastructure sizing model for mixed human and agent loads. Memory, latency and compute decide how much hardware you need; includes a calculator.",
    descripcionCorta:
      "The three constraints that decide how much hardware it takes to serve an LLM under mixed human and agent load, with a calculator.",
    sinJs:
      "This page does all its maths in the browser, so it needs JavaScript. Without it neither the document nor the calculator can be shown.",
  },

  anclaCita: "#how-to-cite",

  encabezado: {
    rotulo: "MDI · Technical note",
    titulo: "Inference Infrastructure Sizing Model",
    firma: "Proposed by",
    entradilla:
      "For mixed human and agent loads. Three constraints —memory, latency and compute— decide how much hardware it takes to serve a model; below, a calculator that applies them to your own load.",
    irCalculadora: "Go to the calculator ↓",
    comoCitar: "How to cite",
    sinServidor: "Everything is computed in your browser. Nothing is sent to any server.",
  },

  pie: {
    motor:
      "The engine is written in Python (motor.py) and ported to TypeScript without changing a single formula. The tests compare the two, value by value, with exact floating-point equality across 250 scenarios.",
    aviso:
      "Hourly prices are indicative and editable; duty cycles are pinned to the worst case. Read the limitations section before using these numbers to buy hardware.",
    autoria: (autor: string, anio: number) => `MDI is a proposal by ${autor}, ${anio}.`,
    citaEnlace: "how to cite",
    citaResto: "If it helps you with something publishable, ready-made citation formats are in",
  },

  idioma: {
    etiqueta: "Language",
    cambiar: "View this page in Spanish",
  },

  navegacion: {
    seccion: "Section",
    contenido: "Contents",
    secciones: "Sections",
    irCalculadora: "Go to the calculator ↓",
  },

  calculadora: {
    titulo: "MDI calculator",
    cargando: "Getting the calculator ready…",
    entradillaDim:
      "Define the load: the calculator returns the minimum number of GPUs that satisfies memory, latency and compute.",
    entradillaCap: "Fix the hardware: the calculator scales the load mix as far as it will go.",
    modoAria: "Calculation mode",
    modoDim: "How much hardware?",
    modoCap: "How far does it go?",

    secHardware: "Available hardware",
    secUsuarios: "Users",
    secAgentes: "Agents",
    secObjetivo: "Target",
    secModelo: "Model",

    gpusPorConfig: "GPUs per configuration",
    notaGpusPorConfig: (g: string) =>
      `Every GPU in the catalogue is evaluated as if you had ${g} units of it.`,
    usuarios: "Users",
    agentes: "Agents",
    calculado: "computed",
    dutyCycle: "Duty cycle",
    peorCaso: "worst case",
    contexto: "Context",
    tok: "tok",
    notaAgentesDim:
      "Duty cycles are pinned to the worst case. Real traces of coding agents give ~0.42 (13 s generating per 18 s of tool calls); 0.95 corresponds to very fast tools.",
    notaAgentesCap:
      "You fix how many agents you want; the calculator returns how many users fit alongside them.",
    sloPorToken: "Per-token SLO",
    notaSlo: (n: string) => `${n} tokens/s per session`,

    modeloAria: "Model",
    nParametros: "N parameters",
    capasAtn: "Lₐ attn. layers",
    ayudaCapasAtn: "Layers that produce KV cache, not the total",
    cabezasKV: "H KV heads",
    dimension: "dₖ dimension",
    pesos: "Weights",
    cache: "Cache",
    overheadMotor: "Engine overhead",
    eficiencia: "W efficiency",
    notaEficiencia:
      "The theoretical TPOT comes out optimistic by roughly a factor of two: the cache competes for the same bandwidth and there is kernel overhead. 0.5 is what public benchmarks support on large models; tune it with your own measurement. It discounts FLOPS too.",

    exportarCSV: "Export CSV",
    tituloExportar: "Download the results table",
    copiarEnlace: "Copy link",
    copiado: "Copied ✓",
    tituloCopiar: "Copy the link to this configuration",

    kpiPesos: "Weights in VRAM",
    kpiKV: "KV per token",
    kpiActivas: "Active sessions",
    kpiContextoProm: "Average context",
    kpiKappa: "κ agent/user",

    graficaDim: "Cost against latency",
    graficaCap: (g: string) => `Capacity frontier with ${g} GPUs`,
    limita: "limited by",

    comparar: "hover another GPU to compare",
    kpiPorSesion: "Per active session",
    kpiLote: "Batch per GPU",
    sesiones: "sessions",
    kpiConsumoUsuarios: "Users' share",
    kpiConsumoAgentes: "Agents' share",
    kpiAgentesFijados: "Agents fixed",
    kpiUsuariosCaben: "Users that fit",
    kpiCostoAgente: "Cost per agent",
    noAlcanza: "does not fit",

    manda: "Bound by",
    porqueMemoria:
      "The VRAM left after the weights and the engine overhead is not enough for the cache.",
    porqueLatencia: "Reading the weights plus the cache on every step does not fit inside the SLO.",
    porqueComputo: "The batch saturated the Tensor Cores: the multiply is no longer free.",
    presionPorRestriccion: "Pressure per constraint",

    cierreDim: (pct: string) =>
      `Every session in the batch gets one token per cycle, so users and agents generate at the same speed. ${pct} % of active sessions are agents, and they take that same share of the output.`,
    cierreCap: (g: string, cuello: string, kappa: string) =>
      `With ${g} units the binding constraint is ${cuello}. Every agent you add costs ${kappa} users, so the curve in the chart is the real trade-off between the two.`,

    cierreBarras:
      "The bars show how many GPUs each constraint demands on its own; the one that dominates sets the total.",
    cierreCurvas:
      "Each curve is one GPU: every point on it saturates the system. There is no single optimum, it is a trade-off — the slope is κ.",
    consejoSi: "When the binding constraint is",
    consejo: {
      memoria: ", you want more VRAM or a shorter context.",
      latencia: ", you want more bandwidth.",
      computo: ", the batch saturated the Tensor Cores and only a smaller model or more GPUs helps.",
    },
    consejoPrecios: "Hourly prices are editable and indicative, not a quote.",
  },

  motivo: {
    noCabe: (modelo: string, gpu: string) => `${modelo} does not fit on ${gpu}`,
    sloInalcanzable: (slo: string, gpu: string) => `A ${slo} ms SLO is unreachable on ${gpu}`,
  },

  tabla: {
    caption: (modo: string) => `Result per GPU in ${modo} mode`,
    modoDim: "sizing",
    modoCap: "capacity",
    colGPU: "GPU",
    colVRAM: "VRAM",
    colAncho: "GB/s nom → eff",
    colPrecio: "USD/h",
    colGPUs: "GPUs",
    colPresion: "Pressure mem / lat / cpu",
    colTPOT: "TPOT",
    colTokS: "tok/s session",
    colCosto: "Cost/h",
    colUsuarios: "Users",
    colSoloAgentes: "Agents only",
    colCuello: "Bound by",
    masBarata: "cheapest",
    masCapacidad: "most capacity",
    incluir: (gpu: string) => `Include ${gpu} in the comparison`,
    eliminar: (gpu: string) => `Remove ${gpu} from the catalogue`,
    precioDe: (gpu: string) => `Hourly price of ${gpu}`,
    precioUSD: "Price USD/h",
    usuariosCon: (g: string) => `Users with ${g} GPUs`,
    noAlcanza: "does not fit",
    presionManda: "Pressure per constraint · bound by",
  },

  barras: {
    memCorto: "mem",
    latCorto: "lat",
    compCorto: "cpu",
    aria: (restriccion: string, n: string) => `${restriccion}: ${n} GPUs`,
  },

  cuellos: {
    memoria: "memory",
    latencia: "latency",
    computo: "compute",
    ninguno: "—",
  },

  graficas: {
    ejeTPOT: "TPOT achieved (ms/token)",
    ejeCosto: "Cost (USD/hour)",
    ejeAgentes: "Agents",
    ejeUsuarios: "Users",
    slo: (n: string) => `SLO ${n} ms`,
    vacioPareto: "No GPU in the catalogue supports this configuration.",
    vacioFrontera: (g: string) => `No GPU in the catalogue sustains this load with ${g} units.`,
    ariaPareto: (n: number) => `Cost per hour against TPOT achieved for ${n} GPUs`,
    ariaFrontera: (g: string) =>
      `Capacity frontier with ${g} GPUs: how many users fit for a given number of agents`,
    puntoPareto: (gpu: string, g: string, tpot: string, costo: string) =>
      `${gpu}: ${g} GPUs, ${tpot} ms, ${costo} per hour`,
    puntoFrontera: (gpu: string, cuantos: string, agentes: string) =>
      `${gpu}: ${cuantos} with ${agentes} agents`,
    usuariosSufijo: "users",
    agentesSufijo: "agents",
  },

  catalogo: {
    titulo: "Catalogue",
    resumen: (gpus: number, modelos: number) => `${gpus} GPUs · ${modelos} models`,
    pestanaGPUs: "GPUs",
    pestanaModelos: "Models",
    agregarGPU: "+ Add GPU",
    agregarModelo: "+ Add model",
    restaurar: "Reset",
    tituloRestaurar: "Back to the factory catalogue",
    colNombre: "Name",
    colVRAM: "VRAM GB",
    colAncho: "BW GB/s",
    colTFLOPS: "TFLOPS",
    colPrecio: "USD/h",
    colN: "N (B)",
    colCapas: "Lₐ",
    colCabezas: "H",
    colDim: "dₖ",
    colPesos: "Weights",
    colCache: "Cache",
    colDerivados: "Derived",
    nombreGPU: "GPU name",
    nombreModelo: "Model name",
    vramDe: (n: string) => `VRAM of ${n}`,
    anchoDe: (n: string) => `Bandwidth of ${n}`,
    tflopsDe: (n: string) => `TFLOPS of ${n}`,
    precioDe: (n: string) => `Price of ${n}`,
    paramsDe: (n: string) => `Parameters of ${n}`,
    capasDe: (n: string) => `Attention layers of ${n}`,
    cabezasDe: (n: string) => `KV heads of ${n}`,
    dimDe: (n: string) => `Head dimension of ${n}`,
    quantPesosDe: (n: string) => `Weight quantisation of ${n}`,
    quantCacheDe: (n: string) => `Cache quantisation of ${n}`,
    duplicar: (n: string) => `Duplicate ${n}`,
    tituloDuplicar: "Duplicate",
    sufijoCopia: " (copy)",
    eliminar: (n: string) => `Remove ${n}`,
    campoVRAM: "VRAM (GB)",
    campoAncho: "Bandwidth (GB/s)",
    campoTFLOPS: "TFLOPS",
    campoPrecio: "Price (USD/h)",
    campoN: "N (billions)",
    campoCapas: "Lₐ attention layers",
    campoCabezas: "H KV heads",
    campoDim: "dₖ dimension",
    notaGPUs:
      "Prices are indicative: amortised CAPEX plus OPEX, not a quote. The efficiency factor applies equally to the whole catalogue and is set in the parameters panel.",
    notaModelos:
      "Lₐ is the number of layers that produce KV cache, not the total. Hybrid architectures only count a fraction of their layers, and that is where nearly all of the cache difference between same-sized models comes from.",
  },

  cita: {
    referencia: "Reference",
    bibtex: "BibTeX",
    copiar: "Copy",
    copiado: "Copied ✓",
    consultado: (fecha: string) => `(accessed ${fecha})`,
  },
};

export const TEXTOS: Record<Idioma, Textos> = { es, en };
export type { Textos };
