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
  modeloEn,
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
import type { Estado, Modo } from "./urlEstado";

export interface Fila {
  /** La unidad del catálogo: una GPU suelta o un chasis completo. */
  gpu: GPUCatalogo;
  /** La unidad tal como la ve el motor, ya con el factor de eficiencia aplicado. */
  hw: GPU;
  techos: Techos;
  dim: Dimensionamiento;
  cap: Capacidad;
  cruces: Cruces;
  /**
   * Cuántas unidades se evalúan en el modo capacidad. En las vistas de GPUs y de
   * chasis es el `G` que fijó el usuario; en "ambos", `G` cuenta GPUs y un chasis
   * se redondea hacia arriba hasta cubrirlas (ver `unidadesEnCapacidad`).
   */
  unidadesCap: number;
  /**
   * Cuántas veces se multiplica el caché por token al repartir las cabezas de KV
   * entre las n GPUs de la unidad. Es 1 salvo que n supere las cabezas del modelo.
   */
  kvRep: number;
  /**
   * Otra opción de las que se comparan no cuesta más y rinde igual o mejor —en
   * latencia al dimensionar, en usuarios que caben al medir capacidad—, y es mejor
   * en alguna de las dos: esta ya no conviene. Es lo que queda fuera del frente de
   * Pareto. Una unidad desmarcada, o inviable, ni se marca ni marca a las demás.
   */
  dominada: boolean;
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

/**
 * Una fila que se puede dibujar: viable y con números que una escala admite.
 * Con F(g)=0 (TFLOPS en cero mientras se reteclea el campo) el motor devuelve
 * G=Infinity y TPOT=NaN sin dejar de ser "viable", y un solo NaN en el arreglo
 * vuelve NaN el Math.max de la escala y borra la gráfica entera.
 */
export const dibujable = (f: Fila): boolean =>
  f.dim.viable && Number.isFinite(f.dim.tpot_ms) && Number.isFinite(f.dim.costo_hora);

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

/** Las unidades que se comparan según la vista elegida, en el orden del catálogo. */
export const unidadesDe = (e: Estado): GPUCatalogo[] =>
  e.vista === "gpus" ? e.gpus : e.vista === "chasis" ? e.chasis : [...e.gpus, ...e.chasis];

/**
 * Cuántas unidades de `g` se evalúan en el modo capacidad.
 *
 * Con GPUs sueltas o con chasis solos, `G` cuenta unidades y es lo que fijó el
 * usuario. Con las dos cosas en la misma gráfica, 12 chasis serían 96 GPUs contra
 * 12: la comparación no diría nada. Ahí `G` cuenta GPUs, y como un chasis solo se
 * compra entero se redondea hacia arriba: con G=12, una H100 suelta son 12 GPUs y
 * un DGX H100 son 2 chasis (16 GPUs). Una GPU suelta (n=1) no cambia nunca.
 */
export const unidadesEnCapacidad = (e: Estado, g: GPUCatalogo): number =>
  e.vista === "ambos" ? Math.max(1, Math.ceil(e.G / Math.max(1, g.n))) : e.G;

/**
 * Las opciones dominadas: otra cuesta lo mismo o menos y rinde igual o mejor, y es
 * estrictamente mejor en alguna de las dos cosas.
 *
 * Qué es "rendir" lo fija el modo. Al dimensionar, cada opción ya cumple el SLO con
 * las unidades que hacen falta, y lo que distingue a unas de otras es el TPOT que
 * logran: menos es mejor. Al medir capacidad, con el hardware fijo, es cuántos
 * usuarios caben junto a los agentes fijados: más es mejor, y una opción que ni
 * siquiera aguanta esos agentes rinde peor que cualquiera que sí.
 *
 * Recibe solo las candidatas —incluidas en la comparación y viables—, y devuelve
 * los ids de las que otra supera. Las filas cuyos números no se pueden comparar
 * (un NaN mientras se reteclea un campo) ni dominan ni quedan dominadas.
 */
export function dominadasDe(candidatas: Fila[], modo: Modo): Set<string> {
  const puntos = candidatas
    .map((f) =>
      modo === "dimensionar"
        ? { id: f.gpu.id, costo: f.dim.costo_hora, malo: f.dim.tpot_ms, valido: dibujable(f) }
        : {
            id: f.gpu.id,
            costo: f.cap.costo_hora,
            malo: f.cap.alcanza ? -f.cap.usuarios : Infinity,
            valido: Number.isFinite(f.cap.costo_hora) && !Number.isNaN(f.cap.usuarios),
          },
    )
    .filter((p) => p.valido);

  const dominadas = new Set<string>();
  for (const p of puntos) {
    const hay = puntos.some(
      (o) =>
        o !== p &&
        o.costo <= p.costo &&
        o.malo <= p.malo &&
        (o.costo < p.costo || o.malo < p.malo),
    );
    if (hay) dominadas.add(p.id);
  }
  return dominadas;
}

export function calcular(e: Estado): Resultados {
  const modelo = modeloDe(e);
  const carga = cargaDe(e);

  const Ah = activas(carga.humanos);
  const Aa = activas(carga.agentes);
  const total = activasTotal(carga);
  const bc = bytesCache(carga, modelo);

  // Se calculan TODAS las GPUs del catálogo, incluidas las desmarcadas: su fila
  // tiene que seguir en la tabla, porque es donde vive la única casilla que
  // puede volver a marcarlas. El filtro por `on` se aplica al derivar `ok`, que
  // es lo que alimenta gráficas, Pareto y recomendación.
  const sinMarcar: Fila[] = unidadesDe(e)
    .map((g) => {
      // El factor de eficiencia es común a todo el catálogo: descuenta el ancho
      // de banda y los FLOPS nominales de cada unidad por igual.
      const hw: GPU = { ...soloGPU(g), eff: e.eff };
      const t = techos(modelo, hw, carga);
      const dim = dimensionar(modelo, hw, carga);
      const unidadesCap = unidadesEnCapacidad(e, g);
      const cap = capacidad(modelo, hw, carga, unidadesCap);

      const soloAgentes = t.viable
        ? maximoDeUnaPoblacion(modelo, hw, carga, unidadesCap, "agentes")
        : 0;
      const soloUsuarios = t.viable
        ? maximoDeUnaPoblacion(modelo, hw, carga, unidadesCap, "humanos")
        : 0;

      return {
        gpu: g,
        hw,
        techos: t,
        dim,
        cap,
        cruces: cruces(modelo, hw, carga),
        unidadesCap,
        dominada: false,
        kvRep: modelo.kv_heads > 0 ? modeloEn(modelo, hw).kv_heads / modelo.kv_heads : 1,
        soloAgentes,
        soloUsuarios,
        frontera: t.viable ? fronteraDe(modelo, hw, carga, unidadesCap, soloAgentes) : [],
      };
    });

  // Las candidatas son las que entran en la comparación; sobre ellas se decide
  // cuáles quedan dominadas según lo que mide el modo vigente.
  const esCandidata = (f: Fila) => f.gpu.on && f.techos.viable;
  const candidatas = sinMarcar.filter(esCandidata);
  const dominadas = dominadasDe(candidatas, e.modo);
  const filas: Fila[] = sinMarcar.map((f) => (dominadas.has(f.gpu.id) ? { ...f, dominada: true } : f));
  const ok = filas.filter(esCandidata);

  // Frente de Pareto en costo/TPOT: lo que nadie domina en ambas a la vez. Es el de
  // dimensionar aunque el modo vigente sea otro, porque es el que dibuja esa gráfica.
  const dominadasEnCosto = e.modo === "dimensionar" ? dominadas : dominadasDe(candidatas, "dimensionar");
  const pareto = ok
    .filter(dibujable)
    .filter((f) => !dominadasEnCosto.has(f.gpu.id))
    .sort((a, b) => a.dim.tpot_ms - b.dim.tpot_ms);

  const aspirantes = e.modo === "dimensionar" ? ok.filter(dibujable) : ok;
  const mejor = aspirantes.length
    ? aspirantes.reduce((a, b) =>
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
