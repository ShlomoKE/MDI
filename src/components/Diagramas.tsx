/**
 * Los diagramas del documento, en SVG inline.
 *
 * Sin librería de gráficas: son cuatro dibujos fijos que explican la mecánica,
 * con la misma paleta que la calculadora — verde pino para memoria, naranja
 * quemado para latencia, azul para cómputo — para que el lector reconozca cada
 * restricción antes de llegar a la tabla de resultados.
 */

import type { ReactNode } from "react";

import { COLOR } from "../lib/formato";

function Marco({
  titulo,
  pie,
  alto,
  children,
}: {
  titulo: string;
  pie: string;
  alto: number;
  children: ReactNode;
}) {
  return (
    <figure className="my-7 rounded border border-linea bg-superficie p-3 sm:p-4">
      <svg
        viewBox={`0 0 640 ${alto}`}
        className="w-full h-auto"
        role="img"
        aria-label={titulo}
        fontFamily="'IBM Plex Sans', system-ui, sans-serif"
      >
        <title>{titulo}</title>
        {children}
      </svg>
      <figcaption className="text-xs text-suave mt-2 leading-relaxed">{pie}</figcaption>
    </figure>
  );
}

const Etiqueta = ({
  x,
  y,
  children,
  color = COLOR.suave,
  ancla = "start",
  tam = 11,
  peso = 400,
  mono = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  ancla?: "start" | "middle" | "end";
  tam?: number;
  peso?: number;
  mono?: boolean;
}) => (
  <text
    x={x}
    y={y}
    fontSize={tam}
    fill={color}
    textAnchor={ancla}
    fontWeight={peso}
    fontFamily={mono ? "'IBM Plex Mono', monospace" : undefined}
  >
    {children}
  </text>
);

// --------------------------------------------------------------------------- //
// 1. El ciclo de decodificación
// --------------------------------------------------------------------------- //

export function DiagramaCiclo() {
  const y0 = 46;
  const h = 34;
  const x0 = 24;
  const anchoPesos = 250;
  const anchoCache = 190;

  return (
    <Marco
      alto={210}
      titulo="El tiempo de un token es el máximo entre mover bytes y multiplicar"
      pie="Generar un token exige leer todos los pesos y, además, el caché de cada secuencia del lote. En paralelo la GPU multiplica. Lo que tarda el paso es el mayor de los dos caminos, no la suma: por eso agregar sesiones es casi gratis hasta que uno de los dos se satura."
    >
      <Etiqueta x={x0} y={26} tam={12} peso={600} color={COLOR.tinta}>
        Un paso de decodificación
      </Etiqueta>

      {/* camino de memoria */}
      <rect x={x0} y={y0} width={anchoPesos} height={h} fill={COLOR.tinta} rx="3" />
      <Etiqueta x={x0 + anchoPesos / 2} y={y0 + 22} ancla="middle" color={COLOR.superficie} tam={11.5}>
        leer los pesos · Pₘ / W
      </Etiqueta>

      <rect x={x0 + anchoPesos} y={y0} width={anchoCache} height={h} fill={COLOR.memoria} rx="3" />
      <Etiqueta x={x0 + anchoPesos + anchoCache / 2} y={y0 + 22} ancla="middle" color={COLOR.superficie} tam={11.5}>
        leer el caché · B·C·KVₜ / W
      </Etiqueta>

      <Etiqueta x={x0} y={y0 - 8} color={COLOR.memoria} peso={600} tam={11}>
        camino de memoria
      </Etiqueta>

      {/* camino de cómputo */}
      <rect x={x0} y={y0 + 62} width={310} height={h} fill={COLOR.computo} rx="3" />
      <Etiqueta x={x0 + 155} y={y0 + 84} ancla="middle" color={COLOR.superficie} tam={11.5}>
        multiplicar · 2·N·10⁹·B / F
      </Etiqueta>
      <Etiqueta x={x0} y={y0 + 54} color={COLOR.computo} peso={600} tam={11}>
        camino de cómputo
      </Etiqueta>

      {/* llave del máximo */}
      <line
        x1={x0 + anchoPesos + anchoCache}
        x2={x0 + anchoPesos + anchoCache}
        y1={y0 - 4}
        y2={y0 + 62 + h + 4}
        stroke={COLOR.latencia}
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <Etiqueta x={x0 + anchoPesos + anchoCache + 8} y={y0 + 52} color={COLOR.latencia} peso={600} tam={11}>
        TPOT
      </Etiqueta>
      <Etiqueta x={x0 + anchoPesos + anchoCache + 8} y={y0 + 68} color={COLOR.suave} tam={10} mono>
        = max(memoria, cómputo)
      </Etiqueta>

      {/* el SLO */}
      <line x1={x0} x2={616} y1={186} y2={186} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0} y={180} color={COLOR.suave} tam={10}>
        el SLO es una cota sobre este máximo: TPOT ≤ SLO
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 2. Los tres techos de una GPU
// --------------------------------------------------------------------------- //

export function DiagramaTechos() {
  const x0 = 130;
  const ancho = 470;
  const h = 30;

  const barra = (
    y: number,
    partes: Array<{ frac: number; color: string; texto: string; claro?: boolean }>,
  ) => {
    let acum = 0;
    return partes.map((p, i) => {
      const x = x0 + acum * ancho;
      const w = p.frac * ancho;
      acum += p.frac;
      return (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={p.color} rx="2" />
          {w > 54 && (
            <Etiqueta
              x={x + w / 2}
              y={y + 19}
              ancla="middle"
              color={p.claro ? COLOR.tinta : COLOR.superficie}
              tam={10.5}
            >
              {p.texto}
            </Etiqueta>
          )}
        </g>
      );
    });
  };

  return (
    <Marco
      alto={230}
      titulo="Las tres restricciones acotan cosas distintas"
      pie="Memoria y latencia acotan bytes de caché; cómputo acota secuencias en el lote. Las tres se evalúan por GPU y la que deja menos espacio es la que fija el total. Cambiar de hardware casi nunca mueve las tres a la vez: más VRAM sube el primer techo pero no el segundo."
    >
      <Etiqueta x={20} y={44} tam={11} peso={600} color={COLOR.memoria}>
        memoria
      </Etiqueta>
      <Etiqueta x={20} y={58} tam={10} color={COLOR.suave}>
        Vₜ − Pₘ − O
      </Etiqueta>
      {barra(30, [
        { frac: 0.32, color: COLOR.tinta, texto: "pesos Pₘ" },
        { frac: 0.09, color: COLOR.suave, texto: "O" },
        { frac: 0.59, color: COLOR.memoria, texto: "caché que cabe" },
      ])}

      <Etiqueta x={20} y={114} tam={11} peso={600} color={COLOR.latencia}>
        latencia
      </Etiqueta>
      <Etiqueta x={20} y={128} tam={10} color={COLOR.suave}>
        SLO·W − Pₘ
      </Etiqueta>
      {barra(100, [
        { frac: 0.32, color: COLOR.tinta, texto: "pesos Pₘ" },
        { frac: 0.34, color: COLOR.latencia, texto: "caché en el presupuesto" },
        { frac: 0.34, color: COLOR.latenciaTenue, texto: "fuera del SLO", claro: true },
      ])}

      <Etiqueta x={20} y={184} tam={11} peso={600} color={COLOR.computo}>
        cómputo
      </Etiqueta>
      <Etiqueta x={20} y={198} tam={10} color={COLOR.suave}>
        SLO·F / 2N·10⁹
      </Etiqueta>
      {barra(170, [
        { frac: 0.55, color: COLOR.computo, texto: "secuencias en el lote" },
        { frac: 0.45, color: COLOR.computoTenue, texto: "Tensor Cores saturados", claro: true },
      ])}

      <line x1={x0} x2={x0} y1={22} y2={210} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0 + ancho} y={222} ancla="end" tam={10} color={COLOR.suave}>
        cada barra es una GPU
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 3. Regímenes según el contexto
// --------------------------------------------------------------------------- //

export function DiagramaRegimenes() {
  const x0 = 60;
  const x1 = 600;
  const y = 96;
  const h = 42;
  // Un solo corte, no dos: el salto ocurre en min(Ceq₁, Ceq₃) y ahí termina el
  // régimen de cómputo.
  const corte = x0 + (x1 - x0) * 0.42;

  return (
    <Marco
      alto={212}
      titulo="El cuello de botella se mueve con el contexto"
      pie="Con contextos cortos el caché es despreciable y manda el cómputo: la GPU multiplica todo el día. Al alargar el contexto el caché domina el tráfico y el cuello pasa al techo de bytes más estrecho. Cuál de los dos es —memoria o latencia— no depende del contexto sino del hardware frente al SLO, así que los regímenes son dos, no tres: el salto ocurre en el menor de los dos cruces y el otro queda por detrás sin cambiar nada."
    >
      <Etiqueta x={x0} y={40} tam={12} peso={600} color={COLOR.tinta}>
        ¿Qué restricción manda?
      </Etiqueta>
      <Etiqueta x={x0} y={58} tam={10.5} color={COLOR.suave}>
        contexto promedio por sesión, escala logarítmica
      </Etiqueta>

      <rect x={x0} y={y} width={corte - x0} height={h} fill={COLOR.computoTenue} rx="2" />
      {/* La segunda mitad se pinta a dos aguas porque cuál de los dos techos de
          bytes manda es una propiedad de la GPU, no del contexto. */}
      <defs>
        <linearGradient id="mdi-bytes" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={COLOR.latenciaTenue} />
          <stop offset="100%" stopColor={COLOR.memoriaTenue} />
        </linearGradient>
      </defs>
      <rect x={corte} y={y} width={x1 - corte} height={h} fill="url(#mdi-bytes)" rx="2" />

      <Etiqueta x={(x0 + corte) / 2} y={y + 26} ancla="middle" color={COLOR.computo} peso={600} tam={12}>
        cómputo
      </Etiqueta>
      <Etiqueta x={(corte + x1) / 2} y={y + 21} ancla="middle" color={COLOR.latencia} peso={600} tam={12}>
        latencia o memoria
      </Etiqueta>
      <Etiqueta x={(corte + x1) / 2} y={y + 35} ancla="middle" color={COLOR.suave} tam={10}>
        el techo de bytes más estrecho
      </Etiqueta>

      <line x1={corte} x2={corte} y1={y - 12} y2={y + h + 12} stroke={COLOR.tinta} strokeWidth="1.5" />
      <Etiqueta x={corte} y={y - 18} ancla="middle" color={COLOR.tinta} peso={600} tam={11} mono>
        min(Ceq₁, Ceq₃)
      </Etiqueta>

      <line x1={x0} x2={x1} y1={y + h + 22} y2={y + h + 22} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0} y={y + h + 38} tam={10} color={COLOR.suave} mono>
        512 tok
      </Etiqueta>
      <Etiqueta x={x1} y={y + h + 38} ancla="end" tam={10} color={COLOR.suave} mono>
        200 000 tok
      </Etiqueta>
      <Etiqueta x={(x0 + x1) / 2} y={y + h + 38} ancla="middle" tam={10} color={COLOR.suave}>
        contexto C
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 4. Por qué el lote sale casi gratis
// --------------------------------------------------------------------------- //

export function DiagramaLote() {
  const filas = [1, 2, 3, 4];
  const x0 = 40;
  const wPesos = 240;
  const wCache = 42;
  const h = 22;
  const gap = 9;

  return (
    <Marco
      alto={228}
      titulo="El lote amortiza la lectura de los pesos"
      pie="Los pesos se leen una sola vez por paso y sirven para todas las secuencias del lote; el caché, en cambio, se paga por secuencia. De ahí sale toda la economía de la inferencia: la primera sesión cuesta carísima y las siguientes casi nada, hasta que la suma de cachés alcanza a los pesos y el sistema entra en el régimen de memoria."
    >
      <Etiqueta x={x0} y={26} tam={12} peso={600} color={COLOR.tinta}>
        Un lote de 4 secuencias, un solo paso
      </Etiqueta>

      <rect x={x0} y={44} width={wPesos} height={filas.length * (h + gap) - gap} fill={COLOR.tinta} rx="3" />
      <Etiqueta x={x0 + wPesos / 2} y={44 + (filas.length * (h + gap) - gap) / 2 + 4} ancla="middle" color={COLOR.superficie} tam={11.5}>
        pesos Pₘ — se leen una vez
      </Etiqueta>

      {filas.map((i) => {
        const y = 44 + (i - 1) * (h + gap);
        return (
          <g key={i}>
            <rect x={x0 + wPesos + 6} y={y} width={wCache} height={h} fill={COLOR.memoria} rx="2" />
            <Etiqueta x={x0 + wPesos + 6 + wCache + 8} y={y + 15} tam={10.5} color={COLOR.suave}>
              caché de la sesión {i} · C·KVₜ
            </Etiqueta>
          </g>
        );
      })}

      <line x1={x0} x2={x0} y1={38} y2={44 + filas.length * (h + gap) - gap + 6} stroke={COLOR.linea} />

      <Etiqueta x={x0} y={182} tam={11} color={COLOR.tinta}>
        Bytes por paso = Pₘ + B·C·KVₜ
      </Etiqueta>
      <Etiqueta x={x0} y={200} tam={11} color={COLOR.suave}>
        Bytes por token útil = Pₘ/B + C·KVₜ  →  el término de los pesos se diluye con B
      </Etiqueta>
      <Etiqueta x={x0} y={218} tam={10.5} color={COLOR.latencia}>
        pero B no puede crecer sin límite: lo acotan la VRAM, el SLO y los Tensor Cores
      </Etiqueta>
    </Marco>
  );
}
