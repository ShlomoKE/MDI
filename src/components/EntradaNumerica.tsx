/**
 * Un campo numérico que no destruye lo que estás tecleando.
 *
 * El problema con `<input type="number">` es que el navegador sanea el valor:
 * mientras escribes «3.5», en el instante en que el contenido es «3.» el input
 * reporta cadena vacía. Un handler que hace `parseFloat(e.target.value) || 0`
 * escribe 0 en el estado, y como el input es controlado React repone «0» encima
 * del punto recién tecleado. El resultado medido es que «3.5» acaba siendo 5.
 * Tampoco basta con ignorar los valores inválidos: React reejecuta
 * `restoreControlledState` de todas formas y repone el número anterior.
 *
 * La salida es no dejar que el navegador sanee nada —`type="text"` con
 * `inputMode="decimal"`, que en móvil sigue abriendo el teclado numérico— y
 * mantener el texto en crudo mientras el campo tiene el foco. El estado recibe
 * el número en cuanto el texto parsea; el texto se normaliza al salir.
 *
 * Las flechas del navegador se pierden con `type="text"`, así que ↑ y ↓ se
 * implementan a mano sobre el mismo `paso`.
 */

import { useEffect, useRef, useState } from "react";

export interface PropsEntrada {
  valor: number;
  set: (v: number) => void;
  paso?: number;
  min?: number;
  max?: number;
  id?: string;
  etiqueta?: string;
  className?: string;
}

const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function EntradaNumerica({
  valor,
  set,
  paso = 1,
  min = 0,
  max = Infinity,
  id,
  etiqueta,
  className = "",
}: PropsEntrada) {
  // `null` significa "sin edición en curso": manda el valor del estado.
  const [borrador, setBorrador] = useState<string | null>(null);
  const enfocado = useRef(false);

  // Si el valor cambia desde fuera (cargar un enlace, restaurar el catálogo)
  // mientras el campo no está enfocado, el texto tiene que seguirlo.
  useEffect(() => {
    if (!enfocado.current) setBorrador(null);
  }, [valor]);

  const mostrado = borrador ?? String(valor);

  const alEscribir = (bruto: string) => {
    setBorrador(bruto);
    const t = bruto.trim();
    if (t === "" || t === "-" || t === "." || t === "-.") return; // aún no es un número
    const v = Number(t);
    if (!Number.isFinite(v)) return;
    set(acotar(v, min, max));
  };

  const alSalir = () => {
    enfocado.current = false;
    setBorrador(null); // el texto vuelve a reflejar el número ya acotado
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const base = Number(mostrado);
    const desde = Number.isFinite(base) ? base : valor;
    const nuevo = acotar(e.key === "ArrowUp" ? desde + paso : desde - paso, min, max);
    // El paso puede arrastrar la basura binaria de 0.1 + 0.2; se recorta.
    const limpio = Number(nuevo.toPrecision(12));
    setBorrador(String(limpio));
    set(limpio);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={mostrado}
      aria-label={etiqueta}
      onFocus={() => {
        enfocado.current = true;
      }}
      onChange={(e) => alEscribir(e.target.value)}
      onBlur={alSalir}
      onKeyDown={alTeclear}
      className={className}
    />
  );
}

export default EntradaNumerica;
