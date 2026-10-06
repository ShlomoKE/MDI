import { describe, expect, it } from "vitest";

import {
  anchoDeTexto,
  cajaDeTexto,
  colocarEtiquetas,
  repartirEnColumna,
  type Caja,
  type PuntoParaEtiqueta,
} from "./etiquetas";

/** El mismo recuadro de la gráfica de costo: 640×340 con sus márgenes. */
const LIMITES: Caja = { x0: 68, y0: 18, x1: 636, y1: 273 };

const punto = (id: string, x: number, y: number, nombre = id): PuntoParaEtiqueta => ({
  id,
  x,
  y,
  ancho: anchoDeTexto(nombre),
});

const pisa = (a: Caja, b: Caja): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Todas las etiquetas colocadas, como cajas, junto con el marcador de cada punto. */
function cajas(puntos: PuntoParaEtiqueta[], pos: ReturnType<typeof colocarEtiquetas>) {
  const etiquetas = puntos.map((p) => {
    const e = pos.get(p.id)!;
    return { id: p.id, caja: cajaDeTexto(e.x, e.y, p.ancho, e.ancla) };
  });
  const marcadores = puntos.map((p) => ({
    id: p.id,
    caja: { x0: p.x - 5.5, y0: p.y - 5.5, x1: p.x + 5.5, y1: p.y + 5.5 },
  }));
  return { etiquetas, marcadores };
}

/** Comprueba que ninguna etiqueta pisa a otra ni a ningún marcador, y que cabe en los límites. */
function sinPisarse(puntos: PuntoParaEtiqueta[], limites: Caja, fijos: Caja[] = []) {
  const pos = colocarEtiquetas(puntos, limites, fijos);
  expect(pos.size).toBe(puntos.length);
  const { etiquetas, marcadores } = cajas(puntos, pos);
  etiquetas.forEach((a, i) => {
    expect(a.caja.x0, `${a.id} se sale por la izquierda`).toBeGreaterThanOrEqual(limites.x0);
    expect(a.caja.x1, `${a.id} se sale por la derecha`).toBeLessThanOrEqual(limites.x1);
    expect(a.caja.y0, `${a.id} se sale por arriba`).toBeGreaterThanOrEqual(limites.y0);
    expect(a.caja.y1, `${a.id} se sale por abajo`).toBeLessThanOrEqual(limites.y1);
    for (const m of marcadores) expect(pisa(a.caja, m.caja), `${a.id} pisa el punto ${m.id}`).toBe(false);
    for (const f of fijos) expect(pisa(a.caja, f), `${a.id} pisa un texto fijo`).toBe(false);
    for (const b of etiquetas.slice(i + 1)) {
      expect(pisa(a.caja, b.caja), `${a.id} pisa a ${b.id}`).toBe(false);
    }
  });
  return pos;
}

describe("acomodo de etiquetas", () => {
  it("un punto suelto lleva su nombre encima, como siempre", () => {
    const p = punto("a", 300, 150, "H100 SXM");
    const e = colocarEtiquetas([p], LIMITES).get("a")!;
    expect(e.ancla).toBe("middle");
    expect(e.x).toBe(300);
    expect(e.y).toBeLessThan(150);
  });

  it("puntos lejanos no se mueven de su sitio habitual", () => {
    const puntos = [punto("a", 120, 200), punto("b", 320, 120), punto("c", 520, 60)];
    const pos = sinPisarse(puntos, LIMITES);
    for (const p of puntos) expect(pos.get(p.id)!.ancla).toBe("middle");
  });

  it("dos puntos casi encimados reparten sus nombres sin pisarse", () => {
    sinPisarse(
      [punto("a", 300, 150, "DGX B200"), punto("b", 304, 154, "DGX B300")],
      LIMITES,
    );
  });

  it("los nueve puntos del arranque, sobre una misma vertical, se leen todos", () => {
    // Las ordenadas del modo capacidad con GPUs y chasis: la recta de los agentes
    // fijados reúne a todos los puntos en la misma x.
    const ys = [60, 150, 160, 168, 175, 190, 205, 255, 258];
    const nombres = [
      "H200 SXM", "DGX B200", "DGX H200", "DGX B300", "H100 SXM",
      "DGX H100", "MI300X x8", "A100 80GB", "H100 PCIe",
    ];
    sinPisarse(ys.map((y, i) => punto(`p${i}`, 300, y, nombres[i])), LIMITES);
  });

  it("los nueve puntos de la gráfica de costo, en racimo, se leen todos", () => {
    const xy: Array<[number, number]> = [
      [447, 180], [433, 190], [454, 200], [458, 169], [527, 232],
      [498, 246], [613, 54], [618, 188], [670 - 60, 240],
    ];
    const nombres = [
      "DGX H200", "DGX B200", "DGX H100", "DGX B300", "H200 SXM",
      "MI300X x8", "H100 PCIe", "A100 80GB", "H100 SXM",
    ];
    sinPisarse(xy.map(([x, y], i) => punto(`p${i}`, x, y, nombres[i])), LIMITES);
  });

  it("respeta los textos fijos de la gráfica, como la leyenda del SLO", () => {
    const slo = cajaDeTexto(305, 36, anchoDeTexto("SLO 30 ms"));
    // Un punto justo debajo del texto: la posición habitual, encima, lo pisaría.
    sinPisarse([punto("a", 330, 52, "H100 PCIe")], LIMITES, [slo]);
  });

  it("no saca ninguna etiqueta del recuadro, ni con puntos en las esquinas", () => {
    sinPisarse(
      [
        punto("izq-arriba", 70, 20, "DGX Spark"),
        punto("der-arriba", 634, 20, "RTX 6000 Ada"),
        punto("izq-abajo", 70, 272, "L40S"),
        punto("der-abajo", 634, 272, "H100 PCIe"),
      ],
      LIMITES,
    );
  });

  it("da siempre el mismo resultado para la misma entrada", () => {
    const puntos = [0, 1, 2, 3, 4, 5].map((i) => punto(`p${i}`, 300 + i * 3, 150 + i * 4));
    const a = colocarEtiquetas(puntos, LIMITES);
    const b = colocarEtiquetas(puntos, LIMITES);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("si no cabe nada, deja la etiqueta encima del punto en vez de perderla", () => {
    const e = colocarEtiquetas([punto("a", 300, 150, "un nombre largo")], {
      x0: 299,
      y0: 149,
      x1: 301,
      y1: 151,
    }).get("a")!;
    expect(e).toEqual({ x: 300, y: 150 - 12, ancla: "middle" });
  });

  it("con un racimo imposible igual coloca todos los puntos", () => {
    const racimo = Array.from({ length: 14 }, (_, i) => punto(`p${i}`, 300, 150 + (i % 3), "DGX B300"));
    const pos = colocarEtiquetas(racimo, LIMITES);
    expect(pos.size).toBe(14);
  });
});

describe("etiquetas en columna", () => {
  const pedir = (ys: number[], min = 0, max = 300, sep = 13) =>
    repartirEnColumna(
      ys.map((y, i) => ({ id: `p${i}`, y })),
      min,
      max,
      sep,
    );
  const lista = (m: Map<string, number>, n: number) =>
    Array.from({ length: n }, (_, i) => m.get(`p${i}`)!);

  it("una etiqueta aislada se queda donde estaba", () => {
    expect(lista(pedir([120]), 1)).toEqual([120]);
  });

  it("las que ya están separadas no se mueven", () => {
    expect(lista(pedir([20, 60, 130, 250]), 4)).toEqual([20, 60, 130, 250]);
  });

  it("un grupo apretado se abre alrededor de su centro, con la separación pedida", () => {
    expect(lista(pedir([100, 100, 100]), 3)).toEqual([87, 100, 113]);
    // No se empuja todo hacia un lado: el centro del grupo sigue en su sitio.
    const r = lista(pedir([100, 104, 108, 112]), 4);
    expect(r.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(106, 10);
    expect(r[1] - r[0]).toBeCloseTo(13, 10);
  });

  it("conserva el orden de arriba abajo, también si llegan desordenadas", () => {
    const r = pedir([200, 50, 52, 51], 0, 300);
    // p1, p3, p2, p0 es el orden por altura: 50, 51, 52, 200.
    const orden = ["p1", "p3", "p2", "p0"].map((id) => r.get(id)!);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(r.size).toBe(4);
  });

  it("un grupo pegado al fondo sube y uno pegado al techo baja, sin salirse", () => {
    expect(lista(pedir([298, 299, 300], 0, 300), 3)).toEqual([274, 287, 300]);
    expect(lista(pedir([0, 1, 2], 0, 300), 3)).toEqual([0, 13, 26]);
  });

  it("si no caben todas con la separación pedida, la acorta en vez de salirse", () => {
    const r = lista(pedir(Array.from({ length: 10 }, () => 25), 0, 50), 10);
    expect(r[0]).toBeCloseTo(0, 10);
    expect(r[9]).toBeCloseTo(50, 10);
    for (let i = 1; i < 10; i++) expect(r[i] - r[i - 1]).toBeCloseTo(50 / 9, 10);
  });

  it("separa siempre al menos lo pedido y mueve menos que empujar en cascada", () => {
    // Un generador congruencial fijo: las mismas "aleatorias" en cada corrida.
    let semilla = 12345;
    const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let vuelta = 0; vuelta < 60; vuelta++) {
      const ys = Array.from({ length: 8 }, () => 40 + azar() * 220);
      const r = lista(pedir(ys, 0, 300), 8);
      const orden = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
      const colocadas = orden.map((o) => r[o.i]);
      for (let i = 1; i < 8; i++) expect(colocadas[i] - colocadas[i - 1]).toBeGreaterThanOrEqual(13 - 1e-9);
      for (const v of colocadas) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(300);
      }
      // La alternativa ingenua —cada una por debajo de la anterior— nunca queda más cerca.
      let previa = -Infinity;
      let ingenuo = 0;
      let nuestro = 0;
      orden.forEach((o, i) => {
        previa = Math.max(o.y, previa + 13);
        ingenuo += (previa - o.y) ** 2;
        nuestro += (colocadas[i] - o.y) ** 2;
      });
      expect(nuestro).toBeLessThanOrEqual(ingenuo + 1e-6);
    }
  });

  it("la frontera de capacidad del arranque: nueve nombres en orden y a poca distancia", () => {
    // Las alturas, en unidades del SVG, de los puntos de operación del modo capacidad.
    const ys = [58, 192, 202, 207, 218, 230, 242, 273, 273];
    const r = lista(pedir(ys, 50, 270), 9);
    for (let i = 1; i < 9; i++) expect(r[i] - r[i - 1]).toBeGreaterThanOrEqual(13 - 1e-9);
    expect(r[0]).toBeCloseTo(58, 10);
    for (let i = 0; i < 9; i++) expect(Math.abs(r[i] - ys[i])).toBeLessThan(40);
  });

  it("sin etiquetas no hay nada que repartir", () => {
    expect(repartirEnColumna([], 0, 100).size).toBe(0);
  });
});
