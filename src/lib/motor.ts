/**
 * Motor de dimensionamiento de inferencia LLM.
 *
 * Puerto directo de `motor.py`. Ese archivo es la fuente de verdad de la
 * matemática: aquí no hay ninguna fórmula distinta, ni redondeos de más, ni
 * lógica de interfaz. El orden de las operaciones se conserva tal cual, porque
 * Python y JavaScript comparten el flotante de 64 bits y así los dos motores
 * devuelven bit a bit lo mismo.
 *
 * Todas las unidades internas son SI: bytes, bytes/s, FLOP/s, segundos.
 * Las conversiones a GB, GB/s, TFLOPS y ms viven en la capa de presentación.
 *
 * Implementa:
 *   - TPOT con lote y las tres restricciones (memoria, latencia, cómputo)
 *   - Modo dimensionar: dada la carga, cuántas GPUs hacen falta
 *   - Modo capacidad:   dado el hardware, para cuánta carga alcanza
 *   - Cruces de régimen (Ceq1, Ceq3)
 */

export const GB = 1024 ** 3;

/** Bytes por parámetro según cuantización. */
export const QUANT = {
  fp32: 4.0,
  fp16: 2.0,
  bf16: 2.0,
  fp8: 1.0,
  int4: 0.5,
} as const;

export type Quant = keyof typeof QUANT;

export const QUANTS = Object.keys(QUANT) as Quant[];

/** El cuello de botella, con los mismos nombres que usa motor.py. */
export type Cuello = "memoria" | "latencia" | "computo";

// --------------------------------------------------------------------------- //
// Entradas
// --------------------------------------------------------------------------- //

/** Arquitectura del LLM. Los valores salen del config.json en HuggingFace. */
export interface Modelo {
  nombre: string;
  /** N — parámetros, en miles de millones. */
  N: number;
  /** Lₐ — capas que generan KV cache (no las totales). */
  capas_atn: number;
  /** H — cabezas de KV. */
  kv_heads: number;
  /** dₖ — dimensión por cabeza. */
  head_dim: number;
  quant_pesos: Quant;
  quant_cache: Quant;
}

export const bW = (m: Modelo): number => QUANT[m.quant_pesos];
export const bKV = (m: Modelo): number => QUANT[m.quant_cache];

/** Pₘ — tamaño del modelo en bytes. */
export const Pm = (m: Modelo): number => m.N * 1e9 * bW(m);

/** KVₜ — bytes de caché por token de contexto.  2·Lₐ·H·dₖ·b */
export const KVt = (m: Modelo): number =>
  2 * m.capas_atn * m.kv_heads * m.head_dim * bKV(m);

/** Hardware. `eff` descuenta el ancho de banda y los FLOPS nominales. */
export interface GPU {
  nombre: string;
  vram_gb: number;
  /** ancho de banda nominal, GB/s */
  bw_gbs: number;
  /** FLOPS pico en la precisión de cómputo, TFLOPS */
  tflops: number;
  /** USD/h — CAPEX amortizado + OPEX */
  precio_hora: number;
  eff: number;
}

/** Vₜ — VRAM total en bytes. */
export const Vt = (g: GPU): number => g.vram_gb * GB;

/** W — ancho de banda efectivo, bytes/s. */
export const W = (g: GPU): number => g.bw_gbs * 1e9 * g.eff;

/** F — FLOPS efectivos. */
export const F = (g: GPU): number => g.tflops * 1e12 * g.eff;

/** Un perfil de uso: cuántos hay, qué tan activos están y cuánto contexto usan. */
export interface Poblacion {
  /** U — número de sesiones registradas. */
  U: number;
  /** D — duty cycle, fracción de tiempo generando. */
  D: number;
  /** C — contexto promedio en operación, en tokens. */
  C: number;
}

/** Sesiones generando en un instante cualquiera. */
export const activas = (p: Poblacion): number => p.U * p.D;

export interface Carga {
  humanos: Poblacion;
  agentes: Poblacion;
  /** TPOT máximo aceptable, en ms. */
  slo_ms: number;
  /** O — memoria del motor de inferencia, en GB. */
  overhead_gb: number;
}

/** SLO en segundos. */
export const slo = (c: Carga): number => c.slo_ms / 1000.0;

export const activasTotal = (c: Carga): number =>
  activas(c.humanos) + activas(c.agentes);

/** Bytes de KV cache que demanda toda la carga activa. */
export const bytesCache = (c: Carga, m: Modelo): number =>
  KVt(m) * (activas(c.humanos) * c.humanos.C + activas(c.agentes) * c.agentes.C);

/** κ — cuántos usuarios equivale un agente. */
export function kappa(c: Carga): number {
  const den = c.humanos.D * c.humanos.C;
  return den !== 0 ? (c.agentes.D * c.agentes.C) / den : Infinity;
}

// --------------------------------------------------------------------------- //
// Techos: los tres límites de una GPU
// --------------------------------------------------------------------------- //

export interface Techos {
  /** bytes de caché que permite la VRAM */
  memoria: number;
  /** bytes de caché que permite el SLO */
  latencia: number;
  /** secuencias que permite el cálculo (B_comp) */
  computo: number;
  viable: boolean;
  motivo: string;
}

export function techos(m: Modelo, g: GPU, c: Carga): Techos {
  const t_mem = Vt(g) - Pm(m) - c.overhead_gb * GB;
  const t_lat = slo(c) * W(g) - Pm(m);
  const b_comp = (slo(c) * F(g)) / (2 * m.N * 1e9);

  if (t_mem <= 0) {
    return {
      memoria: t_mem,
      latencia: t_lat,
      computo: b_comp,
      viable: false,
      motivo: m.nombre + " no cabe en " + g.nombre,
    };
  }
  if (t_lat <= 0) {
    return {
      memoria: t_mem,
      latencia: t_lat,
      computo: b_comp,
      viable: false,
      motivo: "SLO de " + formatoG(c.slo_ms) + " ms inalcanzable en " + g.nombre,
    };
  }
  return { memoria: t_mem, latencia: t_lat, computo: b_comp, viable: true, motivo: "" };
}

/**
 * Equivalente de f"{x:g}" en Python, que es como motor.py formatea el SLO dentro
 * del mensaje de inviabilidad. Se replica para que los textos coincidan letra
 * por letra con la salida de referencia.
 */
function formatoG(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(x)));
  if (exp < -4 || exp >= 6) {
    const [mant, e] = x.toExponential(5).split("e");
    const signo = e[0] === "-" ? "-" : "+";
    const dig = e.replace(/^[+-]/, "").padStart(2, "0");
    return recortarCeros(mant) + "e" + signo + dig;
  }
  return recortarCeros(x.toPrecision(6));
}

function recortarCeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * Réplica de max((a,"memoria"), (b,"latencia"), (c,"computo"))[1] de Python:
 * compara primero el número y desempata con el orden lexicográfico del nombre,
 * quedándose con el primero cuando nada es estrictamente mayor. El desempate
 * importa: con dos restricciones empatadas Python reporta "memoria" antes que
 * "latencia", y "latencia" antes que "computo".
 */
function maxTupla(cands: ReadonlyArray<readonly [number, Cuello]>): Cuello {
  let mejor = cands[0];
  for (let i = 1; i < cands.length; i++) {
    const c = cands[i];
    if (c[0] > mejor[0] || (c[0] === mejor[0] && c[1] > mejor[1])) mejor = c;
  }
  return mejor[1];
}

// --------------------------------------------------------------------------- //
// Modo 1 — dimensionar: dada la carga, ¿cuántas GPUs?
// --------------------------------------------------------------------------- //

export interface Dimensionamiento {
  gpu: string;
  viable: boolean;
  motivo: string;
  G: number;
  cuello: Cuello | "";
  G_mem: number;
  G_lat: number;
  G_comp: number;
  /** lote resultante por GPU */
  B: number;
  tpot_ms: number;
  tok_s_sesion: number;
  /** tokens/s del sistema completo */
  throughput: number;
  costo_hora: number;
  cumple_slo: boolean;
}

const dimVacio = (gpu: string, motivo: string): Dimensionamiento => ({
  gpu,
  viable: false,
  motivo,
  G: 0,
  cuello: "",
  G_mem: 0.0,
  G_lat: 0.0,
  G_comp: 0.0,
  B: 0.0,
  tpot_ms: 0.0,
  tok_s_sesion: 0.0,
  throughput: 0.0,
  costo_hora: 0.0,
  cumple_slo: false,
});

export function dimensionar(m: Modelo, g: GPU, c: Carga): Dimensionamiento {
  const t = techos(m, g, c);
  if (!t.viable) return dimVacio(g.nombre, t.motivo);

  const bc = bytesCache(c, m);
  const G_mem = bc / t.memoria;
  const G_lat = bc / t.latencia;
  const G_comp = t.computo > 0 ? activasTotal(c) / t.computo : Infinity;

  const G = Math.max(1, Math.ceil(Math.max(G_mem, G_lat, G_comp)));
  const cuello = maxTupla([
    [G_mem, "memoria"],
    [G_lat, "latencia"],
    [G_comp, "computo"],
  ]);

  const B = activasTotal(c) / G;
  const t_mem = (Pm(m) + bc / G) / W(g);
  const t_cmp = (2 * m.N * 1e9 * B) / F(g);
  const tpot = Math.max(t_mem, t_cmp);

  return {
    gpu: g.nombre,
    viable: true,
    motivo: "",
    G,
    cuello,
    G_mem,
    G_lat,
    G_comp,
    B,
    tpot_ms: tpot * 1000,
    tok_s_sesion: 1 / tpot,
    throughput: activasTotal(c) / tpot,
    costo_hora: G * g.precio_hora,
    cumple_slo: tpot <= slo(c),
  };
}

// --------------------------------------------------------------------------- //
// Modo 2 — capacidad: dado el hardware y los agentes, ¿cuántos usuarios?
// --------------------------------------------------------------------------- //

export interface Capacidad {
  gpu: string;
  viable: boolean;
  motivo: string;
  G: number;
  /** humanos que caben además de los agentes */
  usuarios: number;
  /** los que se fijaron */
  agentes: number;
  max_solo_agentes: number;
  cuello: Cuello | "";
  B: number;
  tpot_ms: number;
  throughput: number;
  costo_hora: number;
  alcanza: boolean;
}

const capVacia = (gpu: string, motivo: string): Capacidad => ({
  gpu,
  viable: false,
  motivo,
  G: 0,
  usuarios: 0.0,
  agentes: 0.0,
  max_solo_agentes: 0.0,
  cuello: "",
  B: 0.0,
  tpot_ms: 0.0,
  throughput: 0.0,
  costo_hora: 0.0,
  alcanza: true,
});

/** Fija G y el número de agentes; devuelve cuántos humanos caben además. */
export function capacidad(m: Modelo, g: GPU, c: Carga, G: number): Capacidad {
  const t = techos(m, g, c);
  if (!t.viable) return capVacia(g.nombre, t.motivo);

  const h = c.humanos;
  const a = c.agentes;
  const por_agente = KVt(m) * a.D * a.C; // bytes por agente registrado
  const por_usuario = KVt(m) * h.D * h.C; // bytes por usuario registrado
  const usado_ag = a.U * por_agente;

  const techo_bytes = G * Math.min(t.memoria, t.latencia);
  const lim_bytes: Cuello = t.memoria <= t.latencia ? "memoria" : "latencia";

  if (usado_ag > techo_bytes || a.U * a.D > G * t.computo) {
    return {
      ...capVacia(g.nombre, "los agentes solos no caben"),
      viable: true,
      G,
      agentes: a.U,
      alcanza: false,
      costo_hora: G * g.precio_hora,
    };
  }

  const u_bytes = por_usuario !== 0 ? (techo_bytes - usado_ag) / por_usuario : Infinity;
  const u_comp = h.D !== 0 ? (G * t.computo - a.U * a.D) / h.D : Infinity;
  const usuarios = Math.min(u_bytes, u_comp);
  const cuello: Cuello = u_comp < u_bytes ? "computo" : lim_bytes;

  const bc = KVt(m) * (usuarios * h.D * h.C + a.U * a.D * a.C);
  const B = (usuarios * h.D + a.U * a.D) / G;
  const tpot = Math.max((Pm(m) + bc / G) / W(g), (2 * m.N * 1e9 * B) / F(g));

  return {
    gpu: g.nombre,
    viable: true,
    motivo: "",
    G,
    usuarios,
    agentes: a.U,
    max_solo_agentes: por_agente !== 0 ? techo_bytes / por_agente : Infinity,
    cuello,
    B,
    tpot_ms: tpot * 1000,
    throughput: (usuarios * h.D + a.U * a.D) / tpot,
    costo_hora: G * g.precio_hora,
    alcanza: true,
  };
}

// --------------------------------------------------------------------------- //
// Cruces de régimen — en qué contexto cambia el cuello de botella
// --------------------------------------------------------------------------- //

export interface Cruces {
  Ceq1_computo_latencia: number;
  Ceq3_computo_memoria: number;
  regimen: "memoria" | "latencia";
}

/**
 * Contextos donde se cruzan los pares de restricciones.
 * Suponen una sola población; con carga mixta aplica el contexto promedio.
 */
export function cruces(m: Modelo, g: GPU, c: Carga): Cruces {
  const t = techos(m, g, c);
  const den = slo(c) * F(g) * KVt(m);
  return {
    Ceq1_computo_latencia: den !== 0 ? (t.latencia * 2 * m.N * 1e9) / den : Infinity,
    Ceq3_computo_memoria: den !== 0 ? (t.memoria * 2 * m.N * 1e9) / den : Infinity,
    // Ceq2 depende de B_max, que a su vez depende del contexto:
    // el cruce memoria/latencia es directo, ambos techos acotan bytes.
    regimen: t.memoria <= t.latencia ? "memoria" : "latencia",
  };
}

/** Tokens/s máximos del sistema, sin importar cuántas sesiones se agreguen. */
export function techosAbsolutos(
  m: Modelo,
  g: GPU,
  contexto: number,
): { por_memoria: number; por_computo: number } {
  return {
    por_memoria: W(g) / (KVt(m) * contexto),
    por_computo: F(g) / (2 * m.N * 1e9),
  };
}
