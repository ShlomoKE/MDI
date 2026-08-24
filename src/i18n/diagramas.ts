/**
 * Las cadenas de los cuatro diagramas del documento, en los dos idiomas.
 *
 * Viven aparte de `textos.ts` porque no son interfaz: son el texto de unos
 * dibujos —título, pie y cada rótulo dentro del SVG— y solo los usa
 * `Diagramas.tsx`. El patrón es el mismo: `es` primero, `en` obligado a tener
 * exactamente las mismas claves, y si falta una el build falla.
 *
 * La notación matemática —Pₘ, KVₜ, Vₜ, 2·N·10⁹, min(Ceq₁, Ceq₃)— se repite
 * IDÉNTICA en los dos idiomas: son símbolos, no palabras. Que algunas claves se
 * vean duplicadas es a propósito; están aquí para que el componente no se quede
 * con ninguna cadena suelta.
 */

import { useIdioma } from "./contexto";
import type { Idioma } from "./idioma";

const es = {
  // 1. El ciclo de decodificación
  ciclo: {
    titulo: "El tiempo de un token es el máximo entre mover bytes y multiplicar",
    pie: "Generar un token exige leer todos los pesos y, además, el caché de cada secuencia del lote. En paralelo la GPU multiplica. Lo que tarda el paso es el mayor de los dos caminos, no la suma: por eso agregar sesiones es casi gratis hasta que uno de los dos se satura.",
    encabezado: "Un paso de decodificación",
    caminoMemoria: "camino de memoria",
    leerPesos: "leer los pesos · Pₘ / W",
    leerCache: "leer el caché · B·C·KVₜ / W",
    caminoComputo: "camino de cómputo",
    multiplicar: "multiplicar · 2·N·10⁹·B / F",
    tpot: "TPOT",
    tpotMax: "= max(memoria, cómputo)",
    cotaSlo: "el SLO es una cota sobre este máximo: TPOT ≤ SLO",
  },

  // 2. Los tres techos de una GPU
  techos: {
    titulo: "Las tres restricciones acotan cosas distintas",
    pie: "Memoria y latencia acotan bytes de caché; cómputo acota secuencias en el lote. Las tres se evalúan por GPU y la que deja menos espacio es la que fija el total. Cambiar de hardware casi nunca mueve las tres a la vez: más VRAM sube el primer techo pero no el segundo.",
    memoria: "memoria",
    memoriaFormula: "Vₜ − Pₘ − O",
    latencia: "latencia",
    latenciaFormula: "SLO·W − Pₘ",
    computo: "cómputo",
    computoFormula: "SLO·F / 2N·10⁹",
    pesos: "pesos Pₘ",
    overhead: "O",
    cacheCabe: "caché que cabe",
    cachePresupuesto: "caché en el presupuesto",
    fueraSlo: "fuera del SLO",
    secuenciasLote: "secuencias en el lote",
    tensorSaturados: "Tensor Cores saturados",
    cadaBarra: "cada barra es una GPU",
  },

  // 3. Regímenes según el contexto
  regimenes: {
    titulo: "El cuello de botella se mueve con el contexto",
    pie: "Con contextos cortos el caché es despreciable y manda el cómputo: la GPU multiplica todo el día. Al alargar el contexto el caché domina el tráfico y el cuello pasa al techo de bytes más estrecho. Cuál de los dos es —memoria o latencia— no depende del contexto sino del hardware frente al SLO, así que los regímenes son dos, no tres: el salto ocurre en el menor de los dos cruces y el otro queda por detrás sin cambiar nada.",
    pregunta: "¿Qué restricción manda?",
    escala: "contexto promedio por sesión, escala logarítmica",
    computo: "cómputo",
    latenciaOMemoria: "latencia o memoria",
    techoEstrecho: "el techo de bytes más estrecho",
    corte: "min(Ceq₁, Ceq₃)",
    ejeMin: "512 tok",
    ejeMax: "200 000 tok",
    ejeContexto: "contexto C",
  },

  // 4. Por qué el lote sale casi gratis
  lote: {
    titulo: "El lote amortiza la lectura de los pesos",
    pie: "Los pesos se leen una sola vez por paso y sirven para todas las secuencias del lote; el caché, en cambio, se paga por secuencia. De ahí sale toda la economía de la inferencia: la primera sesión cuesta carísima y las siguientes casi nada, hasta que la suma de cachés alcanza a los pesos y el sistema entra en el régimen de memoria.",
    encabezado: "Un lote de 4 secuencias, un solo paso",
    pesosUnaVez: "pesos Pₘ — se leen una vez",
    cacheSesion: (i: number) => `caché de la sesión ${i} · C·KVₜ`,
    bytesPaso: "Bytes por paso = Pₘ + B·C·KVₜ",
    bytesToken: "Bytes por token útil = Pₘ/B + C·KVₜ  →  el término de los pesos se diluye con B",
    limiteB: "pero B no puede crecer sin límite: lo acotan la VRAM, el SLO y los Tensor Cores",
  },
};
// Sin `as const`, igual que en `textos.ts`: lo que hace falta es la forma —qué
// claves hay y de qué tipo—, no congelar cada cadena española en su propio tipo
// literal, porque entonces el inglés no encajaría nunca.

/** El inglés tiene que tener exactamente las mismas claves; TypeScript lo exige. */
type Diagramas = typeof es;

const en: Diagramas = {
  ciclo: {
    titulo: "A token's time is the larger of moving bytes and multiplying",
    pie: "Generating a token requires reading every weight and, on top of that, the cache of every sequence in the batch. In parallel the GPU multiplies. The step takes as long as the longer of the two paths, not their sum: that is why adding sessions is almost free until one of the two saturates.",
    encabezado: "One decode step",
    caminoMemoria: "memory path",
    leerPesos: "read the weights · Pₘ / W",
    leerCache: "read the cache · B·C·KVₜ / W",
    caminoComputo: "compute path",
    multiplicar: "multiply · 2·N·10⁹·B / F",
    tpot: "TPOT",
    tpotMax: "= max(memory, compute)",
    cotaSlo: "the SLO is a bound on that maximum: TPOT ≤ SLO",
  },

  techos: {
    titulo: "The three constraints bound different things",
    pie: "Memory and latency bound cache bytes; compute bounds sequences in the batch. All three are evaluated per GPU, and the one that leaves the least room is the one that sets the total. Changing hardware almost never moves all three at once: more VRAM raises the first ceiling but not the second.",
    memoria: "memory",
    memoriaFormula: "Vₜ − Pₘ − O",
    latencia: "latency",
    latenciaFormula: "SLO·W − Pₘ",
    computo: "compute",
    computoFormula: "SLO·F / 2N·10⁹",
    pesos: "weights Pₘ",
    overhead: "O",
    cacheCabe: "cache that fits",
    cachePresupuesto: "cache within the budget",
    fueraSlo: "outside the SLO",
    secuenciasLote: "sequences in the batch",
    tensorSaturados: "Tensor Cores saturated",
    cadaBarra: "each bar is one GPU",
  },

  regimenes: {
    titulo: "The bottleneck moves with the context",
    pie: "With short contexts the cache is negligible and compute rules: the GPU multiplies all day long. As the context grows the cache dominates the traffic and the bottleneck moves to the tighter byte ceiling. Which of the two it is —memory or latency— does not depend on the context but on the hardware against the SLO, so there are two regimes, not three: the jump happens at the earlier of the two crossovers and the other one sits behind it changing nothing.",
    pregunta: "Which constraint rules?",
    escala: "average context per session, logarithmic scale",
    computo: "compute",
    latenciaOMemoria: "latency or memory",
    techoEstrecho: "the tighter byte ceiling",
    corte: "min(Ceq₁, Ceq₃)",
    ejeMin: "512 tok",
    ejeMax: "200,000 tok",
    ejeContexto: "context C",
  },

  lote: {
    titulo: "The batch amortises reading the weights",
    pie: "The weights are read once per step and serve every sequence in the batch; the cache, by contrast, is paid per sequence. That is where the whole economics of inference comes from: the first session costs a fortune and the ones after it almost nothing, until the sum of the caches catches up with the weights and the system enters the memory regime.",
    encabezado: "A batch of 4 sequences, one single step",
    pesosUnaVez: "weights Pₘ — read once",
    cacheSesion: (i: number) => `cache of session ${i} · C·KVₜ`,
    bytesPaso: "Bytes per step = Pₘ + B·C·KVₜ",
    bytesToken: "Bytes per useful token = Pₘ/B + C·KVₜ  →  the weights term dilutes with B",
    limiteB: "but B cannot grow without bound: the VRAM, the SLO and the Tensor Cores hold it down",
  },
};

export const DIAGRAMAS: Record<Idioma, Diagramas> = { es, en };
export type { Diagramas };

/** Las cadenas de los diagramas en el idioma vigente. */
export function useDiagramas(): Diagramas {
  return DIAGRAMAS[useIdioma()];
}
