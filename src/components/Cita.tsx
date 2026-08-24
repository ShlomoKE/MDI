/**
 * Cómo citar el trabajo.
 *
 * La URL no se puede escribir a mano —depende de dónde acabe publicado el
 * sitio—, así que se lee de `window.location` en el momento de renderizar. Así
 * la cita siempre apunta a donde el lector la está leyendo, sea el dominio
 * definitivo, un despliegue de vista previa o localhost.
 */

import { useEffect, useState } from "react";

import { useTextos } from "../i18n/contexto";

export const AUTOR = "Shlomo Kalach";
export const AUTOR_CORTO = "S. Kalach";
export const AUTOR_APELLIDO_PRIMERO = "Kalach, S.";
export const ANIO = 2026;

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
  const t = useTextos();
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
          {copiado ? t.cita.copiado : t.cita.copiar}
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

/** Mientras no haya navegador, la cita apunta al repositorio. */
const ENLACE_POR_DEFECTO = "https://github.com/ShlomoKE/MDI";
const FECHA_PUBLICACION = "2026-08-21";

export function Cita() {
  const t = useTextos();

  // El primer render tiene que ser idéntico en el build y en el navegador: la
  // página se prerenderiza, así que leer `window` o la fecha de hoy aquí haría
  // que React encontrara un árbol distinto al hidratar. Ambos se rellenan
  // después, en el efecto.
  const [vivo, setVivo] = useState<{ url: string; consultado: string } | null>(null);
  useEffect(() => {
    setVivo({
      url: window.location.origin + window.location.pathname,
      consultado: iso(new Date()),
    });
  }, []);

  const enlace = vivo?.url ?? ENLACE_POR_DEFECTO;
  const consultado = vivo?.consultado ?? FECHA_PUBLICACION;

  // El autor y el año son nombres propios y no cambian; el título sí, porque
  // se cita la versión de la página que el lector tiene delante.
  const titulo = t.meta.tituloCita;

  const texto = `${AUTOR_APELLIDO_PRIMERO} (${ANIO}). ${titulo}. ${enlace} ${t.cita.consultado(consultado)}`;

  const bibtex = `@misc{kalach${ANIO}mdi,
  author       = {Kalach, Shlomo},
  title        = {{${titulo}}},
  year         = {${ANIO}},
  howpublished = {\\url{${enlace}}},
  urldate      = {${consultado}}
}`;

  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <Bloque etiqueta={t.cita.referencia} texto={texto} />
      <Bloque etiqueta={t.cita.bibtex} texto={bibtex} mono />
    </div>
  );
}

export default Cita;
