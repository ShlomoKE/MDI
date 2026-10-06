/**
 * La frontera de capacidad: agentes contra usuarios, con el hardware fijo.
 *
 * Cada curva es una GPU (línea continua, punto redondo) o un chasis (línea a
 * trazos, punto cuadrado); el punto es hueco si otra opción la supera a la vez en
 * costo y en usuarios que caben. Todos los puntos sobre la curva saturan el sistema, así
 * que no hay un óptimo: es el intercambio real entre atender agentes y atender
 * usuarios, y la pendiente es κ. A diferencia del prototipo la curva se
 * muestrea llamando al motor, no se dibuja como recta: cuando el cuello cambia
 * de bytes a cómputo aparece un codo, y ese codo es información.
 */

import { useTextos } from "../i18n/contexto";
import { esChasis, type Vista } from "../lib/catalogos";
import { anchoDeTexto, cajaDeTexto, colocarEtiquetas, repartirEnColumna } from "../lib/etiquetas";
import { COLOR, colorCuello, fmt } from "../lib/formato";
import type { Fila } from "../lib/resultados";
import { VacioSVG } from "./GraficaPareto";
import { HALO_TEXTO, Marcador } from "./MarcadorHardware";

interface Props {
  filas: Fila[];
  /** Agentes fijados por el usuario: la recta vertical de referencia. */
  Ua: number;
  G: number;
  /** Qué se está comparando: decide si G son GPUs, chasis o unidades. */
  vista: Vista;
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

export function GraficaFrontera({ filas, Ua, G, vista, foco, setFoco }: Props) {
  const t = useTextos();
  const ok = filas.filter((f) => f.techos.viable && f.frontera.length > 1);
  const unidades = t.calculadora.unidades(vista, String(G));

  if (!ok.length) {
    return <VacioSVG texto={t.graficas.vacioFrontera(unidades)} />;
  }

  const maxX = Math.max(Ua * 1.2, ...ok.map((f) => f.soloAgentes), 1) * 1.08;
  const maxY = Math.max(...ok.map((f) => f.soloUsuarios), 1) * 1.15;

  const px = (v: number) => ML + (v / maxX) * PW;
  const py = (v: number) => MT + PH - (v / maxY) * PH;

  // Cada punto de operación está en la recta de los agentes fijados, salvo los de las
  // unidades que no llegan a tantos agentes: esos quedan más a la izquierda, a ras
  // del eje. Con GPUs y chasis juntos, los que están sobre la recta se amontonan en
  // la misma vertical y no hay a dónde apartar un nombre en horizontal: van en una
  // columna a un lado de la recta, repartidos en vertical con el mínimo
  // desplazamiento, y una línea guía los une a su punto. Los demás, que sí tienen
  // sitio alrededor, se acomodan junto a su punto como en la gráfica de costo.
  const textoAgentes = `${fmt(Ua)} ${t.graficas.agentesSufijo}`;
  const hayRecta = Ua > 0 && Ua < maxX;
  const punto = (f: Fila) => ({
    x: px(Math.min(Ua, f.soloAgentes)),
    y: py(f.cap.alcanza ? Math.max(0, f.cap.usuarios) : 0),
  });
  const xRecta = px(Math.min(Ua, maxX));
  const sobreRecta = (f: Fila) => Math.abs(punto(f).x - xRecta) <= 6;
  const enColumna = ok.filter(sobreRecta);
  const sueltas = ok.filter((f) => !sobreRecta(f));

  // Al enfocar un punto, junto a su nombre aparece cuántos usuarios caben: la
  // columna se pone del lado donde ese texto también cabe, y a la derecha si en
  // ninguno cabe.
  const anchoMax = enColumna.length
    ? Math.max(...enColumna.map((f) => anchoDeTexto(f.gpu.nombre))) + 110
    : 0;
  const alDerecha = xRecta + 14 + anchoMax <= W - 4 || xRecta - 14 - anchoMax < ML + 2;
  const xColumna = alDerecha ? xRecta + 14 : xRecta - 14;
  // La primera línea base deja libre el rótulo de los agentes, arriba de la recta.
  const lineas = repartirEnColumna(
    enColumna.map((f) => ({ id: f.gpu.id, y: punto(f).y + 3.5 })),
    MT + (hayRecta ? 26 : 9),
    MT + PH - 3,
  );
  const etiquetas = colocarEtiquetas(
    sueltas.map((f) => ({ id: f.gpu.id, ...punto(f), ancho: anchoDeTexto(f.gpu.nombre) })),
    { x0: ML + 2, y0: MT - 6, x1: W - 4, y1: MT + PH - 1 },
    [
      ...(hayRecta ? [cajaDeTexto(px(Ua) + 5, MT + 12, anchoDeTexto(textoAgentes))] : []),
      // Lo que ya ocupa la columna: sus nombres y los puntos que quedan junto a ellos.
      ...enColumna.map((f) =>
        cajaDeTexto(
          xColumna,
          lineas.get(f.gpu.id)!,
          anchoDeTexto(f.gpu.nombre),
          alDerecha ? "start" : "end",
        ),
      ),
      ...enColumna.map((f) => {
        const { x, y } = punto(f);
        return { x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 };
      }),
    ],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      style={{ maxHeight: 380 }}
      role="img"
      aria-label={t.graficas.ariaFrontera(unidades)}
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

      {/* una curva por unidad de hardware; la de un chasis va a trazos */}
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
            strokeDasharray={esChasis(f.gpu) ? "6 3" : undefined}
            opacity={hv ? 1 : 0.45}
          />
        );
      })}

      {/* los agentes que el usuario fijó */}
      {hayRecta && (
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
            {textoAgentes}
          </text>
        </>
      )}

      {/* el punto de operación de cada unidad sobre la recta de agentes */}
      {ok.map((f) => {
        const col = colorCuello(f.cap.alcanza ? f.cap.cuello : f.cruces.regimen);
        const hv = foco === f.gpu.id;
        const { x, y } = punto(f);
        const enCol = lineas.has(f.gpu.id);
        const detalle = f.cap.alcanza
          ? `${fmt(f.cap.usuarios)} ${t.graficas.usuariosSufijo}`
          : t.calculadora.noAlcanza;
        const etiqueta = enCol ? null : etiquetas.get(f.gpu.id)!;
        const linea = enCol ? lineas.get(f.gpu.id)! : 0;
        const movida = enCol && Math.abs(linea - 3.5 - y) > 2;
        // Fuera de la columna el detalle va al lado contrario del nombre, para no taparlo.
        const detalleY = etiqueta && etiqueta.y - y > 8 ? y - 14 : y + 20;
        return (
          <g
            key={f.gpu.id}
            onMouseEnter={() => setFoco(f.gpu.id)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(f.gpu.id)}
            onBlur={() => setFoco(null)}
            tabIndex={0}
            aria-label={
              t.graficas.puntoFrontera(f.gpu.nombre, detalle, fmt(Ua)) +
              (f.dominada ? `, ${t.tabla.dominada}` : "")
            }
            style={{ cursor: "pointer" }}
          >
            <circle cx={x} cy={y} r={26} fill="transparent" />
            {movida && (
              <line
                x1={x + (alDerecha ? 4 : -4)}
                y1={y}
                x2={xColumna + (alDerecha ? -3 : 3)}
                y2={linea - 3.5}
                stroke={COLOR.suave}
                strokeWidth="0.8"
                opacity="0.7"
              />
            )}
            <Marcador
              x={x}
              y={y}
              r={hv ? 8 : 5.5}
              chasis={esChasis(f.gpu)}
              fill={col}
              opacity={hv ? 1 : 0.88}
              hueco={f.dominada}
            />
            {enCol ? (
              /* El nombre queda fijo junto a la recta y el detalle del enfoque crece
                 hacia afuera: a la derecha del nombre, o a su izquierda si la
                 columna está del lado izquierdo. */
              <text
                x={xColumna}
                y={linea}
                textAnchor={alDerecha ? "start" : "end"}
                fontSize="10"
                fill={f.dominada ? COLOR.suave : COLOR.tinta}
                fontWeight={hv ? 600 : 400}
                {...HALO_TEXTO}
              >
                {!alDerecha && hv && (
                  <tspan fill={COLOR.suave} fontWeight={400} className="mono">
                    {detalle} ·{" "}
                  </tspan>
                )}
                {f.gpu.nombre}
                {alDerecha && hv && (
                  <tspan fill={COLOR.suave} fontWeight={400} className="mono">
                    {" "}
                    · {detalle}
                  </tspan>
                )}
              </text>
            ) : (
              <>
                <text
                  x={etiqueta!.x}
                  y={etiqueta!.y}
                  textAnchor={etiqueta!.ancla}
                  fontSize="10"
                  fill={f.dominada ? COLOR.suave : COLOR.tinta}
                  fontWeight={hv ? 600 : 400}
                  {...HALO_TEXTO}
                >
                  {f.gpu.nombre}
                </text>
                {hv && (
                  <text
                    x={x}
                    y={detalleY}
                    textAnchor="middle"
                    fontSize="10"
                    fill={COLOR.suave}
                    className="mono"
                    {...HALO_TEXTO}
                  >
                    {detalle}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default GraficaFrontera;
