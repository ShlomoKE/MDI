/**
 * El cambio de idioma es un enlace, no un botón de estado.
 *
 * Cada idioma es una página completa y prerenderizada, así que pasar de una a
 * otra es navegar. La ventaja es que el enlace se puede copiar, abrir en otra
 * pestaña e indexar; el precio es una recarga, que en una página estática no se
 * nota.
 *
 * Lo delicado es QUÉ enlace. Se conservan la query y el ancla para que quien
 * esté leyendo una sección concreta —o tenga una configuración armada en la
 * calculadora— caiga en el mismo sitio en el otro idioma. Y eso no se puede
 * calcular una sola vez al montar: la calculadora escribe la query con
 * `history.replaceState`, que no dispara ningún evento, y saltar a una sección
 * cambia el ancla sin recargar. Un `href` calculado al montar se queda viejo y
 * el lector pierde su configuración justo al cambiar de idioma.
 *
 * Por eso el sufijo se refresca en tres momentos: al montar, cuando el ancla
 * cambia, y —el que de verdad importa— justo antes de que el enlace se use.
 */

import { useCallback, useEffect, useState } from "react";

import { useIdioma, useTextos } from "../i18n/contexto";
import { NOMBRE_IDIOMA, OTRO_IDIOMA, RUTA_IDIOMA } from "../i18n/idioma";

export function SelectorIdioma({ className = "" }: { className?: string }) {
  const idioma = useIdioma();
  const t = useTextos();
  const otro = OTRO_IDIOMA[idioma];

  // Arranca vacío a propósito: el prerenderizado no tiene `window`, y el primer
  // render del cliente tiene que coincidir con él para que hidratar sea limpio.
  const [sufijo, setSufijo] = useState("");

  const actualizar = useCallback(() => {
    setSufijo(window.location.search + window.location.hash);
  }, []);

  useEffect(() => {
    actualizar();
    window.addEventListener("hashchange", actualizar);
    window.addEventListener("popstate", actualizar);
    return () => {
      window.removeEventListener("hashchange", actualizar);
      window.removeEventListener("popstate", actualizar);
    };
  }, [actualizar]);

  return (
    <a
      href={RUTA_IDIOMA[otro] + sufijo}
      hrefLang={otro}
      lang={otro}
      title={t.idioma.cambiar}
      // `replaceState` no emite eventos, así que la query de la calculadora solo
      // se puede leer preguntando. Estos tres cubren ratón, dedo y teclado justo
      // antes de que el enlace se active.
      onPointerDown={actualizar}
      onFocus={actualizar}
      onMouseEnter={actualizar}
      className={
        "inline-flex items-center gap-1.5 rounded border border-linea bg-superficie px-2.5 py-1 text-xs text-suave hover:text-tinta hover:bg-fondo transition-colors " +
        className
      }
    >
      <span aria-hidden>🌐</span>
      {NOMBRE_IDIOMA[otro]}
    </a>
  );
}

export default SelectorIdioma;
