/**
 * La frontera de capacidad: agentes contra usuarios, con el hardware fijo.
 *
 * Cada curva es una GPU. Todos los puntos sobre ella saturan el sistema, así
 * que no hay un óptimo: es el intercambio real entre atender agentes y atender
 * usuarios, y la pendiente es κ. A diferencia del prototipo la curva se
 * muestrea llamando al motor, no se dibuja como recta: cuando el cuello cambia
 * de bytes a cómputo aparece un codo, y ese codo es información.
 */

import { useTextos } from "../i18n/contexto";
import { COLOR, colorCuello, fmt } from "../lib/formato";
import type { Fila } from "../lib/resultados";
import { VacioSVG } from "./GraficaPareto";

interface Props {
  filas: Fila[];
  /** Agentes fijados por el usuario: la recta vertical de referencia. */
  Ua: number;
  G: number;
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

export function GraficaFrontera({ filas, Ua, G, foco, setFoco }: Props) {
  const t = useTextos();
  const ok = filas.filter((f) => f.techos.viable && f.frontera.length > 1);

  if (!ok.length) {
    return <VacioSVG texto={t.graficas.vacioFrontera(String(G))} />;
  }

  const maxX = Math.max(Ua * 1.2, ...ok.map((f) => f.soloAgentes), 1) * 1.08;
  const maxY = Math.max(...ok.map((f) => f.soloUsuarios), 1) * 1.15;

  const px = (v: number) => ML + (v / maxX) * PW;
  const py = (v: number) => MT + PH - (v / maxY) * PH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ maxHeight: 380 }}
      role="img"
      aria-label={t.graficas.ariaFrontera(String(G))}
    >
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
            {fmt(maxY * t, 0)}
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
          {fmt(maxX * t, maxX < 20 ? 1 : 0)}
        </text>
      ))}

      <text x={ML + PW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={COLOR.suave}>
        {t.graficas.ejeAgentes}
      </text>
      <text
        x={14}
        y={MT + PH / 2}
        textAnchor="middle"
        fontSize="11"
        fill={COLOR.suave}
        transform={`rotate(-90 14 ${MT + PH / 2})`}
      >
        {t.graficas.ejeUsuarios}
      </text>

      {/* una curva por GPU */}
      {ok.map((f) => {
        const col = colorCuello(f.cap.alcanza ? f.cap.cuello : f.cruces.regimen);
        const hv = foco === f.gpu.id;
        return (
          <polyline
            key={"f" + f.gpu.id}
            points={f.frontera.map(([a, u]) => `${px(a)},${py(u)}`).join(" ")}
            fill="none"
            stroke={col}
            strokeWidth={hv ? 2.5 : 1.2}
            opacity={hv ? 1 : 0.45}
          />
        );
      })}

      {/* los agentes que el usuario fijó */}
      {Ua > 0 && Ua < maxX && (
        <>
          <line
            x1={px(Ua)}
            x2={px(Ua)}
            y1={MT}
            y2={MT + PH}
            stroke={COLOR.tinta}
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text x={px(Ua) + 5} y={MT + 12} fontSize="10" fill={COLOR.tinta} className="mono">
            {fmt(Ua)} {t.graficas.agentesSufijo}
          </text>
        </>
      )}

      {/* el punto de operación de cada GPU sobre la recta de agentes */}
      {ok.map((f) => {
        const col = colorCuello(f.cap.alcanza ? f.cap.cuello : f.cruces.regimen);
        const hv = foco === f.gpu.id;
        const x = px(Math.min(Ua, f.soloAgentes));
        const y = py(f.cap.alcanza ? Math.max(0, f.cap.usuarios) : 0);
        return (
          <g
            key={f.gpu.id}
            onMouseEnter={() => setFoco(f.gpu.id)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(f.gpu.id)}
            onBlur={() => setFoco(null)}
            tabIndex={0}
            aria-label={t.graficas.puntoFrontera(
              f.gpu.nombre,
              f.cap.alcanza
                ? `${fmt(f.cap.usuarios)} ${t.graficas.usuariosSufijo}`
                : t.calculadora.noAlcanza,
              fmt(Ua),
            )}
            style={{ cursor: "pointer" }}
          >
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
                {f.cap.alcanza
                  ? `${fmt(f.cap.usuarios)} ${t.graficas.usuariosSufijo}`
                  : t.calculadora.noAlcanza}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default GraficaFrontera;
