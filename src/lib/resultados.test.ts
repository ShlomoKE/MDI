import { describe, expect, it } from "vitest";

import { CHASIS, GPUS, soloGPU } from "./catalogos";
import { capacidad } from "./motor";
import { calcular, cargaDe, modeloDe, unidadesDe, unidadesEnCapacidad } from "./resultados";
import { ESTADO_INICIAL, type Estado } from "./urlEstado";

const con = (cambios: Partial<Estado>): Estado => ({ ...ESTADO_INICIAL, ...cambios });

describe("la vista por defecto", () => {
  it("arranca comparando GPUs y chasis juntos, en el orden del catálogo", () => {
    expect(ESTADO_INICIAL.vista).toBe("ambos");
    expect(unidadesDe(ESTADO_INICIAL).map((g) => g.id)).toEqual(
      [...GPUS, ...CHASIS].map((g) => g.id),
    );
    expect(calcular(ESTADO_INICIAL).filas).toHaveLength(GPUS.length + CHASIS.length);
  });

  it("cada vista lista solo lo suyo", () => {
    expect(unidadesDe(con({ vista: "gpus" }))).toEqual(GPUS);
    expect(unidadesDe(con({ vista: "chasis" }))).toEqual(CHASIS);
  });
});

describe("unidades en el modo capacidad", () => {
  const dgx = CHASIS[0]; // 8 GPUs
  const h100 = GPUS[0];

  it("con GPUs y chasis juntos, G cuenta GPUs y el chasis se redondea hacia arriba", () => {
    const e = (G: number) => con({ vista: "ambos", G });
    expect(unidadesEnCapacidad(e(12), h100)).toBe(12);
    expect(unidadesEnCapacidad(e(12), dgx)).toBe(2); // 16 GPUs: las 12 pedidas, enteras
    expect(unidadesEnCapacidad(e(16), dgx)).toBe(2); // justo dos chasis
    expect(unidadesEnCapacidad(e(17), dgx)).toBe(3);
    expect(unidadesEnCapacidad(e(1), dgx)).toBe(1); // nunca cero unidades
  });

  it("con una sola clase de hardware no hay redondeo: G cuenta unidades", () => {
    expect(unidadesEnCapacidad(con({ vista: "gpus", G: 12 }), h100)).toBe(12);
    expect(unidadesEnCapacidad(con({ vista: "chasis", G: 12 }), dgx)).toBe(12);
  });

  it("una GPU suelta se evalúa igual en cualquier vista que la incluya", () => {
    const solas = calcular(con({ modo: "capacidad", vista: "gpus", G: 12 })).filas;
    const juntas = calcular(con({ modo: "capacidad", vista: "ambos", G: 12 })).filas.slice(
      0,
      GPUS.length,
    );
    expect(juntas).toEqual(solas);
  });

  it("un chasis, en cambio, se evalúa con los chasis que salen del redondeo", () => {
    const juntas = calcular(con({ modo: "capacidad", vista: "ambos", G: 12 })).filas.slice(
      GPUS.length,
    );
    // Lo mismo que pedir esos chasis directamente en la vista de chasis.
    const directas = calcular(con({ modo: "capacidad", vista: "chasis", G: 2 })).filas;
    expect(juntas.map((f) => f.unidadesCap)).toEqual(CHASIS.map(() => 2));
    expect(juntas).toEqual(directas);
  });

  it("lo que dice la fila es lo que calcula el motor con esas unidades", () => {
    const e = con({ modo: "capacidad", vista: "ambos", G: 12 });
    const fila = calcular(e).filas.find((f) => f.gpu.id === dgx.id)!;
    const esperado = capacidad(modeloDe(e), fila.hw, cargaDe(e), 2);
    expect(fila.unidadesCap).toBe(2);
    expect(fila.cap).toEqual(esperado);
    expect(fila.hw).toEqual({ ...soloGPU(dgx), eff: e.eff });
    // Y el costo es el de dos chasis, no el de doce.
    expect(fila.cap.costo_hora).toBeCloseTo(2 * dgx.precio_hora, 10);
  });

  it("un chasis de más GPUs que las pedidas cuesta más: la comparación de costo sigue a la vista", () => {
    const filas = calcular(con({ modo: "capacidad", vista: "ambos", G: 12 })).filas;
    const h100 = filas.find((f) => f.gpu.id === GPUS[0].id)!;
    const chasis = filas.find((f) => f.gpu.id === dgx.id)!;
    expect(h100.cap.costo_hora).toBeCloseTo(12 * GPUS[0].precio_hora, 10);
    expect(chasis.cap.costo_hora).toBeGreaterThan(h100.cap.costo_hora);
  });
});

describe("dimensionar no depende de qué se compara", () => {
  it("la fila de una unidad es la misma en su vista que en la de ambos", () => {
    const base = { modo: "dimensionar" as const };
    const solas = calcular(con({ ...base, vista: "gpus" })).filas;
    const chasis = calcular(con({ ...base, vista: "chasis" })).filas;
    const juntas = calcular(con({ ...base, vista: "ambos" })).filas;
    // Las GPUs son idénticas fila por fila, y los chasis también en lo que dimensiona.
    expect(juntas.slice(0, GPUS.length)).toEqual(solas);
    juntas.slice(GPUS.length).forEach((f, i) => {
      expect(f.dim).toEqual(chasis[i].dim);
      expect(f.techos).toEqual(chasis[i].techos);
    });
  });
});
