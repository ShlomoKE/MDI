/**
 * Estado de la calculadora serializado en la query string.
 *
 * Todo lo que cambia el resultado viaja en la URL, así que un enlace basta para
 * compartir una configuración concreta: parámetros de carga, modelo y el
 * catálogo completo si se editó. Los catálogos solo se serializan cuando
 * difieren del de fábrica, para que el enlace normal siga siendo corto.
 */

import {
  EFF_DEMO,
  GPUS,
  G_DEMO,
  MODELOS,
  type GPUCatalogo,
  type ModeloCatalogo,
} from "./catalogos";
import { CARGA_DEMO } from "./catalogos";
import { QUANT, type Quant } from "./motor";

export type Modo = "dimensionar" | "capacidad";

export interface Estado {
  modo: Modo;
  /** U de humanos */
  Uh: number;
  /** C de humanos, tokens */
  Ch: number;
  /** U de agentes */
  Ua: number;
  /** C de agentes, tokens */
  Ca: number;
  slo_ms: number;
  overhead_gb: number;
  /** Factor de eficiencia, común a todas las GPUs. */
  eff: number;
  /** GPUs por configuración en el modo capacidad. */
  G: number;
  modeloId: string;
  modelos: ModeloCatalogo[];
  gpus: GPUCatalogo[];
}

export const ESTADO_INICIAL: Estado = {
  modo: "dimensionar",
  Uh: CARGA_DEMO.humanos.U,
  Ch: CARGA_DEMO.humanos.C,
  Ua: CARGA_DEMO.agentes.U,
  Ca: CARGA_DEMO.agentes.C,
  slo_ms: CARGA_DEMO.slo_ms,
  overhead_gb: CARGA_DEMO.overhead_gb,
  eff: EFF_DEMO,
  G: G_DEMO,
  modeloId: MODELOS[0].id,
  modelos: MODELOS,
  gpus: GPUS,
};

// --------------------------------------------------------------------------- //
// Codificación compacta
// --------------------------------------------------------------------------- //

const SEP_CAMPO = "~";
const SEP_FILA = "|";

/**
 * `encodeURIComponent` deja pasar `~` sin escapar, así que un nombre con virgulilla
 * partiría la fila en dos. Se escapan a mano los dos separadores.
 */
const codificarNombre = (s: string): string =>
  encodeURIComponent(s).replace(/~/g, "%7E").replace(/\|/g, "%7C");

const decodificarNombre = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    // Una URL mal formada no debe tumbar la página.
    return s;
  }
};

/** Número sin ceros de más; los flotantes largos se recortan a 10 dígitos. */
const n2s = (n: number): string => {
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toPrecision(10)));
};

const s2n = (s: string | undefined, porDefecto: number): number => {
  if (s === undefined || s === "") return porDefecto;
  const v = Number(s);
  return Number.isFinite(v) ? v : porDefecto;
};

const esQuant = (s: string): s is Quant => Object.hasOwn(QUANT, s);

function codificarGPUs(gpus: GPUCatalogo[]): string {
  return gpus
    .map((g) =>
      [
        codificarNombre(g.nombre),
        n2s(g.vram_gb),
        n2s(g.bw_gbs),
        n2s(g.tflops),
        n2s(g.precio_hora),
        g.on ? "1" : "0",
      ].join(SEP_CAMPO),
    )
    .join(SEP_FILA);
}

function decodificarGPUs(s: string): GPUCatalogo[] | null {
  const filas = s.split(SEP_FILA).filter(Boolean);
  if (!filas.length) return null;
  const out: GPUCatalogo[] = [];
  for (let i = 0; i < filas.length; i++) {
    const p = filas[i].split(SEP_CAMPO);
    if (p.length < 6) return null;
    out.push({
      id: "u" + i,
      nombre: decodificarNombre(p[0]) || "GPU " + (i + 1),
      vram_gb: s2n(p[1], 80),
      bw_gbs: s2n(p[2], 2000),
      tflops: s2n(p[3], 900),
      precio_hora: s2n(p[4], 1),
      eff: EFF_DEMO,
      on: p[5] !== "0",
    });
  }
  return out;
}

function codificarModelos(ms: ModeloCatalogo[]): string {
  return ms
    .map((m) =>
      [
        codificarNombre(m.nombre),
        n2s(m.N),
        n2s(m.capas_atn),
        n2s(m.kv_heads),
        n2s(m.head_dim),
        m.quant_pesos,
        m.quant_cache,
      ].join(SEP_CAMPO),
    )
    .join(SEP_FILA);
}

function decodificarModelos(s: string): ModeloCatalogo[] | null {
  const filas = s.split(SEP_FILA).filter(Boolean);
  if (!filas.length) return null;
  const out: ModeloCatalogo[] = [];
  for (let i = 0; i < filas.length; i++) {
    const p = filas[i].split(SEP_CAMPO);
    if (p.length < 7) return null;
    const qw = p[5];
    const qkv = p[6];
    out.push({
      id: "u" + i,
      nombre: decodificarNombre(p[0]) || "Modelo " + (i + 1),
      N: s2n(p[1], 27),
      capas_atn: s2n(p[2], 48),
      kv_heads: s2n(p[3], 8),
      head_dim: s2n(p[4], 128),
      quant_pesos: esQuant(qw) ? qw : "fp8",
      quant_cache: esQuant(qkv) ? qkv : "fp8",
    });
  }
  return out;
}

// --------------------------------------------------------------------------- //
// Serializar / leer
// --------------------------------------------------------------------------- //

export function serializar(e: Estado): string {
  const q = new URLSearchParams();
  if (e.modo !== ESTADO_INICIAL.modo) q.set("modo", "capacidad");
  const escalares: Array<[string, number, number]> = [
    ["uh", e.Uh, ESTADO_INICIAL.Uh],
    ["ch", e.Ch, ESTADO_INICIAL.Ch],
    ["ua", e.Ua, ESTADO_INICIAL.Ua],
    ["ca", e.Ca, ESTADO_INICIAL.Ca],
    ["slo", e.slo_ms, ESTADO_INICIAL.slo_ms],
    ["o", e.overhead_gb, ESTADO_INICIAL.overhead_gb],
    ["eff", e.eff, ESTADO_INICIAL.eff],
    ["g", e.G, ESTADO_INICIAL.G],
  ];
  for (const [k, v, def] of escalares) if (v !== def) q.set(k, n2s(v));

  // El catálogo solo entra si se tocó, para que el enlace habitual sea corto.
  const modelosCod = codificarModelos(e.modelos);
  if (modelosCod !== codificarModelos(MODELOS)) q.set("mods", modelosCod);

  const gpusCod = codificarGPUs(e.gpus);
  if (gpusCod !== codificarGPUs(GPUS)) q.set("gpus", gpusCod);

  // El id importa solo como índice dentro del catálogo vigente.
  const idx = e.modelos.findIndex((m) => m.id === e.modeloId);
  if (idx > 0) q.set("m", String(idx));

  return q.toString();
}

export function leer(query: string): Estado {
  const q = new URLSearchParams(query);

  const modelos = q.has("mods") ? decodificarModelos(q.get("mods")!) : null;
  const gpus = q.has("gpus") ? decodificarGPUs(q.get("gpus")!) : null;
  const catModelos = modelos ?? MODELOS;
  const catGpus = gpus ?? GPUS;

  const idx = Math.trunc(s2n(q.get("m") ?? undefined, 0));
  const seleccion = catModelos[idx] ?? catModelos[0];

  return {
    modo: q.get("modo") === "capacidad" ? "capacidad" : "dimensionar",
    Uh: Math.max(0, s2n(q.get("uh") ?? undefined, ESTADO_INICIAL.Uh)),
    Ch: Math.max(0, s2n(q.get("ch") ?? undefined, ESTADO_INICIAL.Ch)),
    Ua: Math.max(0, s2n(q.get("ua") ?? undefined, ESTADO_INICIAL.Ua)),
    Ca: Math.max(0, s2n(q.get("ca") ?? undefined, ESTADO_INICIAL.Ca)),
    slo_ms: Math.max(0.001, s2n(q.get("slo") ?? undefined, ESTADO_INICIAL.slo_ms)),
    overhead_gb: Math.max(0, s2n(q.get("o") ?? undefined, ESTADO_INICIAL.overhead_gb)),
    eff: Math.min(1, Math.max(0.05, s2n(q.get("eff") ?? undefined, ESTADO_INICIAL.eff))),
    G: Math.max(1, Math.trunc(s2n(q.get("g") ?? undefined, ESTADO_INICIAL.G))),
    modeloId: seleccion.id,
    modelos: catModelos,
    gpus: catGpus,
  };
}

/** La URL completa para el botón de compartir. */
export function enlace(e: Estado): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  const q = serializar(e);
  return origin + pathname + (q ? "?" + q : "") + "#calculadora";
}
