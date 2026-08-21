/**
 * Une el estado de la interfaz con el motor.
 *
 * No hay matemática nueva aquí: todo lo que se calcula sale de llamar a
 * `motor.ts`. Lo único que ocurre en este archivo es armar las entradas,
 * recorrer el catálogo y derivar lo que las gráficas y la tabla necesitan.
 */

import {
  Pm as PmDe,
  KVt as KVtDe,
  activas,
  activasTotal,
  bytesCache,
  capacidad,
  cruces,
  dimensionar,
  kappa,
  techos,
  type Capacidad,
  type Carga,
  type Cruces,
  type Dimensionamiento,
  type GPU,
  type Modelo,
  type Techos,
} from "./motor";
import { DUTY_AGENTE, DUTY_HUMANO, soloGPU, soloModelo, type GPUCatalogo } from "./catalogos";
import type { Estado } from "./urlEstado";

export interface Fila {
  gpu: GPUCatalogo;
  /** La GPU tal como la ve el motor, ya con el factor de eficiencia aplicado. */
  hw: GPU;
  techos: Techos;
  dim: Dimensionamiento;
  cap: Capacidad;
  cruces: Cruces;
  /** Agentes que caben si no hubiera ningún humano. */
  soloAgentes: number;
  /** Humanos que caben si no hubiera ningún agente. */
  soloUsuarios: number;
  /** La frontera de intercambio muestreada: [agentes, usuarios][]. */
  frontera: Array<[number, number]>;
}

export interface Resultados {
  modelo: Modelo;
  carga: Carga;
  /** Pₘ en bytes. */
  Pm: number;
  /** KVₜ en bytes por token. */
  KVt: number;
  activasHumanos: number;
  activasAgentes: number;
  activas: number;
  /** Contexto promedio ponderado por sesiones activas. */
  contextoPromedio: number;
  bytesCache: number;
  kappa: number;
  /** Porcentaje de las sesiones activas que son agentes. */
  pctAgentes: number;
  filas: Fila[];
  /** Solo las viables, en el orden del catálogo. */
  ok: Fila[];
  /** Frente de Pareto costo/TPOT, ordenado por TPOT. */
  pareto: Fila[];
  /** La recomendación: la más barata al dimensionar, la de más capacidad al medir. */
  mejor: Fila | null;
}

/** Cuántos puntos se muestrean para dibujar la frontera de intercambio. */
const PUNTOS_FRONTERA = 24;

export function cargaDe(e: Estado): Carga {
  return {
    humanos: { U: e.Uh, D: DUTY_HUMANO, C: e.Ch },
    agentes: { U: e.Ua, D: DUTY_AGENTE, C: e.Ca },
    slo_ms: e.slo_ms,
    overhead_gb: e.overhead_gb,
  };
}

export function modeloDe(e: Estado): Modelo {
  const m = e.modelos.find((x) => x.id === e.modeloId) ?? e.modelos[0];
  return soloModelo(m);
}

/**
 * Máximo de una sola población. Se obtiene reutilizando `capacidad`: se pone la
 * población de interés en el hueco de "humanos" y se dejan cero agentes, así el
 * motor aplica exactamente las mismas restricciones.
 */
function maximoDeUnaPoblacion(
  m: Modelo,
  g: GPU,
  c: Carga,
  G: number,
  cual: "humanos" | "agentes",
): number {
  const objetivo = c[cual];
  const otro = cual === "humanos" ? c.agentes : c.humanos;
  const r = capacidad(m, g, { ...c, humanos: objetivo, agentes: { ...otro, U: 0 } }, G);
  return r.alcanza ? r.usuarios : 0;
}

function fronteraDe(m: Modelo, g: GPU, c: Carga, G: number, maxAgentes: number): Array<[number, number]> {
  if (!Number.isFinite(maxAgentes) || maxAgentes <= 0) return [];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= PUNTOS_FRONTERA; i++) {
    const ua = (maxAgentes * i) / PUNTOS_FRONTERA;
    const r = capacidad(m, g, { ...c, agentes: { ...c.agentes, U: ua } }, G);
    if (!r.alcanza) break;
    // La frontera vive en el plano agentes×usuarios; los infinitos no se dibujan.
    if (!Number.isFinite(r.usuarios)) return [];
    pts.push([ua, Math.max(0, r.usuarios)]);
  }
  return pts;
}

export function calcular(e: Estado): Resultados {
  const modelo = modeloDe(e);
  const carga = cargaDe(e);

  const Ah = activas(carga.humanos);
  const Aa = activas(carga.agentes);
  const total = activasTotal(carga);
  const bc = bytesCache(carga, modelo);

  const filas: Fila[] = e.gpus
    .filter((g) => g.on)
    .map((g) => {
      // El factor de eficiencia es común a todo el catálogo: descuenta el ancho
      // de banda y los FLOPS nominales de cada GPU por igual.
      const hw: GPU = { ...soloGPU(g), eff: e.eff };
      const t = techos(modelo, hw, carga);
      const dim = dimensionar(modelo, hw, carga);
      const cap = capacidad(modelo, hw, carga, e.G);

      const soloAgentes = t.viable
        ? maximoDeUnaPoblacion(modelo, hw, carga, e.G, "agentes")
        : 0;
      const soloUsuarios = t.viable
        ? maximoDeUnaPoblacion(modelo, hw, carga, e.G, "humanos")
        : 0;

      return {
        gpu: g,
        hw,
        techos: t,
        dim,
        cap,
        cruces: cruces(modelo, hw, carga),
        soloAgentes,
        soloUsuarios,
        frontera: t.viable ? fronteraDe(modelo, hw, carga, e.G, soloAgentes) : [],
      };
    });

  const ok = filas.filter((f) => f.techos.viable);

  // Frente de Pareto en costo/TPOT: nadie la domina en ambas a la vez.
  const pareto = ok
    .filter((f) => f.dim.viable)
    .filter(
      (f, _i, arr) =>
        !arr.some(
          (o) =>
            o !== f &&
            o.dim.costo_hora <= f.dim.costo_hora &&
            o.dim.tpot_ms <= f.dim.tpot_ms &&
            (o.dim.costo_hora < f.dim.costo_hora || o.dim.tpot_ms < f.dim.tpot_ms),
        ),
    )
    .sort((a, b) => a.dim.tpot_ms - b.dim.tpot_ms);

  const candidatas = e.modo === "dimensionar" ? ok.filter((f) => f.dim.viable) : ok;
  const mejor = candidatas.length
    ? candidatas.reduce((a, b) =>
        e.modo === "dimensionar"
          ? b.dim.costo_hora < a.dim.costo_hora
            ? b
            : a
          : (b.cap.alcanza ? b.cap.usuarios : -1) > (a.cap.alcanza ? a.cap.usuarios : -1)
            ? b
            : a,
      )
    : null;

  return {
    modelo,
    carga,
    Pm: PmDe(modelo),
    KVt: KVtDe(modelo),
    activasHumanos: Ah,
    activasAgentes: Aa,
    activas: total,
    contextoPromedio:
      total > 0 ? (Ah * carga.humanos.C + Aa * carga.agentes.C) / total : 0,
    bytesCache: bc,
    kappa: kappa(carga),
    pctAgentes: total > 0 ? (Aa / total) * 100 : 0,
    filas,
    ok,
    pareto,
    mejor,
  };
}
