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
import { useDiagramas } from "../i18n/diagramas";

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
  const d = useDiagramas();
  const y0 = 46;
  const h = 34;
  const x0 = 24;
  const anchoPesos = 250;
  const anchoCache = 190;

  return (
    <Marco alto={210} titulo={d.ciclo.titulo} pie={d.ciclo.pie}>
      <Etiqueta x={x0} y={26} tam={12} peso={600} color={COLOR.tinta}>
        {d.ciclo.encabezado}
      </Etiqueta>

      {/* camino de memoria */}
      <rect x={x0} y={y0} width={anchoPesos} height={h} fill={COLOR.tinta} rx="3" />
      <Etiqueta x={x0 + anchoPesos / 2} y={y0 + 22} ancla="middle" color={COLOR.superficie} tam={11.5}>
        {d.ciclo.leerPesos}
      </Etiqueta>

      <rect x={x0 + anchoPesos} y={y0} width={anchoCache} height={h} fill={COLOR.memoria} rx="3" />
      <Etiqueta x={x0 + anchoPesos + anchoCache / 2} y={y0 + 22} ancla="middle" color={COLOR.superficie} tam={11.5}>
        {d.ciclo.leerCache}
      </Etiqueta>

      <Etiqueta x={x0} y={y0 - 8} color={COLOR.memoria} peso={600} tam={11}>
        {d.ciclo.caminoMemoria}
      </Etiqueta>

      {/* camino de cómputo */}
      <rect x={x0} y={y0 + 62} width={310} height={h} fill={COLOR.computo} rx="3" />
      <Etiqueta x={x0 + 155} y={y0 + 84} ancla="middle" color={COLOR.superficie} tam={11.5}>
        {d.ciclo.multiplicar}
      </Etiqueta>
      <Etiqueta x={x0} y={y0 + 54} color={COLOR.computo} peso={600} tam={11}>
        {d.ciclo.caminoComputo}
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
        {d.ciclo.tpot}
      </Etiqueta>
      <Etiqueta x={x0 + anchoPesos + anchoCache + 8} y={y0 + 68} color={COLOR.suave} tam={10} mono>
        {d.ciclo.tpotMax}
      </Etiqueta>

      {/* el SLO */}
      <line x1={x0} x2={616} y1={186} y2={186} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0} y={180} color={COLOR.suave} tam={10}>
        {d.ciclo.cotaSlo}
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 2. Los tres techos de una GPU
// --------------------------------------------------------------------------- //

export function DiagramaTechos() {
  const d = useDiagramas();
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
    <Marco alto={230} titulo={d.techos.titulo} pie={d.techos.pie}>
      <Etiqueta x={20} y={44} tam={11} peso={600} color={COLOR.memoria}>
        {d.techos.memoria}
      </Etiqueta>
      <Etiqueta x={20} y={58} tam={10} color={COLOR.suave}>
        {d.techos.memoriaFormula}
      </Etiqueta>
      {barra(30, [
        { frac: 0.32, color: COLOR.tinta, texto: d.techos.pesos },
        { frac: 0.09, color: COLOR.suave, texto: d.techos.overhead },
        { frac: 0.59, color: COLOR.memoria, texto: d.techos.cacheCabe },
      ])}

      <Etiqueta x={20} y={114} tam={11} peso={600} color={COLOR.latencia}>
        {d.techos.latencia}
      </Etiqueta>
      <Etiqueta x={20} y={128} tam={10} color={COLOR.suave}>
        {d.techos.latenciaFormula}
      </Etiqueta>
      {barra(100, [
        { frac: 0.32, color: COLOR.tinta, texto: d.techos.pesos },
        { frac: 0.34, color: COLOR.latencia, texto: d.techos.cachePresupuesto },
        { frac: 0.34, color: COLOR.latenciaTenue, texto: d.techos.fueraSlo, claro: true },
      ])}

      <Etiqueta x={20} y={184} tam={11} peso={600} color={COLOR.computo}>
        {d.techos.computo}
      </Etiqueta>
      <Etiqueta x={20} y={198} tam={10} color={COLOR.suave}>
        {d.techos.computoFormula}
      </Etiqueta>
      {barra(170, [
        { frac: 0.55, color: COLOR.computo, texto: d.techos.secuenciasLote },
        { frac: 0.45, color: COLOR.computoTenue, texto: d.techos.tensorSaturados, claro: true },
      ])}

      <line x1={x0} x2={x0} y1={22} y2={210} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0 + ancho} y={222} ancla="end" tam={10} color={COLOR.suave}>
        {d.techos.cadaBarra}
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 3. Regímenes según el contexto
// --------------------------------------------------------------------------- //

export function DiagramaRegimenes() {
  const d = useDiagramas();
  const x0 = 60;
  const x1 = 600;
  const y = 96;
  const h = 42;
  // Un solo corte, no dos: el salto ocurre en min(Ceq₁, Ceq₃) y ahí termina el
  // régimen de cómputo.
  const corte = x0 + (x1 - x0) * 0.42;

  return (
    <Marco alto={212} titulo={d.regimenes.titulo} pie={d.regimenes.pie}>
      <Etiqueta x={x0} y={40} tam={12} peso={600} color={COLOR.tinta}>
        {d.regimenes.pregunta}
      </Etiqueta>
      <Etiqueta x={x0} y={58} tam={10.5} color={COLOR.suave}>
        {d.regimenes.escala}
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
        {d.regimenes.computo}
      </Etiqueta>
      <Etiqueta x={(corte + x1) / 2} y={y + 21} ancla="middle" color={COLOR.latencia} peso={600} tam={12}>
        {d.regimenes.latenciaOMemoria}
      </Etiqueta>
      <Etiqueta x={(corte + x1) / 2} y={y + 35} ancla="middle" color={COLOR.suave} tam={10}>
        {d.regimenes.techoEstrecho}
      </Etiqueta>

      <line x1={corte} x2={corte} y1={y - 12} y2={y + h + 12} stroke={COLOR.tinta} strokeWidth="1.5" />
      <Etiqueta x={corte} y={y - 18} ancla="middle" color={COLOR.tinta} peso={600} tam={11} mono>
        {d.regimenes.corte}
      </Etiqueta>

      <line x1={x0} x2={x1} y1={y + h + 22} y2={y + h + 22} stroke={COLOR.linea} strokeWidth="1" />
      <Etiqueta x={x0} y={y + h + 38} tam={10} color={COLOR.suave} mono>
        {d.regimenes.ejeMin}
      </Etiqueta>
      <Etiqueta x={x1} y={y + h + 38} ancla="end" tam={10} color={COLOR.suave} mono>
        {d.regimenes.ejeMax}
      </Etiqueta>
      <Etiqueta x={(x0 + x1) / 2} y={y + h + 38} ancla="middle" tam={10} color={COLOR.suave}>
        {d.regimenes.ejeContexto}
      </Etiqueta>
    </Marco>
  );
}

// --------------------------------------------------------------------------- //
// 4. Por qué el lote sale casi gratis
// --------------------------------------------------------------------------- //

export function DiagramaLote() {
  const d = useDiagramas();
  const filas = [1, 2, 3, 4];
  const x0 = 40;
  const wPesos = 240;
  const wCache = 42;
  const h = 22;
  const gap = 9;

  return (
    <Marco alto={228} titulo={d.lote.titulo} pie={d.lote.pie}>
      <Etiqueta x={x0} y={26} tam={12} peso={600} color={COLOR.tinta}>
        {d.lote.encabezado}
      </Etiqueta>

      <rect x={x0} y={44} width={wPesos} height={filas.length * (h + gap) - gap} fill={COLOR.tinta} rx="3" />
      <Etiqueta x={x0 + wPesos / 2} y={44 + (filas.length * (h + gap) - gap) / 2 + 4} ancla="middle" color={COLOR.superficie} tam={11.5}>
        {d.lote.pesosUnaVez}
      </Etiqueta>

      {filas.map((i) => {
        const y = 44 + (i - 1) * (h + gap);
        return (
          <g key={i}>
            <rect x={x0 + wPesos + 6} y={y} width={wCache} height={h} fill={COLOR.memoria} rx="2" />
            <Etiqueta x={x0 + wPesos + 6 + wCache + 8} y={y + 15} tam={10.5} color={COLOR.suave}>
              {d.lote.cacheSesion(i)}
            </Etiqueta>
          </g>
        );
      })}

      <line x1={x0} x2={x0} y1={38} y2={44 + filas.length * (h + gap) - gap + 6} stroke={COLOR.linea} />

      <Etiqueta x={x0} y={182} tam={11} color={COLOR.tinta}>
        {d.lote.bytesPaso}
      </Etiqueta>
      <Etiqueta x={x0} y={200} tam={11} color={COLOR.suave}>
        {d.lote.bytesToken}
      </Etiqueta>
      <Etiqueta x={x0} y={218} tam={10.5} color={COLOR.latencia}>
        {d.lote.limiteB}
      </Etiqueta>
    </Marco>
  );
}
