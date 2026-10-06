/**
 * Catálogos de referencia: los mismos valores que `motor.py` trae al final.
 *
 * Son un punto de partida editable. La calculadora permite agregar, editar y
 * eliminar GPUs, chasis y modelos, y todo eso vive en el estado de la página —
 * no hay backend. Los precios son referenciales, no una cotización.
 */

import type { Carga, GPU, Modelo } from "./motor";

/**
 * Una unidad de hardware del catálogo: la del motor más lo que necesita la
 * interfaz. Es una GPU suelta (n=1) o un chasis completo (n>1): para el motor
 * son lo mismo, una unidad que se compra y se replica.
 */
export interface GPUCatalogo extends GPU {
  id: string;
  /** si entra en la comparación */
  on: boolean;
}

/** Qué catálogo de hardware se compara en la calculadora. */
export type Vista = "gpus" | "chasis" | "ambos";

export const VISTAS: readonly Vista[] = ["gpus", "chasis", "ambos"];

/** Un chasis es una unidad de más de una GPU. */
export const esChasis = (g: GPU): boolean => g.n > 1;

/** Un modelo del catálogo. */
export interface ModeloCatalogo extends Modelo {
  id: string;
}

export const GPUS: GPUCatalogo[] = [
  { id: "h100-sxm", nombre: "H100 SXM", vram_gb: 80, bw_gbs: 3350, tflops: 1979, precio_hora: 2.6, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "h100-pcie", nombre: "H100 PCIe", vram_gb: 80, bw_gbs: 2000, tflops: 1513, precio_hora: 2.1, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "h200-sxm", nombre: "H200 SXM", vram_gb: 141, bw_gbs: 4800, tflops: 1979, precio_hora: 3.7, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "a100-80", nombre: "A100 80GB", vram_gb: 80, bw_gbs: 2039, tflops: 624, precio_hora: 1.6, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "l40s", nombre: "L40S", vram_gb: 48, bw_gbs: 864, tflops: 733, precio_hora: 1.0, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "rtx6000ada", nombre: "RTX 6000 Ada", vram_gb: 48, bw_gbs: 960, tflops: 728, precio_hora: 0.9, eff: 0.5, n: 1, escala: 1, on: true },
  { id: "dgx-spark", nombre: "DGX Spark", vram_gb: 128, bw_gbs: 273, tflops: 250, precio_hora: 0.2, eff: 0.5, n: 1, escala: 1, on: true },
];

// --------------------------------------------------------------------------- //
// Chasis completos
// --------------------------------------------------------------------------- //

/**
 * Cómo se pasa del precio de un chasis al precio por hora que usa el motor:
 *
 *   USD/h = lista · (1/años + opex) / 8760  +  kW · PUE · USD/kWh
 *
 * es decir, el precio de lista amortizado en `AMORTIZACION_ANIOS` años, más un
 * porcentaje anual del precio por soporte, red y alojamiento, más la energía.
 * Es la misma idea que los precios de las GPUs —CAPEX amortizado más OPEX—
 * puesta en una fórmula para que cada número se pueda reproducir. No es una
 * cotización: la prueba de `motor.test.ts` solo exige que el catálogo la siga.
 */
export const HORAS_ANIO = 8760;
export const AMORTIZACION_ANIOS = 3;
/** Soporte, red y alojamiento, como fracción del precio de lista por año. */
export const OPEX_ANUAL = 0.1;
/** Energía total del centro de datos sobre la que consume el equipo. */
export const PUE = 1.4;
export const USD_KWH = 0.1;

export const horaria = (listaUSD: number, kw: number): number =>
  (listaUSD * (1 / AMORTIZACION_ANIOS + OPEX_ANUAL)) / HORAS_ANIO + kw * PUE * USD_KWH;

/**
 * De dónde sale el precio de un chasis. Es referencia: no entra en ningún
 * cálculo, solo en la tabla del documento y en la prueba que la ata al precio
 * por hora del catálogo.
 */
export interface ReferenciaChasis {
  /** Precio de lista, o de compra típico, del sistema completo, en USD. */
  usd: number;
  /** Consumo máximo del sistema, en kW. */
  kw: number;
  /** Dónde se vio la cifra. */
  fuente: { nombre: string; url: string };
  /** Cuándo se consultó, AAAA-MM. */
  fecha: string;
  /** Cuánto respalda la fuente a la cifra. */
  confianza: "alta" | "media" | "baja";
  /** Una salvedad que el lector debe ver junto al precio, si la cifra la tiene. */
  nota?: { es: string; en: string };
}

/**
 * σ por defecto de un chasis nuevo y de un enlace que no la trae. Los del
 * catálogo llevan el suyo, estimado con `scripts/estimar_sigma.py`.
 */
export const ESCALA_DEFECTO = 0.5;

/**
 * Los chasis de fábrica: n GPUs que sirven una réplica con paralelismo tensorial.
 *
 * Las cifras por GPU son las del fabricante, en FLOPS pico DENSOS de 8 bits como
 * en `GPUS`; el precio es el del chasis entero y sale de `REFERENCIA_CHASIS`
 * con la regla de `horaria`. σ es un supuesto: los de NVIDIA se estimaron con las
 * latencias de all-reduce que mide vLLM (`scripts/estimar_sigma.py`), el de AMD no
 * tiene una medición equivalente. Mismos valores que `CHASIS` de `motor.py`.
 */
export const CHASIS: GPUCatalogo[] = [
  { id: "dgx-h100", nombre: "DGX H100", vram_gb: 80, bw_gbs: 3350, tflops: 1979, precio_hora: 19.98, eff: 0.5, n: 8, escala: 0.7, on: true },
  { id: "dgx-h200", nombre: "DGX H200", vram_gb: 141, bw_gbs: 4800, tflops: 1979, precio_hora: 28.64, eff: 0.5, n: 8, escala: 0.6, on: true },
  { id: "dgx-b200", nombre: "DGX B200", vram_gb: 180, bw_gbs: 8000, tflops: 4500, precio_hora: 31.9, eff: 0.5, n: 8, escala: 0.4, on: true },
  { id: "dgx-b300", nombre: "DGX B300", vram_gb: 288, bw_gbs: 8000, tflops: 4500, precio_hora: 34.03, eff: 0.5, n: 8, escala: 0.35, on: true },
  { id: "mi300x-x8", nombre: "MI300X x8", vram_gb: 192, bw_gbs: 5300, tflops: 2615, precio_hora: 14.77, eff: 0.5, n: 8, escala: 0.4, on: true },
];

/**
 * De dónde sale el precio de cada chasis. Son precios de lista o de venta que
 * ofrecen revendedores y fabricantes, consultados en `fecha`: varían con la
 * configuración, el volumen y el día, y por eso cada uno lleva su confianza. Los
 * sitios de los fabricantes no se pudieron abrir al reunirlos, así que los
 * precios salen de listados de revendedores. No son cotizaciones.
 */
export const REFERENCIA_CHASIS: Record<string, ReferenciaChasis> = {
  "dgx-h100": {
    usd: 375000,
    kw: 10.2,
    fuente: {
      nombre: "Viperatech",
      url: "https://viperatech.com/product/nvidia-dgx-h100-deep-learning-console-640gb-sxm5",
    },
    fecha: "2026-10",
    confianza: "media",
    nota: {
      es: "Las guías de compra lo ponen entre $300 000 y $450 000.",
      en: "Buying guides put it between $300,000 and $450,000.",
    },
  },
  "dgx-h200": {
    usd: 550000,
    kw: 10.2,
    fuente: { nombre: "ITCT Shop", url: "https://itctshop.com/product/nvidia-dgx-h200/" },
    fecha: "2026-10",
    confianza: "baja",
    nota: {
      es: "Un solo revendedor; las guías hablan de $400 000 a $500 000.",
      en: "A single reseller; guides mention $400,000 to $500,000.",
    },
  },
  "dgx-b200": {
    usd: 604320,
    kw: 14.3,
    fuente: {
      nombre: "Broadberry",
      url: "https://www.broadberry.com/xeon-scalable-processor-gen4-rackmount-servers/nvidia-dgx-b200",
    },
    fecha: "2026-10",
    confianza: "media",
    nota: {
      es: "Lo más bajo del rango que lista (hasta $633 925 según la configuración).",
      en: "The low end of the range it lists (up to $633,925 depending on configuration).",
    },
  },
  "dgx-b300": {
    usd: 646878,
    kw: 14.5,
    fuente: {
      nombre: "Broadberry",
      url: "https://www.broadberry.com/xeon-6-rackmount-servers/nvidia-dgx-b300",
    },
    fecha: "2026-10",
    confianza: "media",
    nota: {
      es: "Sus FLOPS de 8 bits se infieren de los 72 PFLOPS con sparsity que anuncia NVIDIA.",
      en: "Its 8-bit FLOPS are inferred from the 72 PFLOPS with sparsity that NVIDIA announces.",
    },
  },
  "mi300x-x8": {
    usd: 275840,
    kw: 8,
    fuente: {
      nombre: "Supermicro",
      url: "https://store.supermicro.com/us_en/systems/gpu/8u-gpu-servers/8u-gpu-superserver-as-8125gs-tnmr2.html",
    },
    fecha: "2026-10",
    confianza: "baja",
    nota: {
      es: "«Desde» $275 840; otro revendedor lo lista en $198 500. El consumo es una estimación: AMD no publica el máximo del sistema.",
      en: "“From” $275,840; another reseller lists it at $198,500. The power draw is an estimate: AMD does not publish the system maximum.",
    },
  },
};

export const MODELOS: ModeloCatalogo[] = [
  { id: "qwen35-27b", nombre: "Qwen3.5-27B (híbrido)", N: 27, capas_atn: 16, kv_heads: 4, head_dim: 256, quant_pesos: "fp8", quant_cache: "fp8" },
  { id: "denso-27b", nombre: "Denso 27B", N: 27, capas_atn: 46, kv_heads: 8, head_dim: 128, quant_pesos: "fp8", quant_cache: "fp8" },
  { id: "denso-70b", nombre: "Denso 70B", N: 70, capas_atn: 80, kv_heads: 8, head_dim: 128, quant_pesos: "fp8", quant_cache: "fp8" },
  { id: "denso-8b", nombre: "Denso 8B", N: 8, capas_atn: 32, kv_heads: 8, head_dim: 128, quant_pesos: "fp8", quant_cache: "fp8" },
];

/**
 * Duty cycles fijados en el peor caso, como en el bloque de demo de motor.py.
 * No son editables desde la interfaz a propósito: son la hipótesis conservadora
 * sobre la que descansa todo el dimensionamiento.
 */
export const DUTY_HUMANO = 0.15;
export const DUTY_AGENTE = 0.95;

/**
 * El escenario que imprime `python motor.py`. Es el estado inicial de la
 * calculadora para que el criterio de aceptación se pueda comprobar sin tocar
 * ningún campo: los dos deben dar los mismos números.
 */
export const CARGA_DEMO: Carga = {
  humanos: { U: 2000, D: DUTY_HUMANO, C: 3000 },
  agentes: { U: 40, D: DUTY_AGENTE, C: 30000 },
  slo_ms: 30,
  overhead_gb: 4,
};

/** El G que usa la segunda tabla de la demo de motor.py. */
export const G_DEMO = 12;

/** eff por defecto: el 0.5 que motor.py trae como valor de fábrica. */
export const EFF_DEMO = 0.5;

/** Quita de la unidad los campos que solo le interesan a la interfaz. */
export const soloGPU = (g: GPUCatalogo): GPU => ({
  nombre: g.nombre,
  vram_gb: g.vram_gb,
  bw_gbs: g.bw_gbs,
  tflops: g.tflops,
  precio_hora: g.precio_hora,
  eff: g.eff,
  n: g.n,
  escala: g.escala,
});

export const soloModelo = (m: ModeloCatalogo): Modelo => ({
  nombre: m.nombre,
  N: m.N,
  capas_atn: m.capas_atn,
  kv_heads: m.kv_heads,
  head_dim: m.head_dim,
  quant_pesos: m.quant_pesos,
  quant_cache: m.quant_cache,
});

/** Plantilla para el botón de "agregar GPU". */
export const gpuNueva = (id: string): GPUCatalogo => ({
  id,
  nombre: "GPU nueva",
  vram_gb: 80,
  bw_gbs: 2000,
  tflops: 900,
  precio_hora: 1.5,
  eff: EFF_DEMO,
  n: 1,
  escala: 1,
  on: true,
});

/** Plantilla para el botón de "agregar chasis": ocho GPUs con NVLink. */
export const chasisNuevo = (id: string): GPUCatalogo => ({
  id,
  nombre: "Chasis nuevo",
  vram_gb: 80,
  bw_gbs: 2000,
  tflops: 900,
  precio_hora: 12,
  eff: EFF_DEMO,
  n: 8,
  escala: ESCALA_DEFECTO,
  on: true,
});

/** Plantilla para el botón de "agregar modelo". */
export const modeloNuevo = (id: string): ModeloCatalogo => ({
  id,
  nombre: "Modelo nuevo",
  N: 30,
  capas_atn: 48,
  kv_heads: 8,
  head_dim: 128,
  quant_pesos: "fp8",
  quant_cache: "fp8",
});
