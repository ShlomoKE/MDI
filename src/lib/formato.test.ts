import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { COLOR, fmt, fmtCorto, enGB, enKB, nombreCuello, plural, usd } from "./formato";

/**
 * La paleta vive dos veces: como tokens de `@theme` en index.css —de donde
 * Tailwind saca las clases— y como literales hex en COLOR, porque `fill` y
 * `stroke` de SVG necesitan un valor concreto. No hay forma de compartir una
 * sola fuente entre CSS y TypeScript, así que esta prueba ata las dos: si una
 * se mueve sin la otra, falla.
 */
describe("la paleta de SVG coincide con los tokens de CSS", () => {
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

  const token = (nombre: string): string => {
    const m = css.match(new RegExp("--color-" + nombre + ":\s*([^;]+);"));
    if (!m) throw new Error("falta el token --color-" + nombre + " en index.css");
    return m[1].trim().toLowerCase();
  };

  const pares: Array<[keyof typeof COLOR, string]> = [
    ["fondo", "fondo"],
    ["superficie", "superficie"],
    ["tinta", "tinta"],
    ["suave", "suave"],
    ["linea", "linea"],
    ["memoria", "mem"],
    ["latencia", "lat"],
    ["computo", "comp"],
    ["memoriaTenue", "mem-tenue"],
    ["latenciaTenue", "lat-tenue"],
    ["computoTenue", "comp-tenue"],
  ];

  for (const [clave, nombre] of pares) {
    it(`COLOR.${clave} === --color-${nombre}`, () => {
      expect(COLOR[clave].toLowerCase()).toBe(token(nombre));
    });
  }
});

describe("contraste mínimo de la paleta", () => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const contraste = (a: string, b: string) => {
    const [l1, l2] = [L(a), L(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  // Texto normal en WCAG AA: 4.5:1. La interfaz usa mucho 12 px, que cuenta
  // como texto normal, así que no hay excepción de "texto grande" que valga.
  const AA = 4.5;

  it("el gris de apoyo llega a AA sobre los dos fondos base", () => {
    expect(contraste(COLOR.suave, COLOR.superficie)).toBeGreaterThanOrEqual(AA);
    expect(contraste(COLOR.suave, COLOR.fondo)).toBeGreaterThanOrEqual(AA);
  });

  it("cada color de restricción llega a AA sobre su propio fondo tenue", () => {
    expect(contraste(COLOR.memoria, COLOR.memoriaTenue)).toBeGreaterThanOrEqual(AA);
    expect(contraste(COLOR.latencia, COLOR.latenciaTenue)).toBeGreaterThanOrEqual(AA);
    expect(contraste(COLOR.computo, COLOR.computoTenue)).toBeGreaterThanOrEqual(AA);
  });

  it("los tres colores de restricción llegan a AA sobre superficie y fondo", () => {
    for (const c of [COLOR.memoria, COLOR.latencia, COLOR.computo]) {
      expect(contraste(c, COLOR.superficie)).toBeGreaterThanOrEqual(AA);
      expect(contraste(c, COLOR.fondo)).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe("formato de presentación", () => {
  it("lo que no existe se muestra como raya, no como NaN ni Infinity", () => {
    for (const v of [NaN, Infinity, -Infinity, null, undefined]) {
      expect(fmt(v as number)).toBe("—");
      expect(fmtCorto(v as number)).toBe("—");
    }
    expect(usd(NaN)).toBe("—");
    expect(nombreCuello(null)).toBe("—");
  });

  it("las conversiones de unidad salen de SI y solo aquí", () => {
    expect(enGB(27 * 1024 ** 3)).toBe("27.0");
    expect(enKB(32768)).toBe("32");
  });

  it("fmtCorto abrevia lo que no cabe en una celda", () => {
    expect(fmtCorto(1234)).toBe(fmt(1234));
    expect(fmtCorto(150000)).toBe("150 k");
    expect(fmtCorto(2500000)).toBe("2.5 M");
    expect(fmtCorto(3200000000)).toBe("3.2 MM");
  });

  it("el plural concuerda", () => {
    expect(plural(1, "GPU", "GPUs")).toBe("GPU");
    expect(plural(3, "GPU", "GPUs")).toBe("GPUs");
  });
});
