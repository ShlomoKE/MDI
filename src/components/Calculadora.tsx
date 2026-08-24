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
import { CLASE_CUELLO, colorCuello, enGB, enKB, fmt, fmtCorto, usd } from "../lib/formato";
import { calcular } from "../lib/resultados";
import { ESTADO_INICIAL, enlace, leer, serializar, type Estado, type Modo } from "../lib/urlEstado";
import { useTextos } from "../i18n/contexto";
import { nombreCuello } from "../i18n/cuello";

/** Las tres restricciones en LaTeX, para mostrar la que está mandando. */
const ECUACIONES = {
  memoria: String.raw`G \;\ge\; \frac{\mathrm{KV}_{\text{total}}}{V_t - P_m - O}`,
  latencia: String.raw`G \;\ge\; \frac{\mathrm{KV}_{\text{total}}}{\mathrm{SLO}\cdot W - P_m}`,
  computo: String.raw`G \;\ge\; \frac{A}{\dfrac{\mathrm{SLO}\cdot F}{2N}}`,
} as const;

export function Calculadora() {
  const t = useTextos();
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
    const temporizador = setTimeout(() => {
      const q = serializar(estado);
      const url = window.location.pathname + (q ? "?" + q : "") + window.location.hash;
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(temporizador);
  }, [estado]);

  const r = useMemo(() => calcular(estado), [estado]);
  const dim = estado.modo === "dimensionar";
  const modelo = r.modelo;

  // Los rótulos de los dos modos salen del diccionario, así que el arreglo se
  // arma aquí dentro y no como constante de módulo.
  const modos: Array<[Modo, string]> = [
    ["dimensionar", t.calculadora.modoDim],
    ["capacidad", t.calculadora.modoCap],
  ];

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
              {t.calculadora.titulo}
            </h2>
            <p className="text-sm mt-1 text-suave max-w-prose">
              {dim ? t.calculadora.entradillaDim : t.calculadora.entradillaCap}
            </p>
          </div>
          <div
            className="flex rounded border border-linea overflow-hidden shrink-0"
            role="group"
            aria-label={t.calculadora.modoAria}
          >
            {modos.map(([k, l]) => (
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
            <Seccion titulo={t.calculadora.secHardware}>
              <Campo label={t.calculadora.gpusPorConfig} valor={estado.G} set={(v) => set({ G: Math.max(1, Math.round(v)) })} paso={1} min={1} />
              <p className="text-xs mt-2 leading-relaxed text-suave">
                {t.calculadora.notaGpusPorConfig(String(estado.G))}
              </p>
            </Seccion>
          )}

          <Seccion titulo={t.calculadora.secUsuarios}>
            {dim ? (
              <Campo label={t.calculadora.usuarios} valor={estado.Uh} set={(v) => set({ Uh: v })} paso={100} />
            ) : (
              <Fijo label={t.calculadora.usuarios} valor={t.calculadora.calculado} />
            )}
            <Fijo label={t.calculadora.dutyCycle} valor={DUTY_HUMANO} nota={t.calculadora.peorCaso} />
            <Campo label={t.calculadora.contexto} valor={estado.Ch} set={(v) => set({ Ch: v })} paso={500} sufijo={t.calculadora.tok} />
          </Seccion>

          <Seccion titulo={t.calculadora.secAgentes}>
            <Campo label={t.calculadora.agentes} valor={estado.Ua} set={(v) => set({ Ua: v })} paso={5} />
            <Fijo label={t.calculadora.dutyCycle} valor={DUTY_AGENTE} nota={t.calculadora.peorCaso} />
            <Campo label={t.calculadora.contexto} valor={estado.Ca} set={(v) => set({ Ca: v })} paso={5000} sufijo={t.calculadora.tok} />
            <p className="text-xs mt-2 leading-relaxed text-suave">
              {dim ? t.calculadora.notaAgentesDim : t.calculadora.notaAgentesCap}
            </p>
          </Seccion>

          <Seccion titulo={t.calculadora.secObjetivo}>
            <Campo label={t.calculadora.sloPorToken} valor={estado.slo_ms} set={(v) => set({ slo_ms: Math.max(0.1, v) })} paso={5} min={0.1} sufijo="ms" />
            <p className="text-xs mt-2 text-suave">
              {t.calculadora.notaSlo(fmt(1000 / estado.slo_ms))}
            </p>
          </Seccion>

          <Seccion titulo={t.calculadora.secModelo}>
            <select
              value={estado.modeloId}
              aria-label={t.calculadora.modeloAria}
              onChange={(e) => set({ modeloId: e.target.value })}
              className="campo w-full text-sm px-2 py-1.5 mb-2"
            >
              {estado.modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <Campo label={t.calculadora.nParametros} valor={modelo.N} set={(v) => editarModeloActivo({ N: v })} sufijo="B" />
            <Campo label={t.calculadora.capasAtn} valor={modelo.capas_atn} set={(v) => editarModeloActivo({ capas_atn: v })} ayuda={t.calculadora.ayudaCapasAtn} />
            <Campo label={t.calculadora.cabezasKV} valor={modelo.kv_heads} set={(v) => editarModeloActivo({ kv_heads: v })} />
            <Campo label={t.calculadora.dimension} valor={modelo.head_dim} set={(v) => editarModeloActivo({ head_dim: v })} paso={32} />
            <div className="flex gap-2 mt-3">
              {(
                [
                  [t.calculadora.pesos, "quant_pesos"],
                  [t.calculadora.cache, "quant_cache"],
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
              <Campo label={t.calculadora.overheadMotor} valor={estado.overhead_gb} set={(v) => set({ overhead_gb: v })} sufijo="GB" />
            </div>
            <Campo
              label={t.calculadora.eficiencia}
              valor={estado.eff}
              set={(v) => set({ eff: Math.min(1, Math.max(0.05, v)) })}
              paso={0.05}
              min={0.05}
              max={1}
            />
            <p className="text-xs mt-2 leading-relaxed text-suave">
              {t.calculadora.notaEficiencia}
            </p>
          </Seccion>

          <div className="flex flex-wrap gap-2">
            <Boton onClick={exportar} titulo={t.calculadora.tituloExportar}>
              {t.calculadora.exportarCSV}
            </Boton>
            <Boton onClick={copiarEnlace} titulo={t.calculadora.tituloCopiar}>
              {copiado ? t.calculadora.copiado : t.calculadora.copiarEnlace}
            </Boton>
          </div>
        </div>

        {/* ------------------------------ Resultados ------------------------------ */}
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Kpi k={t.calculadora.kpiPesos} v={`${enGB(r.Pm)} GB`} />
            <Kpi k={t.calculadora.kpiKV} v={`${enKB(r.KVt)} KB`} />
            {dim ? (
              <Kpi k={t.calculadora.kpiActivas} v={fmt(r.activas)} />
            ) : (
              <Kpi k={t.calculadora.kpiContextoProm} v={`${fmt(r.contextoPromedio)} ${t.calculadora.tok}`} />
            )}
            <Kpi k={t.calculadora.kpiKappa} v={`${fmt(r.kappa)}×`} col="text-lat" />
          </div>

          <div className="rounded border border-linea bg-superficie mb-6 p-3">
            <div className="flex items-baseline justify-between mb-1 px-1 sm:px-2 flex-wrap gap-2">
              <h3 className="rotulo text-tinta">
                {dim ? t.calculadora.graficaDim : t.calculadora.graficaCap(String(estado.G))}
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
                {(["memoria", "latencia", "computo"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <i
                      aria-hidden
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: colorCuello(k) }}
                    />
                    {t.calculadora.limita} {nombreCuello(t, k)}
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
            modeloNombre={r.modelo.nombre}
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
                  {t.calculadora.comparar}
                </span>
              </div>

              {dim ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi
                    k={t.calculadora.kpiPorSesion}
                    v={`${fmt(activo.dim.tok_s_sesion, 1)} tok/s`}
                    col={activo.dim.cumple_slo ? "text-mem" : "text-lat"}
                  />
                  <Kpi k={t.calculadora.kpiLote} v={`${fmt(activo.dim.B, 1)} ${t.calculadora.sesiones}`} />
                  <Kpi k={t.calculadora.kpiConsumoUsuarios} v={`${fmtCorto(r.activasHumanos * activo.dim.tok_s_sesion)} tok/s`} />
                  <Kpi k={t.calculadora.kpiConsumoAgentes} v={`${fmtCorto(r.activasAgentes * activo.dim.tok_s_sesion)} tok/s`} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi k={t.calculadora.kpiAgentesFijados} v={fmt(estado.Ua)} col="text-lat" />
                  <Kpi
                    k={t.calculadora.kpiUsuariosCaben}
                    v={activo.cap.alcanza ? fmt(activo.cap.usuarios) : t.calculadora.noAlcanza}
                    col={activo.cap.alcanza ? "text-mem" : "text-lat"}
                  />
                  <Kpi
                    k={t.calculadora.kpiPorSesion}
                    v={activo.cap.alcanza ? `${fmt(1000 / activo.cap.tpot_ms, 1)} tok/s` : "—"}
                    col={activo.cap.alcanza && activo.cap.tpot_ms <= estado.slo_ms ? "text-mem" : "text-lat"}
                  />
                  <Kpi
                    k={t.calculadora.kpiCostoAgente}
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
                      {t.calculadora.manda} {nombreCuello(t, cuelloActivo)}
                    </div>
                    <p className="text-xs mt-1 text-tinta/80 leading-relaxed">
                      {cuelloActivo === "memoria"
                        ? t.calculadora.porqueMemoria
                        : cuelloActivo === "latencia"
                          ? t.calculadora.porqueLatencia
                          : t.calculadora.porqueComputo}
                    </p>
                  </div>
                  <div className="sm:ml-auto shrink-0">
                    <Ecuacion tex={ECUACIONES[cuelloActivo]} bloque />
                  </div>
                </div>
              )}

              {dim && (
                <div className="mt-4 sm:hidden">
                  <div className="text-xs text-suave mb-1">{t.calculadora.presionPorRestriccion}</div>
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
                  ? t.calculadora.cierreDim(fmt(r.pctAgentes))
                  : t.calculadora.cierreCap(
                      String(estado.G),
                      nombreCuello(t, cuelloActivo),
                      fmt(r.kappa),
                    )}
              </p>
            </div>
          )}

          <p className="text-xs mt-4 leading-relaxed text-suave">
            {dim ? t.calculadora.cierreBarras : t.calculadora.cierreCurvas}{" "}
            {/* Un consejo por restricción, con su color. Se generan en bucle en
                vez de escribir la frase entera porque el orden de la palabra y
                el resto de la oración cambia con el idioma. */}
            {(["memoria", "latencia", "computo"] as const).map((k) => (
              <span key={k}>
                {t.calculadora.consejoSi}{" "}
                <span className={CLASE_CUELLO[k].texto}>{nombreCuello(t, k)}</span>
                {t.calculadora.consejo[k]}{" "}
              </span>
            ))}
            {t.calculadora.consejoPrecios}
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
