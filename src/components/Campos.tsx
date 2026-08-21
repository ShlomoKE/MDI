/**
 * Piezas mínimas de formulario que comparten el panel de parámetros, el editor
 * de catálogos y las tarjetas de resultado. Salen del prototipo, con los
 * ajustes que hacían falta para que funcionen con teclado y lector de pantalla.
 */

import { useId, type ReactNode } from "react";

import EntradaNumerica from "./EntradaNumerica";

export function Campo({
  label,
  valor,
  set,
  sufijo,
  paso = 1,
  min = 0,
  max,
  ayuda,
}: {
  label: string;
  valor: number;
  set: (v: number) => void;
  sufijo?: string;
  paso?: number;
  min?: number;
  max?: number;
  ayuda?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label htmlFor={id} className="text-xs text-suave" title={ayuda}>
        {label}
      </label>
      <span className="flex items-baseline gap-1 shrink-0">
        <EntradaNumerica
          id={id}
          valor={valor}
          set={set}
          min={min}
          max={max}
          paso={paso}
          className="campo mono w-24 px-2 py-1 text-right text-sm"
        />
        <span className="text-xs w-10 text-suave">{sufijo ?? ""}</span>
      </span>
    </div>
  );
}

/** Un valor que la calculadora fija y el usuario no puede mover. */
export function Fijo({ label, valor, nota }: { label: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-suave">{label}</span>
      <span className="flex items-baseline gap-1 shrink-0">
        <span className="mono w-24 px-2 py-1 text-right text-sm rounded border border-linea bg-fondo text-suave">
          {valor}
        </span>
        <span className="text-xs w-10 text-suave">{nota ?? ""}</span>
      </span>
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="rotulo mb-2 pb-1 border-b border-linea text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

export function Kpi({ k, v, col }: { k: string; v: ReactNode; col?: string }) {
  return (
    <div className="px-3 py-2 rounded border border-linea bg-superficie min-w-0">
      <div className="text-xs text-suave leading-tight">{k}</div>
      {/* `break-words` en vez de `truncate`: en móvil una etiqueta de dos
          palabras cabe partida, pero recortada no se entiende. */}
      <div className={"mono text-lg leading-tight break-words " + (col ?? "")}>{v}</div>
    </div>
  );
}

export function Boton({
  children,
  onClick,
  variante = "normal",
  type = "button",
  titulo,
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: "normal" | "principal" | "sutil";
  type?: "button" | "submit";
  titulo?: string;
}) {
  const base =
    "px-3 py-1.5 text-sm rounded border transition-colors whitespace-nowrap disabled:opacity-50";
  const estilos = {
    normal: "border-linea bg-superficie text-tinta hover:bg-fondo",
    principal: "border-tinta bg-tinta text-superficie hover:opacity-90",
    sutil: "border-transparent bg-transparent text-suave hover:text-tinta hover:bg-fondo",
  } as const;
  return (
    <button type={type} onClick={onClick} title={titulo} className={base + " " + estilos[variante]}>
      {children}
    </button>
  );
}

/** Input de texto para los nombres del catálogo. */
export function Texto({
  valor,
  set,
  etiqueta,
  ancho = "w-full",
}: {
  valor: string;
  set: (v: string) => void;
  etiqueta: string;
  ancho?: string;
}) {
  return (
    <input
      type="text"
      value={valor}
      aria-label={etiqueta}
      onChange={(e) => set(e.target.value)}
      className={"campo px-2 py-1 text-sm " + ancho}
    />
  );
}

/** Input numérico desnudo, para las rejillas del editor de catálogo. */
export function Numero({
  valor,
  set,
  etiqueta,
  paso = 1,
  min = 0,
  ancho = "w-full",
}: {
  valor: number;
  set: (v: number) => void;
  etiqueta: string;
  paso?: number;
  min?: number;
  ancho?: string;
}) {
  return (
    <EntradaNumerica
      valor={valor}
      set={set}
      paso={paso}
      min={min}
      etiqueta={etiqueta}
      className={"campo mono px-1.5 py-1 text-right text-sm " + ancho}
    />
  );
}
