import { describe, expect, it } from "vitest";

import { CHASIS, GPUS, soloGPU } from "./catalogos";
import { capacidad } from "./motor";
import {
  calcular,
  cargaDe,
  dibujable,
  dominadasDe,
  modeloDe,
  unidadesDe,
  unidadesEnCapacidad,
  type Fila,
} from "./resultados";
import { ESTADO_INICIAL, type Estado } from "./urlEstado";

const con = (cambios: Partial<Estado>): Estado => ({ ...ESTADO_INICIAL, ...cambios });

/**
 * Una fila sin su marca de dominada. Qué opciones quedan dominadas depende de con
 * cuáles se compara, así que dos vistas pueden calcular lo mismo y marcar distinto:
 * lo que se compara aquí es el cálculo.
 */
const calculo = (f: Fila): Fila => ({ ...f, dominada: false });

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
    expect(juntas.map(calculo)).toEqual(solas.map(calculo));
  });

  it("un chasis, en cambio, se evalúa con los chasis que salen del redondeo", () => {
    const juntas = calcular(con({ modo: "capacidad", vista: "ambos", G: 12 })).filas.slice(
      GPUS.length,
    );
    // Lo mismo que pedir esos chasis directamente en la vista de chasis.
    const directas = calcular(con({ modo: "capacidad", vista: "chasis", G: 2 })).filas;
    expect(juntas.map((f) => f.unidadesCap)).toEqual(CHASIS.map(() => 2));
    expect(juntas.map(calculo)).toEqual(directas.map(calculo));
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
    expect(juntas.slice(0, GPUS.length).map(calculo)).toEqual(solas.map(calculo));
    juntas.slice(GPUS.length).forEach((f, i) => {
      expect(f.dim).toEqual(chasis[i].dim);
      expect(f.techos).toEqual(chasis[i].techos);
    });
  });
});

describe("opciones dominadas", () => {
  const gpu = (id: string) => GPUS.find((g) => g.id === id)!;
  const h100 = gpu("h100-sxm");
  const h200 = gpu("h200-sxm");
  const a100 = gpu("a100-80");
  const pcie = gpu("h100-pcie");
  /** Una H100 con un precio que ninguna alternativa puede igualar. */
  const h100Cara = { ...h100, precio_hora: 100 };
  const marcadas = (filas: Fila[]) => filas.filter((f) => f.dominada).map((f) => f.gpu.nombre);

  it("al dimensionar, son exactamente las que quedan fuera del frente de Pareto", () => {
    const r = calcular(ESTADO_INICIAL);
    const enFrente = new Set(r.pareto.map((f) => f.gpu.id));
    const candidatas = r.ok.filter(dibujable);
    expect(candidatas.length).toBeGreaterThan(0);
    for (const f of candidatas) {
      expect(f.dominada, f.gpu.nombre).toBe(!enFrente.has(f.gpu.id));
    }
  });

  it("cumple la definición: una opción está dominada si y solo si otra la supera", () => {
    for (const modo of ["dimensionar", "capacidad"] as const) {
      const r = calcular(con({ modo, G: 12 }));
      // Cada modo mide lo suyo: el TPOT que se logra o, al revés, los usuarios que caben.
      const mide = (f: Fila) =>
        modo === "dimensionar"
          ? { costo: f.dim.costo_hora, malo: f.dim.tpot_ms }
          : { costo: f.cap.costo_hora, malo: f.cap.alcanza ? -f.cap.usuarios : Infinity };
      const hay = r.ok.filter((f) => (modo === "dimensionar" ? dibujable(f) : true));
      for (const f of hay) {
        const a = mide(f);
        const superada = hay.some((o) => {
          const b = mide(o);
          return (
            (b.costo < a.costo && b.malo <= a.malo) || (b.costo <= a.costo && b.malo < a.malo)
          );
        });
        expect(f.dominada, `${modo}: ${f.gpu.nombre}`).toBe(superada);
      }
    }
  });

  it("una opción más cara y más lenta que otra queda dominada, y la otra no", () => {
    const r = calcular(con({ vista: "gpus", gpus: [h200, h100Cara] }));
    expect(marcadas(r.filas)).toEqual(["H100 SXM"]);
  });

  it("dos opciones que se compensan —una más barata, otra más rápida— no se dominan", () => {
    // Una H100 muy barata contra una H200 más rápida: ninguna supera a la otra.
    const barata = { ...h100, precio_hora: 0.01 };
    const r = calcular(con({ vista: "gpus", gpus: [h200, barata] }));
    expect(marcadas(r.filas)).toEqual([]);
  });

  it("una opción sola no está dominada", () => {
    expect(marcadas(calcular(con({ vista: "gpus", gpus: [h200] })).filas)).toEqual([]);
  });

  it("las unidades desmarcadas ni se marcan ni marcan a otras", () => {
    const r = calcular(con({ vista: "gpus", gpus: [{ ...h200, on: false }, h100Cara] }));
    expect(marcadas(r.filas)).toEqual([]);
  });

  it("las inviables tampoco entran: no están dominadas ni dominan", () => {
    // A 30 ms la DGX Spark no llega (ver el escenario de arranque), aunque sea gratis.
    const spark = { ...gpu("dgx-spark"), precio_hora: 0 };
    const r = calcular(con({ vista: "gpus", gpus: [h200, spark] }));
    expect(r.filas.find((f) => f.gpu.id === spark.id)!.techos.viable).toBe(false);
    expect(marcadas(r.filas)).toEqual([]);
  });

  it("un número que no se puede comparar no rompe nada y no marca a nadie", () => {
    // Con los TFLOPS en cero el motor devuelve G infinito y TPOT NaN: pasa mientras
    // se reteclea un campo, y no tiene que tumbar la calculadora.
    const sinFlops = { ...h100, tflops: 0 };
    const r = calcular(con({ vista: "gpus", gpus: [h200, sinFlops] }));
    expect(marcadas(r.filas)).toEqual([]);
  });

  it("al medir capacidad se compara el costo con los usuarios que caben", () => {
    const e = con({ modo: "capacidad", vista: "gpus", G: 12, gpus: [h200, h100Cara] });
    const r = calcular(e);
    const [rapida, cara] = r.filas;
    // La H200 admite más usuarios y es más barata: la H100 cara sobra.
    expect(rapida.cap.usuarios).toBeGreaterThan(cara.cap.usuarios);
    expect(marcadas(r.filas)).toEqual(["H100 SXM"]);
  });

  it("al medir capacidad, una opción que no aguanta los agentes cede ante una más barata que sí", () => {
    const r = calcular(con({ modo: "capacidad", vista: "gpus", G: 12, gpus: [a100, pcie] }));
    const [bien, mal] = r.filas;
    // Premisas del escenario de arranque: si cambian los catálogos, esta prueba avisa aquí.
    expect(bien.cap.alcanza).toBe(true);
    expect(mal.cap.alcanza).toBe(false);
    expect(bien.cap.costo_hora).toBeLessThan(mal.cap.costo_hora);
    expect(marcadas(r.filas)).toEqual(["H100 PCIe"]);
  });

  it("el modo no cambia a las demás: con GPUs y chasis juntos, cada una se marca por separado", () => {
    // Solo se comprueba que ambos modos devuelven una marca por fila y que las
    // unidades fuera de la comparación nunca la llevan.
    for (const modo of ["dimensionar", "capacidad"] as const) {
      const apagada = { ...GPUS[0], on: false };
      const r = calcular(con({ modo, gpus: [apagada, ...GPUS.slice(1)] }));
      expect(r.filas).toHaveLength(GPUS.length + CHASIS.length);
      expect(r.filas.find((f) => f.gpu.id === apagada.id)!.dominada).toBe(false);
    }
  });

  it("depende de con qué se compara: un chasis puede ceder ante una GPU suelta", () => {
    const e = con({ modo: "capacidad", G: 12 });
    const juntas = calcular({ ...e, vista: "ambos" }).filas;
    const entreChasis = calcular({ ...e, vista: "chasis", G: 2 }).filas;
    const dgx = (filas: Fila[]) => filas.find((f) => f.gpu.id === "dgx-h100")!;
    const h100 = juntas.find((f) => f.gpu.id === "h100-sxm")!;
    // Premisas del arranque: 12 H100 sueltas dan más usuarios que 2 DGX H100 y cuestan menos.
    expect(h100.cap.usuarios).toBeGreaterThan(dgx(juntas).cap.usuarios);
    expect(h100.cap.costo_hora).toBeLessThan(dgx(juntas).cap.costo_hora);
    expect(dgx(juntas).dominada).toBe(true);
    // Entre chasis solos nadie la supera, porque la que la supera no está en la tabla.
    expect(dgx(entreChasis).dominada).toBe(false);
  });

  it("dominadasDe devuelve ids, uno por opción superada", () => {
    const r = calcular(con({ vista: "gpus", gpus: [h200, h100Cara] }));
    const ids = dominadasDe(
      r.filas.map((f) => ({ ...f, dominada: false })),
      "dimensionar",
    );
    expect([...ids]).toEqual([h100Cara.id]);
  });
});
