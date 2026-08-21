/**
 * Catálogos de referencia: los mismos valores que `motor.py` trae al final.
 *
 * Son un punto de partida editable. La calculadora permite agregar, editar y
 * eliminar tanto GPUs como modelos, y todo eso vive en el estado de la página —
 * no hay backend. Los precios son referenciales, no una cotización.
 */

import type { Carga, GPU, Modelo } from "./motor";

/** Una GPU del catálogo: la del motor más lo que necesita la interfaz. */
export interface GPUCatalogo extends GPU {
  id: string;
  /** si entra en la comparación */
  on: boolean;
}

/** Un modelo del catálogo. */
export interface ModeloCatalogo extends Modelo {
  id: string;
}

export const GPUS: GPUCatalogo[] = [
  { id: "h100-sxm", nombre: "H100 SXM", vram_gb: 80, bw_gbs: 3350, tflops: 1979, precio_hora: 2.6, eff: 0.5, on: true },
  { id: "h100-pcie", nombre: "H100 PCIe", vram_gb: 80, bw_gbs: 2000, tflops: 1513, precio_hora: 2.1, eff: 0.5, on: true },
  { id: "h200-sxm", nombre: "H200 SXM", vram_gb: 141, bw_gbs: 4800, tflops: 1979, precio_hora: 3.7, eff: 0.5, on: true },
  { id: "a100-80", nombre: "A100 80GB", vram_gb: 80, bw_gbs: 2039, tflops: 624, precio_hora: 1.6, eff: 0.5, on: true },
  { id: "l40s", nombre: "L40S", vram_gb: 48, bw_gbs: 864, tflops: 733, precio_hora: 1.0, eff: 0.5, on: true },
  { id: "rtx6000ada", nombre: "RTX 6000 Ada", vram_gb: 48, bw_gbs: 960, tflops: 728, precio_hora: 0.9, eff: 0.5, on: true },
  { id: "dgx-spark", nombre: "DGX Spark", vram_gb: 128, bw_gbs: 273, tflops: 250, precio_hora: 0.2, eff: 0.5, on: true },
];

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

/** Quita de la GPU los campos que solo le interesan a la interfaz. */
export const soloGPU = (g: GPUCatalogo): GPU => ({
  nombre: g.nombre,
  vram_gb: g.vram_gb,
  bw_gbs: g.bw_gbs,
  tflops: g.tflops,
  precio_hora: g.precio_hora,
  eff: g.eff,
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
