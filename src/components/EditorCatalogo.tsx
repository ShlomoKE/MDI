/**
 * Editor del catálogo: agregar, editar y eliminar GPUs y modelos.
 *
 * El prototipo solo dejaba tocar el precio. Aquí se puede cambiar cualquier
 * campo, meter hardware que no venía en la lista y borrar lo que sobra. Todo
 * vive en el estado de la página y viaja en la URL, así que un catálogo a la
 * medida se comparte con el mismo enlace.
 */

import { useState } from "react";

import { Boton, Numero, Texto } from "./Campos";
import { GPUS, MODELOS, gpuNueva, modeloNuevo, type GPUCatalogo, type ModeloCatalogo } from "../lib/catalogos";
import { QUANTS, type Quant } from "../lib/motor";
import { enGB, enKB } from "../lib/formato";
import { KVt, Pm } from "../lib/motor";

interface Props {
  gpus: GPUCatalogo[];
  modelos: ModeloCatalogo[];
  modeloId: string;
  onGpus: (g: GPUCatalogo[]) => void;
  onModelos: (m: ModeloCatalogo[], modeloId?: string) => void;
}

/** Ids únicos y estables sin depender de la longitud del arreglo. */
let contador = 0;
const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${contador++}`;

export function EditorCatalogo({ gpus, modelos, modeloId, onGpus, onModelos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<"gpus" | "modelos">("gpus");

  const editarGpu = (id: string, cambios: Partial<GPUCatalogo>) =>
    onGpus(gpus.map((g) => (g.id === id ? { ...g, ...cambios } : g)));

  const editarModelo = (id: string, cambios: Partial<ModeloCatalogo>) =>
    onModelos(modelos.map((m) => (m.id === id ? { ...m, ...cambios } : m)));

  const eliminarModelo = (id: string) => {
    if (modelos.length <= 1) return;
    const resto = modelos.filter((m) => m.id !== id);
    onModelos(resto, id === modeloId ? resto[0].id : modeloId);
  };

  const duplicarModelo = (m: ModeloCatalogo) => {
    const copia: ModeloCatalogo = { ...m, id: nuevoId("m"), nombre: m.nombre + " (copia)" };
    const i = modelos.findIndex((x) => x.id === m.id);
    const resto = [...modelos.slice(0, i + 1), copia, ...modelos.slice(i + 1)];
    onModelos(resto, copia.id);
  };

  return (
    <div className="rounded border border-linea bg-superficie">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-fondo transition-colors rounded"
      >
        <span className="rotulo text-tinta">Catálogo</span>
        <span className="text-xs text-suave">
          {gpus.length} GPUs · {modelos.length} modelos {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-linea p-3">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex rounded border border-linea overflow-hidden">
              {(
                [
                  ["gpus", "GPUs"],
                  ["modelos", "Modelos"],
                ] as Array<[typeof pestana, string]>
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPestana(k)}
                  className={
                    "px-3 py-1.5 text-sm transition-colors " +
                    (pestana === k ? "bg-tinta text-superficie" : "bg-superficie text-suave hover:bg-fondo")
                  }
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {pestana === "gpus" ? (
                <>
                  <Boton onClick={() => onGpus([...gpus, gpuNueva(nuevoId("g"))])}>
                    + Agregar GPU
                  </Boton>
                  <Boton variante="sutil" onClick={() => onGpus(GPUS)} titulo="Volver al catálogo de fábrica">
                    Restaurar
                  </Boton>
                </>
              ) : (
                <>
                  <Boton onClick={() => {
                    const m = modeloNuevo(nuevoId("m"));
                    onModelos([...modelos, m], m.id);
                  }}>
                    + Agregar modelo
                  </Boton>
                  <Boton
                    variante="sutil"
                    onClick={() => onModelos(MODELOS, MODELOS[0].id)}
                    titulo="Volver al catálogo de fábrica"
                  >
                    Restaurar
                  </Boton>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto -mx-3 px-3">
            {pestana === "gpus" ? (
              <table className="w-full text-sm" style={{ minWidth: 620 }}>
                <thead>
                  <tr className="text-suave">
                    {["Nombre", "VRAM GB", "BW GB/s", "TFLOPS", "USD/h", ""].map((h, i) => (
                      <th
                        key={h || i}
                        scope="col"
                        className="rotulo font-medium pb-1.5 px-1"
                        style={{ textAlign: i === 0 ? "left" : "right" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gpus.map((g) => (
                    <tr key={g.id} className="border-t border-linea">
                      <td className="py-1.5 px-1 min-w-40">
                        <Texto valor={g.nombre} set={(v) => editarGpu(g.id, { nombre: v })} etiqueta="Nombre de la GPU" />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.vram_gb} set={(v) => editarGpu(g.id, { vram_gb: v })} etiqueta={`VRAM de ${g.nombre}`} paso={8} />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.bw_gbs} set={(v) => editarGpu(g.id, { bw_gbs: v })} etiqueta={`Ancho de banda de ${g.nombre}`} paso={100} />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.tflops} set={(v) => editarGpu(g.id, { tflops: v })} etiqueta={`TFLOPS de ${g.nombre}`} paso={50} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={g.precio_hora} set={(v) => editarGpu(g.id, { precio_hora: v })} etiqueta={`Precio de ${g.nombre}`} paso={0.1} />
                      </td>
                      <td className="py-1.5 px-1 w-8 text-center">
                        <button
                          type="button"
                          onClick={() => onGpus(gpus.filter((x) => x.id !== g.id))}
                          aria-label={`Eliminar ${g.nombre}`}
                          className="text-suave hover:text-lat px-1 rounded transition-colors"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="text-suave">
                    {["Nombre", "N (B)", "Lₐ", "H", "dₖ", "Pesos", "Caché", "Derivados", ""].map((h, i) => (
                      <th
                        key={h || i}
                        scope="col"
                        className="rotulo font-medium pb-1.5 px-1"
                        style={{ textAlign: i === 0 || i === 7 ? "left" : "right" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelos.map((m) => (
                    <tr key={m.id} className="border-t border-linea">
                      <td className="py-1.5 px-1 min-w-40">
                        <Texto valor={m.nombre} set={(v) => editarModelo(m.id, { nombre: v })} etiqueta="Nombre del modelo" />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={m.N} set={(v) => editarModelo(m.id, { N: v })} etiqueta={`Parámetros de ${m.nombre}`} />
                      </td>
                      <td className="py-1.5 px-1 w-16">
                        <Numero valor={m.capas_atn} set={(v) => editarModelo(m.id, { capas_atn: v })} etiqueta={`Capas de atención de ${m.nombre}`} />
                      </td>
                      <td className="py-1.5 px-1 w-16">
                        <Numero valor={m.kv_heads} set={(v) => editarModelo(m.id, { kv_heads: v })} etiqueta={`Cabezas KV de ${m.nombre}`} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={m.head_dim} set={(v) => editarModelo(m.id, { head_dim: v })} etiqueta={`Dimensión por cabeza de ${m.nombre}`} paso={32} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <SelectQuant
                          valor={m.quant_pesos}
                          set={(v) => editarModelo(m.id, { quant_pesos: v })}
                          etiqueta={`Cuantización de pesos de ${m.nombre}`}
                        />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <SelectQuant
                          valor={m.quant_cache}
                          set={(v) => editarModelo(m.id, { quant_cache: v })}
                          etiqueta={`Cuantización de caché de ${m.nombre}`}
                        />
                      </td>
                      <td className="py-1.5 px-1 text-xs text-suave mono whitespace-nowrap">
                        {enGB(Pm(m))} GB · {enKB(KVt(m))} KB/tok
                      </td>
                      <td className="py-1.5 px-1 w-16 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => duplicarModelo(m)}
                          aria-label={`Duplicar ${m.nombre}`}
                          title="Duplicar"
                          className="text-suave hover:text-tinta px-1 rounded transition-colors"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarModelo(m.id)}
                          aria-label={`Eliminar ${m.nombre}`}
                          disabled={modelos.length <= 1}
                          className="text-suave hover:text-lat px-1 rounded transition-colors disabled:opacity-30"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-xs text-suave mt-3 leading-relaxed">
            {pestana === "gpus"
              ? "Los precios son referenciales: CAPEX amortizado más OPEX, no una cotización. El factor de eficiencia se aplica por igual a todo el catálogo desde el panel de parámetros."
              : "Lₐ son las capas que generan KV cache, no las totales. En arquitecturas híbridas solo cuenta una fracción de las capas, y ahí está casi toda la diferencia de caché entre modelos del mismo tamaño."}
          </p>
        </div>
      )}
    </div>
  );
}

function SelectQuant({
  valor,
  set,
  etiqueta,
}: {
  valor: Quant;
  set: (v: Quant) => void;
  etiqueta: string;
}) {
  return (
    <select
      value={valor}
      aria-label={etiqueta}
      onChange={(e) => set(e.target.value as Quant)}
      className="campo w-full px-1.5 py-1 text-sm"
    >
      {QUANTS.map((q) => (
        <option key={q} value={q}>
          {q}
        </option>
      ))}
    </select>
  );
}

export default EditorCatalogo;
