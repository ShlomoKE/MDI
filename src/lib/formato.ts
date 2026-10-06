/**
 * Capa de presentación: aquí y solo aquí se sale de las unidades SI.
 *
 * El motor trabaja en bytes, bytes/s, FLOP/s y segundos. Todo lo que el usuario
 * ve en GB, KB, ms o USD pasa por estas funciones.
 */

import { GB, type Cuello, type GPU } from "./motor";

const LOCALE = "es-MX";

/** Número con separador de miles; "—" para lo que no existe. */
export function fmt(n: number | null | undefined, d = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Igual que fmt, pero abrevia lo que ya no cabe en una celda. */
export function fmtCorto(n: number | null | undefined, d = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return fmt(n / 1e9, 1) + " MM";
  if (abs >= 1e6) return fmt(n / 1e6, 1) + " M";
  if (abs >= 1e5) return fmt(n / 1e3, 0) + " k";
  return fmt(n, d);
}

/** bytes → GB */
export const enGB = (bytes: number, d = 1): string => fmt(bytes / GB, d);

/** bytes → KB */
export const enKB = (bytes: number, d = 0): string => fmt(bytes / 1024, d);

/** segundos → ms */
export const enMs = (segundos: number, d = 1): string => fmt(segundos * 1000, d);

export const usd = (n: number, d = 2): string =>
  Number.isFinite(n) ? "$" + fmt(n, d) : "—";

/**
 * GB de VRAM tal como se escriben en la tabla: sin decimales de más y con
 * separador de miles solo desde 1000, para que una GPU de 80 GB siga diciendo
 * «80» y un chasis de 8 diga «640» o «1,440».
 */
export const fmtGB = (v: number): string => {
  if (!Number.isFinite(v)) return "—";
  const limpio = Number(v.toPrecision(10));
  return Math.abs(limpio) >= 1000 ? fmt(limpio, limpio % 1 === 0 ? 0 : 1) : String(limpio);
};

// Lo que la unidad ENTERA aporta, en las unidades de la tabla. Una GPU suelta
// (n=1) da exactamente sus propias cifras; un chasis, las de sus n GPUs juntas.

/** VRAM de la unidad entera, en GB. */
export const vramDe = (g: GPU): number => g.n * g.vram_gb;

/** Ancho de banda nominal de la unidad entera, en GB/s. */
export const bwNominalDe = (g: GPU): number => g.n * g.bw_gbs;

/** Ancho de banda efectivo de la unidad entera, en GB/s: el W del motor. */
export const bwEfectivoDe = (g: GPU): number => g.n * g.bw_gbs * g.eff * g.escala;

/** Las clases de Tailwind por restricción, para no repetir el mapeo. */
export const CLASE_CUELLO: Record<Cuello, { texto: string; fondo: string; borde: string }> = {
  memoria: { texto: "text-mem", fondo: "bg-mem-tenue", borde: "border-mem" },
  latencia: { texto: "text-lat", fondo: "bg-lat-tenue", borde: "border-lat" },
  computo: { texto: "text-comp", fondo: "bg-comp-tenue", borde: "border-comp" },
};

/**
 * Los mismos colores, en hex, para lo que se dibuja en SVG —donde las clases de
 * Tailwind no sirven porque `fill` y `stroke` piden un valor literal—.
 *
 * Estos valores tienen que coincidir con los tokens de `@theme` en index.css.
 * Como no hay forma de que el CSS y el TypeScript compartan una sola fuente,
 * `formato.test.ts` lee index.css y falla si alguno se desincroniza.
 */
export const COLOR = {
  fondo: "#f1f3f2",
  superficie: "#ffffff",
  tinta: "#111815",
  suave: "#5c6863",
  linea: "#d3dad7",
  memoria: "#1f5f4c",
  latencia: "#ac411d",
  computo: "#4a4e8c",
  memoriaTenue: "#dce9e4",
  latenciaTenue: "#f6e2d8",
  computoTenue: "#e0e1ef",
} as const;

export const colorCuello = (k: Cuello | "" | null): string =>
  k === "memoria"
    ? COLOR.memoria
    : k === "latencia"
      ? COLOR.latencia
      : k === "computo"
        ? COLOR.computo
        : COLOR.suave;

/** Plural español para los rótulos que cuentan unidades. */
export const plural = (n: number, uno: string, varios: string): string =>
  n === 1 ? uno : varios;
