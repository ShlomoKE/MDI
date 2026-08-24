/**
 * Costo contra latencia, en SVG dibujado a mano.
 *
 * Cada punto es una GPU dimensionada para la carga: en X el TPOT que logra, en
 * Y lo que cuesta por hora la cantidad de unidades que hacen falta. La banda de
 * la derecha es la zona que incumple el SLO. La línea punteada une el frente de
 * Pareto: fuera de esa línea siempre hay una opción mejor en ambos ejes.
 */

import { useTextos } from "../i18n/contexto";
import { COLOR, colorCuello, fmt, usd } from "../lib/formato";
import { dibujable, type Fila } from "../lib/resultados";

interface Props {
  filas: Fila[];
  pareto: Fila[];
  slo_ms: number;
  foco: string | null;
  setFoco: (id: string | null) => void;
}

const W = 640;
const H = 340;
const ML = 66;
const MR = 24;
const MT = 24;
const MB = 46;
const PW = W - ML - MR;
const PH = H - MT - MB;

const TICKS = [0, 0.25, 0.5, 0.75, 1];

export function GraficaPareto({ filas, pareto, slo_ms, foco, setFoco }: Props) {
  const t = useTextos();
  const ok = filas.filter(dibujable);

  const maxX = Math.max(slo_ms * 1.25, ...ok.map((f) => f.dim.tpot_ms), 10);
  const maxY = Math.max(...ok.map((f) => f.dim.costo_hora), 1) * 1.15;

  const px = (v: number) => ML + (v / maxX) * PW;
  const py = (v: number) => MT + PH - (v / maxY) * PH;

  if (!ok.length) {
    return <VacioSVG texto={t.graficas.vacioPareto} />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ maxHeight: 380 }}
      role="img"
      aria-label={t.graficas.ariaPareto(ok.length)}
    >
      {/* rejilla horizontal y escala de costo */}
      {TICKS.map((t) => (
        <g key={"y" + t}>
          <line
            x1={ML}
            x2={ML + PW}
            y1={py(maxY * t)}
            y2={py(maxY * t)}
            stroke={COLOR.linea}
            strokeWidth="1"
          />
          <text
            x={ML - 8}
            y={py(maxY * t) + 4}
            textAnchor="end"
            fontSize="10"
            fill={COLOR.suave}
            className="mono"
          >
            {fmt(maxY * t, 1)}
          </text>
        </g>
      ))}

      {TICKS.map((t) => (
        <text
          key={"x" + t}
          x={px(maxX * t)}
          y={MT + PH + 18}
          textAnchor="middle"
          fontSize="10"
          fill={COLOR.suave}
          className="mono"
        >
          {fmt(maxX * t, 0)}
        </text>
      ))}

      <text x={ML + PW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={COLOR.suave}>
        {t.graficas.ejeTPOT}
      </text>
      <text
        x={14}
        y={MT + PH / 2}
        textAnchor="middle"
        fontSize="11"
        fill={COLOR.suave}
        transform={`rotate(-90 14 ${MT + PH / 2})`}
      >
        {t.graficas.ejeCosto}
      </text>

      {/* zona que incumple el SLO */}
      <rect
        x={px(slo_ms)}
        y={MT}
        width={Math.max(0, ML + PW - px(slo_ms))}
        height={PH}
        fill={COLOR.latenciaTenue}
        opacity="0.45"
      />
      <line
        x1={px(slo_ms)}
        x2={px(slo_ms)}
        y1={MT}
        y2={MT + PH}
        stroke={COLOR.latencia}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <text
        x={px(slo_ms) + 5}
        y={MT + 12}
        fontSize="10"
        fill={COLOR.latencia}
        className="mono"
      >
        {t.graficas.slo(fmt(slo_ms, slo_ms % 1 === 0 ? 0 : 1))}
      </text>

      {/* frente de Pareto */}
      {pareto.length > 1 && (
        <polyline
          points={pareto.map((f) => `${px(f.dim.tpot_ms)},${py(f.dim.costo_hora)}`).join(" ")}
          fill="none"
          stroke={COLOR.suave}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.7"
        />
      )}

      {/* una GPU por punto */}
      {ok.map((f) => {
        const col = colorCuello(f.dim.cuello);
        const hv = foco === f.gpu.id;
        const x = px(f.dim.tpot_ms);
        const y = py(f.dim.costo_hora);
        return (
          <g
            key={f.gpu.id}
            onMouseEnter={() => setFoco(f.gpu.id)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(f.gpu.id)}
            onBlur={() => setFoco(null)}
            tabIndex={0}
            aria-label={t.graficas.puntoPareto(
              f.gpu.nombre,
              String(f.dim.G),
              fmt(f.dim.tpot_ms, 1),
              usd(f.dim.costo_hora),
            )}
            style={{ cursor: "pointer" }}
          >
            {/* área de contacto generosa para el dedo en pantallas táctiles */}
            <circle cx={x} cy={y} r={26} fill="transparent" />
            <circle cx={x} cy={y} r={hv ? 8 : 5.5} fill={col} opacity={hv ? 1 : 0.88} />
            <text
              x={x}
              y={y - 12}
              textAnchor="middle"
              fontSize="10"
              fill={COLOR.tinta}
              fontWeight={hv ? 600 : 400}
            >
              {f.gpu.nombre}
            </text>
            {hv && (
              <text
                x={x}
                y={y + 20}
                textAnchor="middle"
                fontSize="10"
                fill={COLOR.suave}
                className="mono"
              >
                {f.dim.G}× · {usd(f.dim.costo_hora)}/h
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Recibe el texto ya traducido: quien la usa es el que tiene el diccionario. */
export function VacioSVG({ texto }: { texto: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 380 }}>
      <rect x={ML} y={MT} width={PW} height={PH} fill={COLOR.fondo} rx="4" />
      <text
        x={ML + PW / 2}
        y={MT + PH / 2}
        textAnchor="middle"
        fontSize="13"
        fill={COLOR.suave}
      >
        {texto}
      </text>
    </svg>
  );
}

export default GraficaPareto;
