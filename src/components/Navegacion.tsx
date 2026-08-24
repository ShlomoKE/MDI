/**
 * Navegación de secciones con resaltado de la sección activa.
 *
 * Los títulos no se declaran a mano: se leen del DOM al montar, así que agregar
 * un `##` en el MDX basta para que aparezca aquí. En escritorio queda pegada al
 * costado; en móvil se convierte en un desplegable en la barra superior.
 */

import { useEffect, useState } from "react";

import { useTextos } from "../i18n/contexto";

interface Seccion {
  id: string;
  titulo: string;
}

/** A qué altura de la ventana se considera que una sección "es la actual". */
const LINEA_LECTURA = 120;

export function Navegacion({ selector = "#documento h2[id]" }: { selector?: string }) {
  const t = useTextos();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [activa, setActiva] = useState<string>("");
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const nodos = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const lista: Seccion[] = nodos.map((n) => ({
      id: n.id,
      titulo: n.textContent?.trim() ?? n.id,
    }));
    setSecciones(lista);
    if (lista.length) setActiva(lista[0].id);

    let pendiente = false;
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        // La sección actual es la última cuyo título ya pasó la línea de lectura.
        let actual = lista[0]?.id ?? "";
        for (const s of lista) {
          const el = document.getElementById(s.id);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= LINEA_LECTURA) actual = s.id;
        }
        setActiva(actual);
      });
    };

    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, [selector]);

  if (!secciones.length) return null;

  const titulaActiva = secciones.find((s) => s.id === activa)?.titulo ?? t.navegacion.contenido;

  return (
    <>
      {/* -------------------- Móvil: barra superior desplegable -------------------- */}
      <div className="lg:hidden sticky top-0 z-30 bg-superficie/95 backdrop-blur border-b border-linea">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="rotulo text-suave block">{t.navegacion.seccion}</span>
            <span className="text-sm truncate block">{titulaActiva}</span>
          </span>
          <span className="text-suave text-xs shrink-0">{abierto ? "▲" : "▼"}</span>
        </button>
        {abierto && (
          <nav
            className="border-t border-linea max-h-[60vh] overflow-y-auto"
            aria-label={t.navegacion.secciones}
          >
            <ol className="py-1">
              {secciones.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={"#" + s.id}
                    onClick={() => setAbierto(false)}
                    className={
                      "flex gap-2 px-4 py-2 text-sm transition-colors " +
                      (activa === s.id ? "text-tinta bg-fondo font-medium" : "text-suave")
                    }
                  >
                    <span className="mono text-xs text-suave w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
            {/* La calculadora no es una sección del documento: es el destino al
                final. Va como acción aparte para que el resaltado de sección no
                marque nunca algo que ya no está a la vista. */}
            <a
              href="#calculadora"
              onClick={() => setAbierto(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm border-t border-linea text-mem"
            >
              {t.navegacion.irCalculadora}
            </a>
          </nav>
        )}
      </div>

      {/* -------------------- Escritorio: columna pegada al lado -------------------- */}
      <nav
        className="hidden lg:block w-60 shrink-0 self-start sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-4"
        aria-label={t.navegacion.secciones}
      >
        <div className="rotulo text-suave mb-3">{t.navegacion.contenido}</div>
        <ol className="border-l border-linea">
          {secciones.map((s, i) => {
            const act = activa === s.id;
            return (
              <li key={s.id}>
                <a
                  href={"#" + s.id}
                  className={
                    "flex gap-2 py-1.5 pl-3 -ml-px border-l-2 text-sm leading-snug transition-colors " +
                    (act
                      ? "border-mem text-tinta font-medium"
                      : "border-transparent text-suave hover:text-tinta")
                  }
                  aria-current={act ? "true" : undefined}
                >
                  <span className="mono text-xs text-suave shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">{s.titulo}</span>
                </a>
              </li>
            );
          })}
        </ol>
        <a
          href="#calculadora"
          className="mt-3 inline-flex items-center gap-2 text-sm text-mem hover:underline"
        >
          {t.navegacion.irCalculadora}
        </a>
      </nav>
    </>
  );
}

export default Navegacion;
