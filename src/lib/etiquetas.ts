/**
 * Dónde poner la etiqueta de cada punto de una gráfica para que no se pisen.
 *
 * Con siete GPUs sueltas bastaba con escribir cada nombre encima de su punto. Con
 * GPUs y chasis juntos hay nueve o doce puntos, varios casi en el mismo sitio, y
 * los nombres se montaban unos sobre otros. Hay dos acomodos, según cómo caen los
 * puntos:
 *
 * - `colocarEtiquetas`, para una nube. Se prueba, para cada punto, una lista corta
 *   de posiciones —arriba, a la derecha, a la izquierda, abajo y las diagonales— y
 *   se queda con la primera que no pisa ningún marcador ni ninguna etiqueta ya
 *   colocada. Es un algoritmo voraz, no óptimo: alcanza para decenas de puntos y
 *   da siempre el mismo resultado para la misma entrada.
 * - `repartirEnColumna`, para puntos que caen sobre una misma vertical, donde no
 *   hay a dónde apartar un nombre en horizontal: se apilan en una columna.
 */

export interface PuntoParaEtiqueta {
  id: string;
  /** El centro del marcador, en unidades del SVG. */
  x: number;
  y: number;
  /** El ancho estimado del texto, en las mismas unidades. */
  ancho: number;
}

export type Ancla = "start" | "middle" | "end";

export interface PosicionEtiqueta {
  /** El punto de anclaje del texto: su línea base y el extremo que dice `ancla`. */
  x: number;
  y: number;
  ancla: Ancla;
}

export interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** El radio que se reserva a cada marcador: el mayor, el que toma al enfocarlo. */
const RADIO = 8;
/** Lo que el texto de 10 px sube por encima de su línea base y lo que baja por debajo. */
const SUBE = 8.5;
const BAJA = 2.5;
/** Aire entre dos cajas para que no se toquen. */
const MARGEN = 1.5;
/** Distancia del centro del marcador a la línea base de su etiqueta: la de siempre, 12. */
const SEPARACION = RADIO + 4;

/** Un texto de 10 px mide, de media, algo menos de 6 unidades por carácter. */
export const anchoDeTexto = (texto: string): number => texto.length * 6;

const cajaDe = (p: PosicionEtiqueta, ancho: number): Caja => {
  const x0 = p.ancla === "start" ? p.x : p.ancla === "end" ? p.x - ancho : p.x - ancho / 2;
  return { x0, x1: x0 + ancho, y0: p.y - SUBE, y1: p.y + BAJA };
};

/** El área en la que se pisan dos cajas, ensanchadas por el margen. */
const solape = (a: Caja, b: Caja): number => {
  const ancho = Math.min(a.x1 + MARGEN, b.x1 + MARGEN) - Math.max(a.x0 - MARGEN, b.x0 - MARGEN);
  const alto = Math.min(a.y1 + MARGEN, b.y1 + MARGEN) - Math.max(a.y0 - MARGEN, b.y0 - MARGEN);
  return ancho > 0 && alto > 0 ? ancho * alto : 0;
};

/** Las posiciones que se prueban para un punto, de la más a la menos preferida. */
function candidatas(p: PuntoParaEtiqueta): PosicionEtiqueta[] {
  const d = SEPARACION;
  const lado = d * 0.7;
  const abajo = d + SUBE;
  const lista: PosicionEtiqueta[] = [
    { x: p.x, y: p.y - d, ancla: "middle" },
    { x: p.x + d, y: p.y + 3.5, ancla: "start" },
    { x: p.x - d, y: p.y + 3.5, ancla: "end" },
    { x: p.x, y: p.y + abajo, ancla: "middle" },
    { x: p.x + lado, y: p.y - d, ancla: "start" },
    { x: p.x - lado, y: p.y - d, ancla: "end" },
    { x: p.x + lado, y: p.y + abajo, ancla: "start" },
    { x: p.x - lado, y: p.y + abajo, ancla: "end" },
  ];
  // Una segunda vuelta, más lejos, para cuando la primera está llena.
  for (const extra of [14, 28]) {
    lista.push(
      { x: p.x, y: p.y - d - extra, ancla: "middle" },
      { x: p.x, y: p.y + abajo + extra, ancla: "middle" },
      { x: p.x + d + extra, y: p.y + 3.5, ancla: "start" },
      { x: p.x - d - extra, y: p.y + 3.5, ancla: "end" },
    );
  }
  return lista;
}

/**
 * Elige la posición de cada etiqueta.
 *
 * `limites` es la caja en la que tienen que caber los textos; `fijos`, las cajas
 * de otros textos de la gráfica (la leyenda del SLO, la de los agentes) que
 * tampoco se deben pisar. Si ninguna posición queda libre, se elige la que menos
 * se pisa: el texto se lee peor, pero no desaparece.
 */
export function colocarEtiquetas(
  puntos: PuntoParaEtiqueta[],
  limites: Caja,
  fijos: Caja[] = [],
): Map<string, PosicionEtiqueta> {
  const marcadores: Caja[] = puntos.map((p) => ({
    x0: p.x - RADIO,
    y0: p.y - RADIO,
    x1: p.x + RADIO,
    y1: p.y + RADIO,
  }));
  const ocupadas: Caja[] = [...fijos];
  const resultado = new Map<string, PosicionEtiqueta>();

  for (const [i, p] of puntos.entries()) {
    let mejor: PosicionEtiqueta | null = null;
    let menorSolape = Infinity;

    for (const c of candidatas(p)) {
      const caja = cajaDe(c, p.ancho);
      const dentro =
        caja.x0 >= limites.x0 && caja.x1 <= limites.x1 && caja.y0 >= limites.y0 && caja.y1 <= limites.y1;
      if (!dentro) continue;

      // El marcador propio no cuenta: todas las posiciones nacen fuera de él.
      let pisa = 0;
      for (const [j, o] of marcadores.entries()) if (j !== i) pisa += solape(caja, o);
      for (const o of ocupadas) pisa += solape(caja, o);
      if (pisa === 0) {
        mejor = c;
        menorSolape = 0;
        break;
      }
      if (pisa < menorSolape) {
        mejor = c;
        menorSolape = pisa;
      }
    }

    // Ninguna posición cabía en los límites (un punto pegado a una esquina con un
    // nombre largo): se vuelve a la de siempre, encima del punto.
    const elegida = mejor ?? { x: p.x, y: p.y - SEPARACION, ancla: "middle" as const };
    resultado.set(p.id, elegida);
    ocupadas.push(cajaDe(elegida, p.ancho));
  }
  return resultado;
}

/**
 * Reparte en vertical las etiquetas de una columna para que no se pisen, moviendo
 * cada una lo menos posible.
 *
 * Es el caso de la frontera de capacidad: todos los puntos de operación caen sobre
 * la misma recta de agentes, así que no hay a dónde apartar un nombre en horizontal
 * y lo que cabe es apilarlos. Se busca la posición que dista menos, en suma de
 * cuadrados, de la deseada, con el orden conservado y una separación mínima entre
 * vecinas: una regresión isotónica sobre las posiciones restando `i·separación`,
 * que se resuelve fusionando bloques vecinos que se pisan (PAV). Un grupo apretado
 * se abre alrededor de su centro en vez de empujarlo todo hacia un lado.
 *
 * `min` y `max` acotan la línea base de la primera y de la última. Si no caben
 * todas con la separación pedida, esta se acorta para que quepan.
 */
export function repartirEnColumna(
  deseadas: Array<{ id: string; y: number }>,
  min: number,
  max: number,
  separacion = 13,
): Map<string, number> {
  const orden = deseadas
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.y - b.y || a.i - b.i);
  const n = orden.length;
  const resultado = new Map<string, number>();
  if (n === 0) return resultado;

  const sep = n > 1 ? Math.max(0, Math.min(separacion, (max - min) / (n - 1))) : separacion;

  // Con t_i = y_i − i·sep, "al menos sep de separación" es "no decreciente".
  const bloques: Array<{ suma: number; cuenta: number }> = [];
  orden.forEach((d, i) => {
    bloques.push({ suma: d.y - i * sep, cuenta: 1 });
    while (bloques.length > 1) {
      const b = bloques[bloques.length - 1];
      const a = bloques[bloques.length - 2];
      if (a.suma / a.cuenta <= b.suma / b.cuenta) break;
      bloques.splice(bloques.length - 2, 2, { suma: a.suma + b.suma, cuenta: a.cuenta + b.cuenta });
    }
  });

  // El tope inferior de la primera y el superior de la última, restado el escalón.
  const piso = min;
  const techo = max - (n - 1) * sep;
  let k = 0;
  for (const b of bloques) {
    const u = Math.min(techo, Math.max(piso, b.suma / b.cuenta));
    for (let j = 0; j < b.cuenta; j++, k++) resultado.set(orden[k].id, u + k * sep);
  }
  return resultado;
}

/** La caja de un texto suelto, para pasarla como `fijos`. */
export const cajaDeTexto = (x: number, y: number, ancho: number, ancla: Ancla = "start"): Caja =>
  cajaDe({ x, y, ancla }, ancho);
