/**
 * Editor del catálogo: agregar, editar y eliminar GPUs y modelos.
 *
 * El prototipo solo dejaba tocar el precio. Aquí se puede cambiar cualquier
 * campo, meter hardware que no venía en la lista y borrar lo que sobra. Todo
 * vive en el estado de la página y viaja en la URL, así que un catálogo a la
 * medida se comparte con el mismo enlace.
 */

import { useState, type ReactNode } from "react";

import { Boton, Numero, Texto } from "./Campos";
import { GPUS, MODELOS, gpuNueva, modeloNuevo, type GPUCatalogo, type ModeloCatalogo } from "../lib/catalogos";
import { QUANTS, type Quant } from "../lib/motor";
import { enGB, enKB } from "../lib/formato";
import { KVt, Pm } from "../lib/motor";
import { useTextos } from "../i18n/contexto";

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
  const t = useTextos();
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
    const copia: ModeloCatalogo = { ...m, id: nuevoId("m"), nombre: m.nombre + t.catalogo.sufijoCopia };
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
        <span className="rotulo text-tinta">{t.catalogo.titulo}</span>
        <span className="text-xs text-suave">
          {t.catalogo.resumen(gpus.length, modelos.length)} {abierto ? "▲" : "▼"}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-linea p-3">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex rounded border border-linea overflow-hidden">
              {(
                [
                  ["gpus", t.catalogo.pestanaGPUs],
                  ["modelos", t.catalogo.pestanaModelos],
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
                    {t.catalogo.agregarGPU}
                  </Boton>
                  <Boton variante="sutil" onClick={() => onGpus(GPUS)} titulo={t.catalogo.tituloRestaurar}>
                    {t.catalogo.restaurar}
                  </Boton>
                </>
              ) : (
                <>
                  <Boton onClick={() => {
                    const m = modeloNuevo(nuevoId("m"));
                    onModelos([...modelos, m], m.id);
                  }}>
                    {t.catalogo.agregarModelo}
                  </Boton>
                  <Boton
                    variante="sutil"
                    onClick={() => onModelos(MODELOS, MODELOS[0].id)}
                    titulo={t.catalogo.tituloRestaurar}
                  >
                    {t.catalogo.restaurar}
                  </Boton>
                </>
              )}
            </div>
          </div>

          {/* Escritorio: rejilla en tabla. En móvil un scroller horizontal
              anidado deja los controles fuera de pantalla, así que abajo hay un
              camino de tarjetas con los mismos campos. */}
          <div className="hidden md:block overflow-x-auto -mx-3 px-3">
            {pestana === "gpus" ? (
              <table className="w-full text-sm" style={{ minWidth: 620 }}>
                <thead>
                  <tr className="text-suave">
                    {[
                      t.catalogo.colNombre,
                      t.catalogo.colVRAM,
                      t.catalogo.colAncho,
                      t.catalogo.colTFLOPS,
                      t.catalogo.colPrecio,
                      "",
                    ].map((h, i) => (
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
                        <Texto valor={g.nombre} set={(v) => editarGpu(g.id, { nombre: v })} etiqueta={t.catalogo.nombreGPU} />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.vram_gb} set={(v) => editarGpu(g.id, { vram_gb: v })} etiqueta={t.catalogo.vramDe(g.nombre)} paso={8} />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.bw_gbs} set={(v) => editarGpu(g.id, { bw_gbs: v })} etiqueta={t.catalogo.anchoDe(g.nombre)} paso={100} />
                      </td>
                      <td className="py-1.5 px-1 w-24">
                        <Numero valor={g.tflops} set={(v) => editarGpu(g.id, { tflops: v })} etiqueta={t.catalogo.tflopsDe(g.nombre)} paso={50} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={g.precio_hora} set={(v) => editarGpu(g.id, { precio_hora: v })} etiqueta={t.catalogo.precioDe(g.nombre)} paso={0.1} />
                      </td>
                      <td className="py-1.5 px-1 w-8 text-center">
                        <button
                          type="button"
                          onClick={() => onGpus(gpus.filter((x) => x.id !== g.id))}
                          aria-label={t.catalogo.eliminar(g.nombre)}
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
                    {[
                      t.catalogo.colNombre,
                      t.catalogo.colN,
                      t.catalogo.colCapas,
                      t.catalogo.colCabezas,
                      t.catalogo.colDim,
                      t.catalogo.colPesos,
                      t.catalogo.colCache,
                      t.catalogo.colDerivados,
                      "",
                    ].map((h, i) => (
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
                        <Texto valor={m.nombre} set={(v) => editarModelo(m.id, { nombre: v })} etiqueta={t.catalogo.nombreModelo} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={m.N} set={(v) => editarModelo(m.id, { N: v })} etiqueta={t.catalogo.paramsDe(m.nombre)} />
                      </td>
                      <td className="py-1.5 px-1 w-16">
                        <Numero valor={m.capas_atn} set={(v) => editarModelo(m.id, { capas_atn: v })} etiqueta={t.catalogo.capasDe(m.nombre)} />
                      </td>
                      <td className="py-1.5 px-1 w-16">
                        <Numero valor={m.kv_heads} set={(v) => editarModelo(m.id, { kv_heads: v })} etiqueta={t.catalogo.cabezasDe(m.nombre)} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <Numero valor={m.head_dim} set={(v) => editarModelo(m.id, { head_dim: v })} etiqueta={t.catalogo.dimDe(m.nombre)} paso={32} />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <SelectQuant
                          valor={m.quant_pesos}
                          set={(v) => editarModelo(m.id, { quant_pesos: v })}
                          etiqueta={t.catalogo.quantPesosDe(m.nombre)}
                        />
                      </td>
                      <td className="py-1.5 px-1 w-20">
                        <SelectQuant
                          valor={m.quant_cache}
                          set={(v) => editarModelo(m.id, { quant_cache: v })}
                          etiqueta={t.catalogo.quantCacheDe(m.nombre)}
                        />
                      </td>
                      <td className="py-1.5 px-1 text-xs text-suave mono whitespace-nowrap">
                        {enGB(Pm(m))} GB · {enKB(KVt(m))} KB/tok
                      </td>
                      <td className="py-1.5 px-1 w-16 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => duplicarModelo(m)}
                          aria-label={t.catalogo.duplicar(m.nombre)}
                          title={t.catalogo.tituloDuplicar}
                          className="text-suave hover:text-tinta px-1 rounded transition-colors"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarModelo(m.id)}
                          aria-label={t.catalogo.eliminar(m.nombre)}
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

          {/* Móvil: una tarjeta por entrada, con los mismos campos apilados. */}
          <div className="md:hidden flex flex-col gap-3">
            {pestana === "gpus"
              ? gpus.map((g) => (
                  <article key={g.id} className="rounded border border-linea p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Texto
                        valor={g.nombre}
                        set={(v) => editarGpu(g.id, { nombre: v })}
                        etiqueta={t.catalogo.nombreGPU}
                      />
                      <BotonIcono
                        etiqueta={t.catalogo.eliminar(g.nombre)}
                        onClick={() => onGpus(gpus.filter((x) => x.id !== g.id))}
                        peligro
                      >
                        ×
                      </BotonIcono>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <CampoTarjeta etiqueta={t.catalogo.campoVRAM}>
                        <Numero valor={g.vram_gb} set={(v) => editarGpu(g.id, { vram_gb: v })} etiqueta={t.catalogo.vramDe(g.nombre)} paso={8} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoAncho}>
                        <Numero valor={g.bw_gbs} set={(v) => editarGpu(g.id, { bw_gbs: v })} etiqueta={t.catalogo.anchoDe(g.nombre)} paso={100} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoTFLOPS}>
                        <Numero valor={g.tflops} set={(v) => editarGpu(g.id, { tflops: v })} etiqueta={t.catalogo.tflopsDe(g.nombre)} paso={50} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoPrecio}>
                        <Numero valor={g.precio_hora} set={(v) => editarGpu(g.id, { precio_hora: v })} etiqueta={t.catalogo.precioDe(g.nombre)} paso={0.1} />
                      </CampoTarjeta>
                    </div>
                  </article>
                ))
              : modelos.map((m) => (
                  <article key={m.id} className="rounded border border-linea p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Texto
                        valor={m.nombre}
                        set={(v) => editarModelo(m.id, { nombre: v })}
                        etiqueta={t.catalogo.nombreModelo}
                      />
                      <BotonIcono etiqueta={t.catalogo.duplicar(m.nombre)} onClick={() => duplicarModelo(m)}>
                        ⧉
                      </BotonIcono>
                      <BotonIcono
                        etiqueta={t.catalogo.eliminar(m.nombre)}
                        onClick={() => eliminarModelo(m.id)}
                        desactivado={modelos.length <= 1}
                        peligro
                      >
                        ×
                      </BotonIcono>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <CampoTarjeta etiqueta={t.catalogo.campoN}>
                        <Numero valor={m.N} set={(v) => editarModelo(m.id, { N: v })} etiqueta={t.catalogo.paramsDe(m.nombre)} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoCapas}>
                        <Numero valor={m.capas_atn} set={(v) => editarModelo(m.id, { capas_atn: v })} etiqueta={t.catalogo.capasDe(m.nombre)} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoCabezas}>
                        <Numero valor={m.kv_heads} set={(v) => editarModelo(m.id, { kv_heads: v })} etiqueta={t.catalogo.cabezasDe(m.nombre)} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.campoDim}>
                        <Numero valor={m.head_dim} set={(v) => editarModelo(m.id, { head_dim: v })} etiqueta={t.catalogo.dimDe(m.nombre)} paso={32} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.colPesos}>
                        <SelectQuant valor={m.quant_pesos} set={(v) => editarModelo(m.id, { quant_pesos: v })} etiqueta={t.catalogo.quantPesosDe(m.nombre)} />
                      </CampoTarjeta>
                      <CampoTarjeta etiqueta={t.catalogo.colCache}>
                        <SelectQuant valor={m.quant_cache} set={(v) => editarModelo(m.id, { quant_cache: v })} etiqueta={t.catalogo.quantCacheDe(m.nombre)} />
                      </CampoTarjeta>
                    </div>
                    <p className="text-xs text-suave mono mt-2">
                      {enGB(Pm(m))} GB · {enKB(KVt(m))} KB/tok
                    </p>
                  </article>
                ))}
          </div>

          <p className="text-xs text-suave mt-3 leading-relaxed">
            {pestana === "gpus" ? t.catalogo.notaGPUs : t.catalogo.notaModelos}
          </p>
        </div>
      )}
    </div>
  );
}

function CampoTarjeta({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="text-xs text-suave block mb-0.5 leading-tight">{etiqueta}</span>
      {children}
    </label>
  );
}

/** Botón de icono con 44x44 de área tocable. */
function BotonIcono({
  children,
  etiqueta,
  onClick,
  peligro = false,
  desactivado = false,
}: {
  children: ReactNode;
  etiqueta: string;
  onClick: () => void;
  peligro?: boolean;
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={desactivado}
      className={
        "shrink-0 grid place-items-center w-11 h-11 -my-1.5 rounded text-lg leading-none transition-colors disabled:opacity-30 text-suave " +
        (peligro ? "hover:text-lat" : "hover:text-tinta")
      }
    >
      {children}
    </button>
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
