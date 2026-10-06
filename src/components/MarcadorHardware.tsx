/**
 * Cómo se distingue una GPU suelta de un chasis en las gráficas.
 *
 * El color ya dice qué restricción manda, así que la clase de hardware viaja en
 * la forma: círculo para una GPU, cuadrado para un chasis. Una forma y no un
 * segundo color, para que la diferencia se vea también sin distinguir colores.
 */

import { useTextos } from "../i18n/contexto";
import { COLOR } from "../lib/formato";

/**
 * Un borde blanco bajo las letras de las etiquetas: sobre las curvas, la línea del
 * SLO o el punto vecino el texto sigue leyéndose. `paint-order` dibuja primero el
 * borde y encima el relleno, así que las letras no engordan.
 */
export const HALO_TEXTO = {
  paintOrder: "stroke",
  stroke: COLOR.superficie,
  strokeWidth: 3,
  strokeLinejoin: "round",
} as const;

interface MarcadorProps {
  x: number;
  y: number;
  /** El radio del círculo; el cuadrado tiene su misma área. */
  r: number;
  chasis: boolean;
  fill: string;
  opacity: number;
}

/** Un punto de la gráfica: círculo si es una GPU, cuadrado redondeado si es un chasis. */
export function Marcador({ x, y, r, chasis, fill, opacity }: MarcadorProps) {
  if (!chasis) return <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity} />;
  // Lado √π·r: la misma área que el círculo de radio r.
  const medio = r * 0.886;
  return (
    <rect
      x={x - medio}
      y={y - medio}
      width={2 * medio}
      height={2 * medio}
      rx={1.5}
      fill={fill}
      opacity={opacity}
    />
  );
}

/** La muestra de una leyenda: lo que dibujaría la gráfica para esa clase de hardware. */
function Muestra({ chasis, conLinea }: { chasis: boolean; conLinea: boolean }) {
  return (
    <svg width={conLinea ? 26 : 12} height={12} aria-hidden="true" className="shrink-0">
      {conLinea && (
        <line
          x1={0}
          x2={26}
          y1={6}
          y2={6}
          stroke={COLOR.suave}
          strokeWidth={1.4}
          strokeDasharray={chasis ? "5 3" : undefined}
        />
      )}
      <Marcador x={conLinea ? 13 : 6} y={6} r={4} chasis={chasis} fill={COLOR.suave} opacity={1} />
    </svg>
  );
}

/**
 * La leyenda de formas. Solo tiene sentido cuando la gráfica trae las dos clases
 * a la vez; con una sola, la forma no distingue nada y la leyenda sobra.
 *
 * `conLinea` es para la frontera de capacidad, donde cada hardware es una curva
 * y la del chasis va a trazos; en la gráfica de costo no hay curvas por unidad.
 */
export function LeyendaHardware({ conLinea }: { conLinea: boolean }) {
  const t = useTextos();
  return (
    <>
      <span className="flex items-center gap-1.5">
        <Muestra chasis={false} conLinea={conLinea} />
        {t.graficas.leyendaGPU}
      </span>
      <span className="flex items-center gap-1.5">
        <Muestra chasis={true} conLinea={conLinea} />
        {t.graficas.leyendaChasis}
      </span>
    </>
  );
}
