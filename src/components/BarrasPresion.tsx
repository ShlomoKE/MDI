/**
 * Las tres restricciones lado a lado.
 *
 * Cada barra es cuántas GPUs exigiría esa restricción por sí sola. La que
 * domina va a plena opacidad y es la que fija el total; las otras dos quedan
 * atenuadas para que se vea de un golpe cuánta holgura hay.
 */

import type { Cuello } from "../lib/motor";
import { COLOR, fmt } from "../lib/formato";
import { useTextos } from "../i18n/contexto";
import { nombreCuello } from "../i18n/cuello";

interface Props {
  G_mem: number;
  G_lat: number;
  G_comp: number;
  cuello: Cuello | "";
  /** Ancho mínimo del bloque; en tarjeta conviene dejarlo suelto. */
  ancho?: number | string;
}

export function BarrasPresion({ G_mem, G_lat, G_comp, cuello, ancho = 130 }: Props) {
  const t = useTextos();

  // Las filas se arman dentro del componente porque sus rótulos dependen del
  // idioma. La clave `k` no: es el valor que devuelve el motor y no se traduce.
  const FILAS: Array<{ k: Cuello; corto: string; largo: string; color: string }> = [
    {
      k: "memoria",
      corto: t.barras.memCorto,
      largo: nombreCuello(t, "memoria"),
      color: COLOR.memoria,
    },
    {
      k: "latencia",
      corto: t.barras.latCorto,
      largo: nombreCuello(t, "latencia"),
      color: COLOR.latencia,
    },
    {
      k: "computo",
      corto: t.barras.compCorto,
      largo: nombreCuello(t, "computo"),
      color: COLOR.computo,
    },
  ];

  const valores: Record<Cuello, number> = {
    memoria: G_mem,
    latencia: G_lat,
    computo: G_comp,
  };
  // La escala es la restricción que manda: la barra llena es la que fija G.
  const finitos = [G_mem, G_lat, G_comp].filter(Number.isFinite);
  const max = finitos.length ? Math.max(...finitos, 0) : 1;

  return (
    <div className="flex flex-col gap-1" style={{ minWidth: ancho }}>
      {FILAS.map(({ k, corto, largo, color }) => {
        const v = valores[k];
        const manda = k === cuello;
        const pct = max > 0 && Number.isFinite(v) ? Math.min(100, (v / max) * 100) : 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <span
              className="text-xs w-7 shrink-0"
              style={{ color: manda ? color : COLOR.suave }}
              title={largo}
            >
              {corto}
            </span>
            <div
              className="flex-1 h-2 rounded bg-fondo min-w-8"
              role="img"
              aria-label={t.barras.aria(largo, fmt(v, 1))}
            >
              <div
                className="h-2 rounded transition-[width] duration-200"
                style={{ width: `${pct}%`, background: color, opacity: manda ? 1 : 0.3 }}
              />
            </div>
            <span className="mono text-xs w-9 text-right shrink-0 text-suave">
              {fmt(v, 1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default BarrasPresion;
