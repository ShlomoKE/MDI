/**
 * La calculadora completa: parámetros a la izquierda, resultados a la derecha.
 *
 * El estado vive en la URL, así que cualquier configuración se comparte con un
 * enlace. Nada se calcula aquí: todo pasa por `resultados.ts`, que a su vez solo
 * llama a `motor.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import BarrasPresion from "./BarrasPresion";
import Ecuacion from "./Ecuacion";
import EditorCatalogo from "./EditorCatalogo";
import GraficaFrontera from "./GraficaFrontera";
import GraficaPareto from "./GraficaPareto";
import TablaGPUs from "./TablaGPUs";
import { Boton, Campo, Fijo, Kpi, Seccion } from "./Campos";
import { DUTY_AGENTE, DUTY_HUMANO, type GPUCatalogo, type ModeloCatalogo } from "../lib/catalogos";
import { descargarCSV, nombreConFecha, type Celda } from "../lib/csv";
import { CLASE_CUELLO, colorCuello, enGB, enKB, fmt, fmtCorto, nombreCuello, usd } from "../lib/formato";
import { calcular } from "../lib/resultados";
import { ESTADO_INICIAL, enlace, leer, serializar, type Estado, type Modo } from "../lib/urlEstado";

const MODOS: Array<[Modo, string]> = [
  ["dimensionar", "¿Cuánto hardware?"],
  ["capacidad", "¿Para cuánto alcanza?"],
];

/** Las tres restricciones en LaTeX, para mostrar la que está mandando. */
const ECUACIONES = {
  memoria: String.raw`G \;\ge\; \frac{\mathrm{KV}_{\text{total}}}{V_t - P_m - O}`,
  latencia: String.raw`G \;\ge\; \frac{\mathrm{KV}_{\text{total}}}{\mathrm{SLO}\cdot W - P_m}`,
  computo: String.raw`G \;\ge\; \frac{A}{\dfrac{\mathrm{SLO}\cdot F}{2N}}`,
} as const;

export function Calculadora() {
  const [estado, setEstado] = useState<Estado>(() =>
    typeof window === "undefined" ? ESTADO_INICIAL : leer(window.location.search),
  );
  const [foco, setFoco] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const set = useCallback(
    (cambios: Partial<Estado>) => setEstado((e) => ({ ...e, ...cambios })),
    [],
  );

  // El estado se refleja en la URL sin ensuciar el historial: replaceState, no
  // pushState, para que el botón de atrás siga saliendo de la página.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = serializar(estado);
      const url = window.location.pathname + (q ? "?" + q : "") + window.location.hash;
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(t);
  }, [estado]);

  const r = useMemo(() => calcular(estado), [estado]);
  const dim = estado.modo === "dimensionar";
  const modelo = r.modelo;

  // El foco puede caer en una GPU excluida de la comparación: sigue teniendo
  // fila en la tabla y su detalle es igual de válido.
  const activo = r.filas.find((f) => f.gpu.id === foco && f.techos.viable) ?? r.mejor;
  const cuelloActivo = activo
    ? dim
      ? activo.dim.cuello
      : activo.cap.alcanza
        ? activo.cap.cuello
        : ""
    : "";

  const onCambiarGpu = (id: string, cambios: Partial<GPUCatalogo>) =>
    set({ gpus: estado.gpus.map((g) => (g.id === id ? { ...g, ...cambios } : g)) });

  const onEliminarGpu = (id: string) =>
    set({ gpus: estado.gpus.filter((g) => g.id !== id) });

  const onModelos = (modelos: ModeloCatalogo[], modeloId?: string) =>
    set({ modelos, modeloId: modeloId ?? estado.modeloId });

  const editarModeloActivo = (cambios: Partial<ModeloCatalogo>) =>
    set({
      modelos: estado.modelos.map((m) => (m.id === estado.modeloId ? { ...m, ...cambios } : m)),
    });

  const copiarEnlace = async () => {
    const url = enlace(estado);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles: al menos dejamos la URL en la barra.
      window.location.hash = "calculadora";
    }
  };

  const exportar = () => descargarCSV(nombreConFecha(dim ? "dimensionar" : "capacidad"), filasCSV(estado, r, dim));

  return (
    <div className="bg-fondo text-tinta">
      {/* ------------------------------ Encabezado ------------------------------ */}
      <div className="px-4 sm:px-6 py-5 border-y border-linea bg-superficie">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-cond font-bold text-2xl sm:text-[26px] tracking-tight">
              Calculadora MDI
            </h2>
            <p className="text-sm mt-1 text-suave max-w-prose">
              {dim
                ? "Define la carga: la calculadora devuelve el mínimo de GPUs que cumple memoria, latencia y cómputo."
                : "Fija el hardware: la calculadora escala la mezcla de carga hasta donde alcance."}
            </p>
          </div>
          <div
            className="flex rounded border border-linea overflow-hidden shrink-0"
            role="group"
            aria-label="Modo de cálculo"
          >
            {MODOS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ modo: k })}
                aria-pressed={estado.modo === k}
                className={
                  "px-3 sm:px-4 py-2 text-sm transition-colors " +
                  (estado.modo === k
                    ? "bg-tinta text-superficie"
                    : "bg-superficie text-suave hover:bg-fondo")
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* ------------------------------ Parámetros ------------------------------ */}
        <div className="p-4 sm:p-6 lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-linea bg-superficie">
          {!dim && (
            <Seccion titulo="Hardware disponible">
              <Campo label="GPUs por configuración" valor={estado.G} set={(v) => set({ G: Math.max(1, Math.round(v)) })} paso={1} min={1} />
              <p className="text-xs mt-2 leading-relaxed text-suave">
                Se evalúa cada GPU del catálogo como si tuvieras {estado.G} unidades de ese tipo.
              </p>
            </Seccion>
          )}

          <Seccion titulo="Usuarios">
            {dim ? (
              <Campo label="Usuarios" valor={estado.Uh} set={(v) => set({ Uh: v })} paso={100} />
            ) : (
              <Fijo label="Usuarios" valor="calculado" />
            )}
            <Fijo label="Duty cycle" valor={DUTY_HUMANO} nota="peor caso" />
            <Campo label="Contexto" valor={estado.Ch} set={(v) => set({ Ch: v })} paso={500} sufijo="tok" />
          </Seccion>

          <Seccion titulo="Agentes">
            <Campo label="Agentes" valor={estado.Ua} set={(v) => set({ Ua: v })} paso={5} />
            <Fijo label="Duty cycle" valor={DUTY_AGENTE} nota="peor caso" />
            <Campo label="Contexto" valor={estado.Ca} set={(v) => set({ Ca: v })} paso={5000} sufijo="tok" />
            <p className="text-xs mt-2 leading-relaxed text-suave">
              {dim
                ? "Duty cycles fijos en el peor caso. Trazas reales de agentes de código dan ~0.42 (13 s de generación por 18 s de herramientas); 0.95 corresponde a herramientas rápidas."
                : "Fijas cuántos agentes quieres; la calculadora devuelve cuántos usuarios caben además de ellos."}
            </p>
          </Seccion>

          <Seccion titulo="Objetivo">
            <Campo label="SLO por token" valor={estado.slo_ms} set={(v) => set({ slo_ms: Math.max(0.1, v) })} paso={5} min={0.1} sufijo="ms" />
            <p className="text-xs mt-2 text-suave">
              {fmt(1000 / estado.slo_ms)} tokens/s por sesión
            </p>
          </Seccion>

          <Seccion titulo="Modelo">
            <select
              value={estado.modeloId}
              aria-label="Modelo"
              onChange={(e) => set({ modeloId: e.target.value })}
              className="campo w-full text-sm px-2 py-1.5 mb-2"
            >
              {estado.modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <Campo label="N parámetros" valor={modelo.N} set={(v) => editarModeloActivo({ N: v })} sufijo="B" />
            <Campo label="Lₐ capas atn." valor={modelo.capas_atn} set={(v) => editarModeloActivo({ capas_atn: v })} ayuda="Capas que generan KV cache, no las totales" />
            <Campo label="H cabezas KV" valor={modelo.kv_heads} set={(v) => editarModeloActivo({ kv_heads: v })} />
            <Campo label="dₖ dimensión" valor={modelo.head_dim} set={(v) => editarModeloActivo({ head_dim: v })} paso={32} />
            <div className="flex gap-2 mt-3">
              {(
                [
                  ["Pesos", "quant_pesos"],
                  ["Caché", "quant_cache"],
                ] as Array<[string, "quant_pesos" | "quant_cache"]>
              ).map(([lbl, campo]) => (
                <div key={campo} className="flex-1">
                  <label className="text-xs mb-1 block text-suave" htmlFor={"q-" + campo}>
                    {lbl}
                  </label>
                  <select
                    id={"q-" + campo}
                    value={modelo[campo]}
                    onChange={(e) => editarModeloActivo({ [campo]: e.target.value } as Partial<ModeloCatalogo>)}
                    className="campo w-full text-sm px-2 py-1"
                  >
                    {["fp32", "fp16", "bf16", "fp8", "int4"].map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Campo label="Overhead motor" valor={estado.overhead_gb} set={(v) => set({ overhead_gb: v })} sufijo="GB" />
            </div>
            <Campo
              label="Eficiencia de W"
              valor={estado.eff}
              set={(v) => set({ eff: Math.min(1, Math.max(0.05, v)) })}
              paso={0.05}
              min={0.05}
              max={1}
            />
            <p className="text-xs mt-2 leading-relaxed text-suave">
              El TPOT teórico sale 20–40 % optimista: el caché compite por el mismo ancho de
              banda y hay overhead de kernels. 0.5 es lo que respaldan los benchmarks públicos
              en modelos grandes; ajústalo con tu medición real. También descuenta los FLOPS.
            </p>
          </Seccion>

          <div className="flex flex-wrap gap-2">
            <Boton onClick={exportar} titulo="Descargar la tabla de resultados">
              Exportar CSV
            </Boton>
            <Boton onClick={copiarEnlace} titulo="Copiar el enlace con esta configuración">
              {copiado ? "Copiado ✓" : "Copiar enlace"}
            </Boton>
          </div>
        </div>

        {/* ------------------------------ Resultados ------------------------------ */}
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Kpi k="Pesos en VRAM" v={`${enGB(r.Pm)} GB`} />
            <Kpi k="KV por token" v={`${enKB(r.KVt)} KB`} />
            {dim ? (
              <Kpi k="Sesiones activas" v={fmt(r.activas)} />
            ) : (
              <Kpi k="Contexto promedio" v={`${fmt(r.contextoPromedio)} tok`} />
            )}
            <Kpi k="κ agente/usuario" v={`${fmt(r.kappa)}×`} col="text-lat" />
          </div>

          <div className="rounded border border-linea bg-superficie mb-6 p-3">
            <div className="flex items-baseline justify-between mb-1 px-1 sm:px-2 flex-wrap gap-2">
              <h3 className="rotulo text-tinta">
                {dim ? "Costo contra latencia" : `Frontera de capacidad con ${estado.G} GPUs`}
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
                {(["memoria", "latencia", "computo"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <i
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: colorCuello(k) }}
                    />
                    limita {nombreCuello(k)}
                  </span>
                ))}
              </div>
            </div>
            {dim ? (
              <GraficaPareto
                filas={r.ok}
                pareto={r.pareto}
                slo_ms={estado.slo_ms}
                foco={foco}
                setFoco={setFoco}
              />
            ) : (
              <GraficaFrontera filas={r.ok} Ua={estado.Ua} G={estado.G} foco={foco} setFoco={setFoco} />
            )}
          </div>

          <TablaGPUs
            filas={r.filas}
            modo={estado.modo}
            eff={estado.eff}
            slo_ms={estado.slo_ms}
            G={estado.G}
            mejorId={r.mejor ? r.mejor.gpu.id : null}
            foco={foco}
            setFoco={setFoco}
            onCambiar={onCambiarGpu}
            onEliminar={onEliminarGpu}
          />

          <div className="mt-4">
            <EditorCatalogo
              gpus={estado.gpus}
              modelos={estado.modelos}
              modeloId={estado.modeloId}
              onGpus={(gpus) => set({ gpus })}
              onModelos={onModelos}
            />
          </div>

          {/* --------------------- Detalle de la GPU en foco --------------------- */}
          {activo && (
            <div className="rounded border border-linea bg-superficie mt-4 p-4">
              <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                <h3 className="rotulo text-tinta">
                  {activo.gpu.nombre} · {dim ? activo.dim.G : estado.G} GPU
                  {(dim ? activo.dim.G : estado.G) > 1 ? "s" : ""}
                </h3>
                <span className="text-xs text-suave hidden sm:block">
                  pasa el cursor sobre otra GPU para comparar
                </span>
              </div>

              {dim ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi
                    k="Por sesión activa"
                    v={`${fmt(activo.dim.tok_s_sesion, 1)} tok/s`}
                    col={activo.dim.cumple_slo ? "text-mem" : "text-lat"}
                  />
                  <Kpi k="Lote por GPU" v={`${fmt(activo.dim.B, 1)} sesiones`} />
                  <Kpi k="Consumo usuarios" v={`${fmtCorto(r.activasHumanos * activo.dim.tok_s_sesion)} tok/s`} />
                  <Kpi k="Consumo agentes" v={`${fmtCorto(r.activasAgentes * activo.dim.tok_s_sesion)} tok/s`} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi k="Agentes fijados" v={fmt(estado.Ua)} col="text-lat" />
                  <Kpi
                    k="Usuarios que caben"
                    v={activo.cap.alcanza ? fmt(activo.cap.usuarios) : "no alcanza"}
                    col={activo.cap.alcanza ? "text-mem" : "text-lat"}
                  />
                  <Kpi
                    k="Por sesión activa"
                    v={activo.cap.alcanza ? `${fmt(1000 / activo.cap.tpot_ms, 1)} tok/s` : "—"}
                    col={activo.cap.alcanza && activo.cap.tpot_ms <= estado.slo_ms ? "text-mem" : "text-lat"}
                  />
                  <Kpi
                    k="Costo por agente"
                    v={`${usd(activo.cap.costo_hora / Math.max(1, estado.Ua))}/h`}
                  />
                </div>
              )}

              {/* La restricción que manda, con su ecuación */}
              {cuelloActivo && (
                <div
                  className={
                    "mt-4 rounded border p-3 flex flex-col sm:flex-row sm:items-center gap-3 " +
                    CLASE_CUELLO[cuelloActivo].fondo +
                    " border-linea"
                  }
                >
                  <div className="min-w-0">
                    <div className={"rotulo " + CLASE_CUELLO[cuelloActivo].texto}>
                      Manda {nombreCuello(cuelloActivo)}
                    </div>
                    <p className="text-xs mt-1 text-tinta/80 leading-relaxed">
                      {cuelloActivo === "memoria"
                        ? "La VRAM que sobra después de los pesos y del overhead no alcanza para el caché."
                        : cuelloActivo === "latencia"
                          ? "Leer los pesos más el caché en cada paso no cabe dentro del SLO."
                          : "El lote saturó los Tensor Cores: la multiplicación ya no es gratis."}
                    </p>
                  </div>
                  <div className="sm:ml-auto shrink-0">
                    <Ecuacion tex={ECUACIONES[cuelloActivo]} bloque />
                  </div>
                </div>
              )}

              {dim && (
                <div className="mt-4 sm:hidden">
                  <div className="text-xs text-suave mb-1">Presión por restricción</div>
                  <BarrasPresion
                    G_mem={activo.dim.G_mem}
                    G_lat={activo.dim.G_lat}
                    G_comp={activo.dim.G_comp}
                    cuello={activo.dim.cuello}
                    ancho="100%"
                  />
                </div>
              )}

              <p className="text-xs mt-3 leading-relaxed text-suave">
                {dim
                  ? `Cada sesión del lote recibe un token por ciclo, así que usuarios y agentes generan a la misma velocidad. El ${fmt(r.pctAgentes)} % de las sesiones activas son agentes y se llevan esa misma fracción de la producción.`
                  : `Con ${estado.G} unidades manda ${nombreCuello(cuelloActivo)}. Cada agente que agregues cuesta ${fmt(r.kappa)} usuarios, así que la curva de la gráfica es el intercambio real entre ambos.`}
              </p>
            </div>
          )}

          <p className="text-xs mt-4 leading-relaxed text-suave">
            {dim
              ? "Las barras muestran cuántas GPUs exige cada restricción por separado; la que domina define el total."
              : "Cada curva es una GPU: todos los puntos sobre ella saturan el sistema. No hay un óptimo único, es un intercambio — la pendiente es κ."}{" "}
            Si manda <span className="text-mem">memoria</span>, conviene más VRAM o recortar
            contexto; si manda <span className="text-lat">latencia</span>, conviene más ancho de
            banda; si manda <span className="text-comp">cómputo</span>, el lote saturó los Tensor
            Cores y solo ayuda un modelo más chico o más GPUs. Los precios por hora son editables
            y sirven como referencia, no como cotización.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * La tabla exportada es "tidy": cada fila lleva sus propios parámetros de
 * escenario, así que varios CSV se pueden concatenar sin perder el contexto.
 */
function filasCSV(e: Estado, r: ReturnType<typeof calcular>, dim: boolean): Celda[][] {
  const m = r.modelo;
  const escenario: Celda[] = [
    m.nombre, m.N, m.capas_atn, m.kv_heads, m.head_dim, m.quant_pesos, m.quant_cache,
    e.Uh, DUTY_HUMANO, e.Ch, e.Ua, DUTY_AGENTE, e.Ca, e.slo_ms, e.overhead_gb, e.eff,
  ];
  const colsEscenario = [
    "modelo", "N_B", "capas_atn", "kv_heads", "head_dim", "quant_pesos", "quant_cache",
    "Uh", "Dh", "Ch_tok", "Ua", "Da", "Ca_tok", "slo_ms", "overhead_GB", "eff",
  ];

  if (dim) {
    return [
      [
        "gpu", "incluida", "vram_GB", "bw_GBs_nominal", "bw_GBs_efectivo", "tflops_nominal", "usd_hora",
        "viable", "motivo", "G", "cuello", "G_memoria", "G_latencia", "G_computo",
        "B_por_gpu", "tpot_ms", "tok_s_sesion", "throughput_tok_s", "costo_hora", "cumple_slo",
        ...colsEscenario,
      ],
      ...r.filas.map((f): Celda[] => [
        f.gpu.nombre, f.gpu.on, f.gpu.vram_gb, f.gpu.bw_gbs, f.gpu.bw_gbs * e.eff, f.gpu.tflops, f.gpu.precio_hora,
        f.dim.viable, f.dim.motivo, f.dim.viable ? f.dim.G : null, f.dim.cuello,
        f.dim.viable ? f.dim.G_mem : null, f.dim.viable ? f.dim.G_lat : null, f.dim.viable ? f.dim.G_comp : null,
        f.dim.viable ? f.dim.B : null, f.dim.viable ? f.dim.tpot_ms : null,
        f.dim.viable ? f.dim.tok_s_sesion : null, f.dim.viable ? f.dim.throughput : null,
        f.dim.viable ? f.dim.costo_hora : null, f.dim.viable ? f.dim.cumple_slo : null,
        ...escenario,
      ]),
    ];
  }

  return [
    [
      "gpu", "incluida", "vram_GB", "bw_GBs_nominal", "bw_GBs_efectivo", "tflops_nominal", "usd_hora",
      "viable", "motivo", "G", "alcanza", "usuarios", "agentes_fijados", "solo_agentes",
      "solo_usuarios", "cuello", "B_por_gpu", "tpot_ms", "throughput_tok_s", "costo_hora",
      ...colsEscenario,
    ],
    ...r.filas.map((f): Celda[] => [
      f.gpu.nombre, f.gpu.on, f.gpu.vram_gb, f.gpu.bw_gbs, f.gpu.bw_gbs * e.eff, f.gpu.tflops, f.gpu.precio_hora,
      f.cap.viable, f.cap.motivo, f.cap.viable ? f.cap.G : null, f.cap.viable ? f.cap.alcanza : null,
      f.cap.alcanza ? f.cap.usuarios : null, f.cap.agentes,
      f.techos.viable ? f.soloAgentes : null, f.techos.viable ? f.soloUsuarios : null,
      f.cap.alcanza ? f.cap.cuello : "", f.cap.alcanza ? f.cap.B : null,
      f.cap.alcanza ? f.cap.tpot_ms : null, f.cap.alcanza ? f.cap.throughput : null,
      f.cap.viable ? f.cap.costo_hora : null,
      ...escenario,
    ]),
  ];
}

export default Calculadora;
