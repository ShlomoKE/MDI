/**
 * La tabla de resultados, una fila por GPU del catálogo.
 *
 * En escritorio es una tabla; por debajo de `md` se convierte en tarjetas
 * apiladas, porque nueve columnas en un teléfono no se leen. Los dos caminos
 * muestran exactamente los mismos datos.
 */

import BarrasPresion from "./BarrasPresion";
import EntradaNumerica from "./EntradaNumerica";
import type { GPUCatalogo } from "../lib/catalogos";
import type { Fila } from "../lib/resultados";
import type { Modo } from "../lib/urlEstado";
import { CLASE_CUELLO, fmt, fmtCorto, nombreCuello, usd } from "../lib/formato";
import type { Cuello } from "../lib/motor";

interface Props {
  filas: Fila[];
  modo: Modo;
  eff: number;
  slo_ms: number;
  G: number;
  mejorId: string | null;
  foco: string | null;
  setFoco: (id: string | null) => void;
  onCambiar: (id: string, cambios: Partial<GPUCatalogo>) => void;
  onEliminar: (id: string) => void;
}

const COLS_DIM = [
  "GPU",
  "VRAM",
  "GB/s nom → efect",
  "USD/h",
  "GPUs",
  "Presión mem / lat / cpu",
  "TPOT",
  "tok/s sesión",
  "Costo/h",
];

const COLS_CAP = [
  "GPU",
  "VRAM",
  "GB/s nom → efect",
  "USD/h",
  "Usuarios",
  "Solo agentes",
  "Cuello",
  "TPOT",
  "Costo/h",
];

/** El cuello vigente en el modo activo, o "" si la GPU no es viable. */
function cuelloDe(f: Fila, modo: Modo): Cuello | "" {
  if (!f.techos.viable) return "";
  return modo === "dimensionar" ? f.dim.cuello : f.cap.alcanza ? f.cap.cuello : "";
}

function tpotDe(f: Fila, modo: Modo): number {
  return modo === "dimensionar" ? f.dim.tpot_ms : f.cap.tpot_ms;
}

function PrecioInput({
  valor,
  onChange,
  id,
}: {
  valor: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <EntradaNumerica
      valor={valor}
      set={onChange}
      paso={0.1}
      min={0}
      etiqueta={`Precio por hora de ${id}`}
      className="campo mono w-20 px-1.5 py-0.5 text-right text-sm"
    />
  );
}

function BotonEliminar({ nombre, onClick }: { nombre: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Eliminar ${nombre} del catálogo`}
      aria-label={`Eliminar ${nombre} del catálogo`}
      /* 44x44 css px de área tocable: es un botón destructivo y en móvil vive
         al lado de la casilla de incluir. */
      className="text-suave hover:text-lat text-lg leading-none rounded transition-colors grid place-items-center w-11 h-11 -my-2"
    >
      ×
    </button>
  );
}

export function TablaGPUs(p: Props) {
  const { filas, modo, eff, slo_ms, G, mejorId, foco, setFoco } = p;
  const dim = modo === "dimensionar";
  const etiquetaMejor = dim ? "más barata" : "más capacidad";

  return (
    <>
      {/* ---------------- Escritorio ---------------- */}
      <div className="hidden md:block rounded border border-linea bg-superficie overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 820 }}>
          <caption className="sr-only">
            Resultado por GPU en modo {dim ? "dimensionar" : "capacidad"}
          </caption>
          <thead>
            <tr className="bg-fondo">
              {(dim ? COLS_DIM : COLS_CAP).map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className="font-medium px-3 py-2 rotulo text-suave whitespace-nowrap"
                  style={{ textAlign: i === 0 || (dim && i === 5) ? "left" : "right" }}
                >
                  {h}
                </th>
              ))}
              <th scope="col" className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const cuello = cuelloDe(f, modo);
              const clase = cuello ? CLASE_CUELLO[cuello] : null;
              const esMejor = f.gpu.id === mejorId;
              const cumple = f.techos.viable && tpotDe(f, modo) <= slo_ms;
              return (
                <tr
                  key={f.gpu.id}
                  className={
                    "border-t border-linea transition-colors " +
                    (foco === f.gpu.id ? "bg-fondo " : "") +
                    (f.gpu.on ? "" : "opacity-45")
                  }
                  onMouseEnter={() => setFoco(f.gpu.id)}
                  onMouseLeave={() => setFoco(null)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={f.gpu.on}
                        aria-label={`Incluir ${f.gpu.nombre} en la comparación`}
                        onChange={() => p.onCambiar(f.gpu.id, { on: !f.gpu.on })}
                      />
                      <span className={esMejor ? "font-semibold" : ""}>{f.gpu.nombre}</span>
                      {esMejor && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-mem-tenue text-mem whitespace-nowrap">
                          {etiquetaMejor}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right mono whitespace-nowrap">
                    {f.gpu.vram_gb} GB
                  </td>
                  <td className="px-3 py-2 text-right mono whitespace-nowrap">
                    {fmt(f.gpu.bw_gbs)}
                    <span className="text-suave"> → {fmt(f.gpu.bw_gbs * eff)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PrecioInput
                      id={f.gpu.nombre}
                      valor={f.gpu.precio_hora}
                      onChange={(v) => p.onCambiar(f.gpu.id, { precio_hora: v })}
                    />
                  </td>

                  {!f.techos.viable ? (
                    <td colSpan={5} className="px-3 py-2 text-xs text-lat">
                      {f.techos.motivo}
                    </td>
                  ) : dim ? (
                    <>
                      <td className="px-3 py-2 text-right mono">{f.dim.G}</td>
                      <td className="px-3 py-2">
                        <BarrasPresion
                          G_mem={f.dim.G_mem}
                          G_lat={f.dim.G_lat}
                          G_comp={f.dim.G_comp}
                          cuello={f.dim.cuello}
                        />
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right mono whitespace-nowrap " +
                          (cumple ? "" : "text-lat")
                        }
                      >
                        {fmt(f.dim.tpot_ms, 1)} ms
                      </td>
                      <td
                        className={"px-3 py-2 text-right mono " + (cumple ? "" : "text-lat")}
                      >
                        {fmt(f.dim.tok_s_sesion, 1)}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right mono " +
                          (clase ? clase.texto : "") +
                          (esMejor ? " font-semibold" : "")
                        }
                      >
                        {usd(f.dim.costo_hora)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        className={
                          "px-3 py-2 text-right mono " +
                          (f.cap.alcanza ? (esMejor ? "text-mem font-semibold" : "") : "text-lat")
                        }
                      >
                        {f.cap.alcanza ? fmt(f.cap.usuarios) : "no alcanza"}
                      </td>
                      <td className="px-3 py-2 text-right mono text-suave">
                        {fmt(f.soloAgentes)}
                      </td>
                      <td
                        className={"px-3 py-2 text-right text-xs " + (clase ? clase.texto : "")}
                      >
                        {f.cap.alcanza ? nombreCuello(cuello) : "—"}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right mono whitespace-nowrap " +
                          (cumple ? "" : "text-lat")
                        }
                      >
                        {f.cap.alcanza ? fmt(f.cap.tpot_ms, 1) + " ms" : "—"}
                      </td>
                      <td className="px-3 py-2 text-right mono">{usd(f.cap.costo_hora)}</td>
                    </>
                  )}
                  <td className="px-1 py-2 text-center">
                    <BotonEliminar
                      nombre={f.gpu.nombre}
                      onClick={() => p.onEliminar(f.gpu.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------------- Móvil: tarjetas apiladas ---------------- */}
      <div className="md:hidden flex flex-col gap-3">
        {filas.map((f) => {
          const cuello = cuelloDe(f, modo);
          const clase = cuello ? CLASE_CUELLO[cuello] : null;
          const esMejor = f.gpu.id === mejorId;
          const cumple = f.techos.viable && tpotDe(f, modo) <= slo_ms;
          return (
            <article
              key={f.gpu.id}
              className={
                "rounded border bg-superficie p-3 " +
                (esMejor ? "border-mem " : "border-linea ") +
                (f.gpu.on ? "" : "opacity-45")
              }
            >
              <header className="flex items-start justify-between gap-2 mb-2">
                <label className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={f.gpu.on}
                    aria-label={`Incluir ${f.gpu.nombre} en la comparación`}
                    onChange={() => p.onCambiar(f.gpu.id, { on: !f.gpu.on })}
                  />
                  <span className={"truncate " + (esMejor ? "font-semibold" : "")}>
                    {f.gpu.nombre}
                  </span>
                </label>
                <div className="flex items-center gap-1 shrink-0">
                  {esMejor && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-mem-tenue text-mem">
                      {etiquetaMejor}
                    </span>
                  )}
                  <BotonEliminar
                    nombre={f.gpu.nombre}
                    onClick={() => p.onEliminar(f.gpu.id)}
                  />
                </div>
              </header>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <Dato k="VRAM" v={`${f.gpu.vram_gb} GB`} />
                <Dato
                  k="GB/s nom → efect"
                  v={`${fmt(f.gpu.bw_gbs)} → ${fmt(f.gpu.bw_gbs * eff)}`}
                />
                <div className="col-span-2 flex items-center justify-between gap-2 py-0.5">
                  <dt className="text-xs text-suave">Precio USD/h</dt>
                  <dd>
                    <PrecioInput
                      id={f.gpu.nombre}
                      valor={f.gpu.precio_hora}
                      onChange={(v) => p.onCambiar(f.gpu.id, { precio_hora: v })}
                    />
                  </dd>
                </div>

                {/* Un <dl> solo admite grupos dt/dd, así que el motivo y las
                    barras de presión van fuera de la lista, más abajo. */}
                {f.techos.viable &&
                  (dim ? (
                    <>
                      <Dato k="GPUs" v={String(f.dim.G)} destacado />
                      <Dato
                        k="TPOT"
                        v={`${fmt(f.dim.tpot_ms, 1)} ms`}
                        clase={cumple ? "" : "text-lat"}
                      />
                      <Dato k="tok/s sesión" v={fmt(f.dim.tok_s_sesion, 1)} />
                      <Dato
                        k="Costo/h"
                        v={usd(f.dim.costo_hora)}
                        clase={clase ? clase.texto : ""}
                        destacado
                      />
                    </>
                  ) : (
                    <>
                      <Dato
                        k={`Usuarios con ${G} GPUs`}
                        v={f.cap.alcanza ? fmt(f.cap.usuarios) : "no alcanza"}
                        clase={f.cap.alcanza ? "text-mem" : "text-lat"}
                        destacado
                      />
                      <Dato k="Solo agentes" v={fmtCorto(f.soloAgentes)} />
                      <Dato
                        k="Cuello"
                        v={f.cap.alcanza ? nombreCuello(cuello) : "—"}
                        clase={clase ? clase.texto : ""}
                      />
                      <Dato
                        k="TPOT"
                        v={f.cap.alcanza ? `${fmt(f.cap.tpot_ms, 1)} ms` : "—"}
                        clase={cumple ? "" : "text-lat"}
                      />
                      <Dato k="Costo/h" v={usd(f.cap.costo_hora)} destacado />
                    </>
                  ))}
              </dl>

              {!f.techos.viable && (
                <p className="text-xs text-lat mt-2">{f.techos.motivo}</p>
              )}

              {f.techos.viable && dim && (
                <div className="mt-3 pt-2 border-t border-linea">
                  <div className="text-xs text-suave mb-1">
                    Presión por restricción · manda{" "}
                    <span className={clase ? clase.texto : ""}>
                      {nombreCuello(f.dim.cuello)}
                    </span>
                  </div>
                  <BarrasPresion
                    G_mem={f.dim.G_mem}
                    G_lat={f.dim.G_lat}
                    G_comp={f.dim.G_comp}
                    cuello={f.dim.cuello}
                    ancho="100%"
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function Dato({
  k,
  v,
  clase = "",
  destacado = false,
}: {
  k: string;
  v: string;
  clase?: string;
  destacado?: boolean;
}) {
  // Etiqueta arriba y valor debajo. En una rejilla de dos columnas a 360 px la
  // celda mide unos 145 px: puestos en fila, el valor con `whitespace-nowrap` se
  // llevaba todo el ancho y la etiqueta quedaba recortada a tres caracteres.
  return (
    <div className="min-w-0">
      <dt className="text-xs text-suave leading-tight">{k}</dt>
      <dd className={"mono leading-tight " + (destacado ? "font-medium " : "") + clase}>
        {v}
      </dd>
    </div>
  );
}

export default TablaGPUs;
