/**
 * La calculadora, montada solo cuando el lector se acerca a ella.
 *
 * Vive al final de unos catorce mil píxeles de documento. Montarla en el
 * arranque cuesta setecientos elementos, dos gráficas SVG y la descarga de
 * KaTeX, todo para algo que nadie está mirando todavía. Con un
 * IntersectionObserver de margen generoso se monta bastante antes de entrar en
 * pantalla, así que en la práctica siempre está lista cuando se llega.
 *
 * El contenedor conserva el `id` y la altura reservada, de modo que el enlace
 * de salto funciona aunque el contenido aún no exista.
 */

import { useEffect, useRef, useState } from "react";

import Calculadora from "./Calculadora";

/** Cuánto antes de entrar en pantalla se monta. */
const MARGEN = "900px 0px";

export function SeccionCalculadora() {
  const [montada, setMontada] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (montada) return;

    // Si se llegó por un enlace directo a la calculadora, no hay nada que diferir.
    if (window.location.hash === "#calculadora") {
      setMontada(true);
      return;
    }

    const el = ref.current;
    // Sin IntersectionObserver —o sin nodo— se monta y ya: mejor pagar el
    // arranque que dejar la calculadora inaccesible.
    if (!el || typeof IntersectionObserver === "undefined") {
      setMontada(true);
      return;
    }

    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setMontada(true);
          io.disconnect();
        }
      },
      { rootMargin: MARGEN },
    );
    io.observe(el);

    // Un salto por hash mientras la página ya está cargada.
    const alSaltar = () => {
      if (window.location.hash === "#calculadora") setMontada(true);
    };
    window.addEventListener("hashchange", alSaltar);

    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", alSaltar);
    };
  }, [montada]);

  return (
    <div ref={ref} id="calculadora" className="calculadora-diferida scroll-mt-20">
      {montada ? <Calculadora /> : <Marcador />}
    </div>
  );
}

/** Lo que se ve el instante que va entre llegar y montar. */
function Marcador() {
  return (
    <div
      className="border-y border-linea bg-superficie px-4 sm:px-6 py-5 min-h-[70vh]"
      aria-busy="true"
    >
      <h2 className="font-cond font-bold text-2xl sm:text-[26px] tracking-tight">
        Calculadora MDI
      </h2>
      <p className="text-sm mt-1 text-suave">Preparando la calculadora…</p>
    </div>
  );
}

export default SeccionCalculadora;
