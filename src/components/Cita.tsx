/**
 * Cómo citar el trabajo.
 *
 * La URL no se puede escribir a mano —depende de dónde acabe publicado el
 * sitio—, así que se lee de `window.location` en el momento de renderizar. Así
 * la cita siempre apunta a donde el lector la está leyendo, sea el dominio
 * definitivo, un despliegue de vista previa o localhost.
 */

import { useEffect, useState } from "react";

export const AUTOR = "Shlomo Kalach";
export const AUTOR_CORTO = "S. Kalach";
export const AUTOR_APELLIDO_PRIMERO = "Kalach, S.";
export const ANIO = 2026;
export const TITULO =
  "MDI — Modelo de Dimensionamiento de Infraestructura de Inferencia para cargas mixtas de usuarios y agentes";

/** Fecha en el formato que piden BibTeX y las normas de cita. */
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Bloque({
  etiqueta,
  texto,
  mono = false,
}: {
  etiqueta: string;
  texto: string;
  mono?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles queda el texto a la vista para seleccionarlo.
      setCopiado(false);
    }
  };

  return (
    <div className="rounded border border-linea bg-fondo">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-linea">
        <span className="rotulo text-suave">{etiqueta}</span>
        <button
          type="button"
          onClick={copiar}
          className="text-xs px-2 py-1 rounded border border-linea bg-superficie text-tinta hover:bg-fondo transition-colors"
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <pre
        className={
          "px-3 py-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words " +
          (mono ? "mono" : "")
        }
      >
        {texto}
      </pre>
    </div>
  );
}

export function Cita() {
  // En el primer render no hay URL fiable; se rellena al montar.
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(window.location.origin + window.location.pathname);
  }, []);

  const enlace = url || "https://mdi.pages.dev/";
  const consultado = iso(new Date());

  const texto = `${AUTOR_APELLIDO_PRIMERO} (${ANIO}). ${TITULO}. ${enlace} (consultado el ${consultado})`;

  const bibtex = `@misc{kalach${ANIO}mdi,
  author       = {Kalach, Shlomo},
  title        = {{MDI: Modelo de Dimensionamiento de Infraestructura de
                  Inferencia para cargas mixtas de usuarios y agentes}},
  year         = {${ANIO}},
  howpublished = {\\url{${enlace}}},
  urldate      = {${consultado}}
}`;

  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <Bloque etiqueta="Referencia" texto={texto} />
      <Bloque etiqueta="BibTeX" texto={bibtex} mono />
    </div>
  );
}

export default Cita;
