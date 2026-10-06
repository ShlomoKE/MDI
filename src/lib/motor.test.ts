import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import referencia from "./referencia.json";
import {
  F,
  GB,
  KVt,
  Pm,
  QUANT,
  Vt,
  W,
  formatoG,
  activasTotal,
  bytesCache,
  capacidad,
  cruces,
  dimensionar,
  kappa,
  modeloEn,
  slo,
  techos,
  techosAbsolutos,
  type Carga,
  type Cuello,
  type GPU,
  type Modelo,
  type Quant,
} from "./motor";
import {
  CARGA_DEMO,
  CHASIS,
  GPUS,
  MODELOS,
  REFERENCIA_CHASIS,
  horaria,
} from "./catalogos";

// --------------------------------------------------------------------------- //
// Utilidades
// --------------------------------------------------------------------------- //

/** El generador serializa inf y nan como cadenas; aquí se deshace eso. */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (v === "Infinity") return Infinity;
  if (v === "-Infinity") return -Infinity;
  if (v === "NaN") return NaN;
  throw new Error("no es un número: " + JSON.stringify(v));
}

/**
 * Los dos motores corren sobre flotantes de 64 bits y en el mismo orden de
 * operaciones, así que la igualdad tiene que ser exacta. Si esto se relaja
 * alguna vez, el criterio de aceptación deja de significar nada.
 */
function igual(actual: number, esperado: unknown, que: string) {
  const e = num(esperado);
  if (Number.isNaN(e)) {
    expect(actual, que).toBeNaN();
    return;
  }
  expect(actual, que).toBe(e);
}

type CasoJSON = (typeof referencia)["casos"][number];

const aModelo = (m: CasoJSON["modelo"]): Modelo => ({
  nombre: m.nombre,
  N: m.N,
  capas_atn: m.capas_atn,
  kv_heads: m.kv_heads,
  head_dim: m.head_dim,
  quant_pesos: m.quant_pesos as Quant,
  quant_cache: m.quant_cache as Quant,
});

const aGPU = (g: CasoJSON["gpu"]): GPU => ({
  nombre: g.nombre,
  vram_gb: g.vram_gb,
  bw_gbs: g.bw_gbs,
  tflops: g.tflops,
  precio_hora: g.precio_hora,
  eff: g.eff,
  n: g.n,
  escala: g.escala,
});

const aCarga = (c: CasoJSON["carga"]): Carga => ({
  humanos: { U: c.humanos.U, D: c.humanos.D, C: c.humanos.C },
  agentes: { U: c.agentes.U, D: c.agentes.D, C: c.agentes.C },
  slo_ms: c.slo_ms,
  overhead_gb: c.overhead_gb,
});

// --------------------------------------------------------------------------- //
// 1. Paridad exacta con motor.py
// --------------------------------------------------------------------------- //

describe("paridad con motor.py", () => {
  it("la constante GB coincide", () => {
    expect(GB).toBe(referencia.GB);
  });

  it("hay casos de referencia que verificar", () => {
    expect(referencia.casos.length).toBeGreaterThan(200);
  });

  for (const caso of referencia.casos as CasoJSON[]) {
    it(caso.id, () => {
      const m = aModelo(caso.modelo);
      const g = aGPU(caso.gpu);
      const c = aCarga(caso.carga);

      // propiedades derivadas
      igual(Pm(m), caso.modelo.Pm, "Pm");
      igual(KVt(m), caso.modelo.KVt, "KVt");
      igual(QUANT[m.quant_pesos], caso.modelo.b_w, "b_w");
      igual(QUANT[m.quant_cache], caso.modelo.b_kv, "b_kv");
      igual(activasTotal(c), caso.carga.activas, "activas");
      igual(kappa(c), caso.carga.kappa, "kappa");

      // techos
      const t = techos(m, g, c);
      igual(t.memoria, caso.techos.memoria, "techos.memoria");
      igual(t.latencia, caso.techos.latencia, "techos.latencia");
      igual(t.computo, caso.techos.computo, "techos.computo");
      expect(t.viable, "techos.viable").toBe(caso.techos.viable);
      expect(t.motivo, "techos.motivo").toBe(caso.techos.motivo);

      // modo dimensionar
      const d = dimensionar(m, g, c);
      const rd = caso.dimensionar;
      expect(d.viable, "dim.viable").toBe(rd.viable);
      expect(d.motivo, "dim.motivo").toBe(rd.motivo);
      expect(d.cuello, "dim.cuello").toBe(rd.cuello);
      expect(d.cumple_slo, "dim.cumple_slo").toBe(rd.cumple_slo);
      igual(d.G, rd.G, "dim.G");
      igual(d.G_mem, rd.G_mem, "dim.G_mem");
      igual(d.G_lat, rd.G_lat, "dim.G_lat");
      igual(d.G_comp, rd.G_comp, "dim.G_comp");
      igual(d.B, rd.B, "dim.B");
      igual(d.tpot_ms, rd.tpot_ms, "dim.tpot_ms");
      igual(d.tok_s_sesion, rd.tok_s_sesion, "dim.tok_s_sesion");
      igual(d.throughput, rd.throughput, "dim.throughput");
      igual(d.costo_hora, rd.costo_hora, "dim.costo_hora");

      // modo capacidad
      const cap = capacidad(m, g, c, caso.G);
      const rc = caso.capacidad;
      expect(cap.viable, "cap.viable").toBe(rc.viable);
      expect(cap.motivo, "cap.motivo").toBe(rc.motivo);
      expect(cap.cuello, "cap.cuello").toBe(rc.cuello);
      expect(cap.alcanza, "cap.alcanza").toBe(rc.alcanza);
      igual(cap.G, rc.G, "cap.G");
      igual(cap.usuarios, rc.usuarios, "cap.usuarios");
      igual(cap.agentes, rc.agentes, "cap.agentes");
      igual(cap.max_solo_agentes, rc.max_solo_agentes, "cap.max_solo_agentes");
      igual(cap.B, rc.B, "cap.B");
      igual(cap.tpot_ms, rc.tpot_ms, "cap.tpot_ms");
      igual(cap.throughput, rc.throughput, "cap.throughput");
      igual(cap.costo_hora, rc.costo_hora, "cap.costo_hora");

      // cruces de régimen
      const cr = cruces(m, g, c);
      igual(cr.Ceq1_computo_latencia, caso.cruces.Ceq1_computo_latencia, "Ceq1");
      igual(cr.Ceq3_computo_memoria, caso.cruces.Ceq3_computo_memoria, "Ceq3");
      expect(cr.regimen, "regimen").toBe(caso.cruces.regimen);

      // techos absolutos
      const ta = techosAbsolutos(m, g, c.humanos.C ? c.humanos.C : 1);
      igual(ta.por_memoria, caso.techos_absolutos.por_memoria, "ta.por_memoria");
      igual(ta.por_computo, caso.techos_absolutos.por_computo, "ta.por_computo");
    });
  }
});

// --------------------------------------------------------------------------- //
// 2. TPOT teórico de un modelo denso = Pₘ / W
// --------------------------------------------------------------------------- //

describe("TPOT teórico de un modelo denso", () => {
  const denso: Modelo = MODELOS.find((m) => m.nombre === "Denso 70B")!;
  const h100: GPU = GPUS.find((g) => g.nombre === "H100 SXM")!;

  it("con caché despreciable el TPOT es exactamente Pₘ / W", () => {
    // Una sola sesión con contexto cero: no hay KV cache que leer, así que el
    // único tráfico por token es el de los pesos.
    const c: Carga = {
      humanos: { U: 1, D: 1, C: 0 },
      agentes: { U: 0, D: 0, C: 0 },
      slo_ms: 1000,
      overhead_gb: 4,
    };
    expect(bytesCache(c, denso)).toBe(0);

    const d = dimensionar(denso, h100, c);
    const esperado = Pm(denso) / W(h100);

    expect(d.viable).toBe(true);
    expect(d.G).toBe(1);
    expect(d.tpot_ms).toBe(esperado * 1000);
    expect(d.tok_s_sesion).toBe(1 / esperado);
  });

  it("Pₘ / W es la cota inferior: agregar contexto solo puede empeorarlo", () => {
    const piso = (Pm(denso) / W(h100)) * 1000;
    let previo = piso;
    for (const ctx of [0, 100, 1000, 4000, 16000, 64000]) {
      const c: Carga = {
        humanos: { U: 1, D: 1, C: ctx },
        agentes: { U: 0, D: 0, C: 0 },
        slo_ms: 1000,
        overhead_gb: 4,
      };
      const d = dimensionar(denso, h100, c);
      expect(d.tpot_ms).toBeGreaterThanOrEqual(piso);
      expect(d.tpot_ms).toBeGreaterThanOrEqual(previo);
      previo = d.tpot_ms;
    }
  });

  it("el techo de latencia es justo el margen sobre Pₘ que deja el SLO", () => {
    const c: Carga = {
      humanos: { U: 1, D: 1, C: 1000 },
      agentes: { U: 0, D: 0, C: 0 },
      slo_ms: 30,
      overhead_gb: 4,
    };
    const t = techos(denso, h100, c);
    expect(t.latencia).toBe(slo(c) * W(h100) - Pm(denso));
    // que el SLO sea alcanzable equivale a que Pₘ/W quepa dentro del SLO
    expect(t.latencia > 0).toBe(Pm(denso) / W(h100) < slo(c));
  });

  it("el factor de eficiencia castiga ancho de banda y FLOPS por igual", () => {
    const lento: GPU = { ...h100, eff: 0.25 };
    const rapido: GPU = { ...h100, eff: 0.5 };
    expect(W(lento)).toBe(W(rapido) / 2);
    // techosAbsolutos toca los dos caminos: memoria (W) y cómputo (F)
    const a = techosAbsolutos(denso, lento, 4000);
    const b = techosAbsolutos(denso, rapido, 4000);
    expect(a.por_memoria).toBe(b.por_memoria / 2);
    expect(a.por_computo).toBe(b.por_computo / 2);
  });
});

// --------------------------------------------------------------------------- //
// 3. El cuello de botella cambia con el contexto
// --------------------------------------------------------------------------- //

describe("migración del cuello de botella", () => {
  const modelo = MODELOS[0];

  const cargaCon = (ctx: number, slo_ms: number, U = 2000): Carga => ({
    humanos: { U, D: 0.15, C: ctx },
    agentes: { U: 0, D: 0.95, C: ctx },
    slo_ms,
    overhead_gb: 4,
  });

  it("con contexto chico manda cómputo y con contexto grande manda memoria o latencia", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H100 SXM")!;
    // SLO holgado: la latencia deja de apretar y el contraste queda limpio.
    const corto = dimensionar(modelo, g, cargaCon(64, 300));
    const largo = dimensionar(modelo, g, cargaCon(200000, 300));

    expect(corto.cuello).toBe("computo");
    expect(largo.cuello === "memoria" || largo.cuello === "latencia").toBe(true);
  });

  it("el cuello nunca retrocede a cómputo al alargar el contexto", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H100 SXM")!;
    const orden: Record<Cuello, number> = { computo: 0, latencia: 1, memoria: 1 };
    let previo = -1;
    for (const ctx of [64, 256, 1024, 4096, 16384, 65536, 262144]) {
      const d = dimensionar(modelo, g, cargaCon(ctx, 300));
      if (!d.viable) continue;
      const rango = orden[d.cuello as Cuello];
      expect(rango).toBeGreaterThanOrEqual(previo);
      previo = rango;
    }
  });

  it("las tres presiones crecen o se mantienen, pero solo la mayor fija G", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "A100 80GB")!;
    for (const ctx of [500, 5000, 50000]) {
      const d = dimensionar(modelo, g, cargaCon(ctx, 300));
      if (!d.viable) continue;
      const mayor = Math.max(d.G_mem, d.G_lat, d.G_comp);
      const suyo =
        d.cuello === "memoria" ? d.G_mem : d.cuello === "latencia" ? d.G_lat : d.G_comp;
      expect(suyo).toBe(mayor);
      expect(d.G).toBe(Math.max(1, Math.ceil(mayor)));
    }
  });

  it("apretar el SLO puede mover el cuello de memoria a latencia", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H200 SXM")!;
    const holgado = dimensionar(modelo, g, cargaCon(8000, 500));
    const apretado = dimensionar(modelo, g, cargaCon(8000, 25));
    expect(holgado.viable && apretado.viable).toBe(true);
    expect(holgado.cuello).not.toBe("latencia");
    expect(apretado.cuello).toBe("latencia");
    expect(apretado.G).toBeGreaterThan(holgado.G);
  });

  it("el cruce Ceq3 marca el contexto donde cómputo cede ante memoria", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H100 SXM")!;
    // Ceq1/Ceq3 suponen población única; se usa una sola población de humanos.
    const c = cargaCon(1000, 300);
    const cr = cruces(modelo, g, c);
    expect(Number.isFinite(cr.Ceq3_computo_memoria)).toBe(true);

    const antes = dimensionar(modelo, g, cargaCon(cr.Ceq3_computo_memoria * 0.1, 300));
    const despues = dimensionar(modelo, g, cargaCon(cr.Ceq3_computo_memoria * 10, 300));
    expect(antes.G_comp).toBeGreaterThan(antes.G_mem);
    expect(despues.G_mem).toBeGreaterThan(despues.G_comp);
  });
});

// --------------------------------------------------------------------------- //
// 4. Los dos modos son consistentes entre sí
// --------------------------------------------------------------------------- //

describe("consistencia entre dimensionar y capacidad", () => {
  const casos: Array<{ m: Modelo; c: Carga }> = [];
  for (const m of MODELOS) {
    for (const ctxH of [1000, 3000, 16000]) {
      for (const slo_ms of [30, 60, 150]) {
        casos.push({
          m,
          c: {
            humanos: { U: 1500, D: 0.15, C: ctxH },
            agentes: { U: 30, D: 0.95, C: 20000 },
            slo_ms,
            overhead_gb: 4,
          },
        });
      }
    }
  }

  it("si dimensionar devuelve G, capacidad con ese G admite la carga original", () => {
    let verificados = 0;
    for (const { m, c } of casos) {
      for (const g of GPUS) {
        const d = dimensionar(m, g, c);
        if (!d.viable) continue;

        const cap = capacidad(m, g, c, d.G);
        expect(cap.viable, `${m.nombre}/${g.nombre}: viable`).toBe(true);
        expect(cap.alcanza, `${m.nombre}/${g.nombre}: alcanza`).toBe(true);
        // Con el mismo G y los mismos agentes tienen que caber al menos los
        // humanos que se pidieron. El ceil de G solo puede dejar holgura.
        expect(
          cap.usuarios,
          `${m.nombre}/${g.nombre}: usuarios ${cap.usuarios} < ${c.humanos.U}`,
        ).toBeGreaterThanOrEqual(c.humanos.U);
        verificados++;
      }
    }
    expect(verificados).toBeGreaterThan(50);
  });

  it("con G−1 la holgura desaparece: o no alcanza, o admite menos usuarios", () => {
    let verificados = 0;
    for (const { m, c } of casos) {
      for (const g of GPUS) {
        const d = dimensionar(m, g, c);
        if (!d.viable || d.G < 2) continue;
        // Si G venía de un techo de bytes exactamente entero, G−1 podría seguir
        // alcanzando por milésimas; el caso interesante es el estricto.
        const cap = capacidad(m, g, c, d.G - 1);
        if (!cap.alcanza) {
          verificados++;
          continue;
        }
        expect(
          cap.usuarios,
          `${m.nombre}/${g.nombre}: G−1 debería admitir menos de ${c.humanos.U}`,
        ).toBeLessThan(c.humanos.U);
        verificados++;
      }
    }
    expect(verificados).toBeGreaterThan(20);
  });

  it("el ida y vuelta cierra: dimensionar la capacidad devuelta pide el mismo G", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H100 SXM")!;
    const m = MODELOS[0];
    for (const G of [2, 4, 8, 16, 32]) {
      const c: Carga = {
        humanos: { U: 0, D: 0.15, C: 3000 },
        agentes: { U: 20, D: 0.95, C: 20000 },
        slo_ms: 60,
        overhead_gb: 4,
      };
      const cap = capacidad(m, g, c, G);
      if (!cap.alcanza || !Number.isFinite(cap.usuarios)) continue;

      // Se rellena la carga hasta saturar y se vuelve a dimensionar.
      const saturada: Carga = { ...c, humanos: { ...c.humanos, U: cap.usuarios } };
      const d = dimensionar(m, g, saturada);
      expect(d.viable).toBe(true);
      expect(d.G, `G=${G} → ${d.G}`).toBe(G);
    }
  });

  it("ambos modos calculan el mismo TPOT para el mismo estado", () => {
    const g: GPU = GPUS.find((x) => x.nombre === "H200 SXM")!;
    const m = MODELOS[1];
    const c: Carga = {
      humanos: { U: 900, D: 0.15, C: 4000 },
      agentes: { U: 10, D: 0.95, C: 25000 },
      slo_ms: 45,
      overhead_gb: 4,
    };
    const d = dimensionar(m, g, c);
    expect(d.viable).toBe(true);

    // capacidad con exactamente la población de humanos ya presente reproduce
    // el TPOT de dimensionar, porque el estado del sistema es el mismo.
    const cap = capacidad(m, g, { ...c, humanos: { ...c.humanos, U: 0 } }, d.G);
    const saturada: Carga = { ...c, humanos: { ...c.humanos, U: cap.usuarios } };
    const d2 = dimensionar(m, g, saturada);
    expect(d2.tpot_ms).toBeCloseTo(cap.tpot_ms, 9);
  });

  it("la carga demo reproduce el TPOT que imprime motor.py", () => {
    // Los cuatro números que salen de `python motor.py` con el escenario demo.
    const esperado: Record<string, { G: number; cuello: Cuello; tpot: number }> = {
      "H100 SXM": { G: 3, cuello: "latencia", tpot: 29.4 },
      "H100 PCIe": { G: 23, cuello: "latencia", tpot: 29.9 },
      "H200 SXM": { G: 2, cuello: "latencia", tpot: 25.2 },
      "A100 80GB": { G: 19, cuello: "latencia", tpot: 29.9 },
    };
    for (const [nombre, e] of Object.entries(esperado)) {
      const g = GPUS.find((x) => x.nombre === nombre)!;
      const d = dimensionar(MODELOS[0], g, CARGA_DEMO);
      expect(d.G, nombre).toBe(e.G);
      expect(d.cuello, nombre).toBe(e.cuello);
      expect(Number(d.tpot_ms.toFixed(1)), nombre).toBe(e.tpot);
    }
  });

  it("las GPUs que motor.py declara inviables lo siguen siendo", () => {
    for (const nombre of ["L40S", "RTX 6000 Ada", "DGX Spark"]) {
      const g = GPUS.find((x) => x.nombre === nombre)!;
      const d = dimensionar(MODELOS[0], g, CARGA_DEMO);
      expect(d.viable, nombre).toBe(false);
      expect(d.motivo, nombre).toBe(`SLO de 30 ms inalcanzable en ${nombre}`);
    }
  });
});

// --------------------------------------------------------------------------- //
// 5. Invariantes de unidades y de guardas
// --------------------------------------------------------------------------- //

describe("unidades y guardas", () => {
  it("todo se mide en SI: bytes, bytes/s y FLOP/s", () => {
    const g = GPUS[0];
    expect(GB).toBe(1024 ** 3);
    expect(W(g)).toBe(g.bw_gbs * 1e9 * g.eff); // GB/s nominal → bytes/s
    expect(Pm(MODELOS[0])).toBe(MODELOS[0].N * 1e9 * QUANT[MODELOS[0].quant_pesos]);
  });

  it("un modelo que no cabe en VRAM se reporta como inviable, no como cero GPUs", () => {
    const enorme: Modelo = { ...MODELOS[2], N: 700, quant_pesos: "fp16" };
    const d = dimensionar(enorme, GPUS[0], CARGA_DEMO);
    expect(d.viable).toBe(false);
    expect(d.motivo).toBe("Denso 70B no cabe en H100 SXM");
    expect(d.G).toBe(0);
  });

  it("sin humanos, κ es infinito y no se rompe el cálculo", () => {
    const c: Carga = {
      humanos: { U: 0, D: 0, C: 0 },
      agentes: { U: 10, D: 0.95, C: 20000 },
      slo_ms: 60,
      overhead_gb: 4,
    };
    expect(kappa(c)).toBe(Infinity);
    const cap = capacidad(MODELOS[0], GPUS[0], c, 4);
    expect(cap.usuarios).toBe(Infinity);
  });

  it("formatoG reproduce %g de Python, incluidas las fronteras", () => {
    // Valores contrastados ejecutando f"{x:g}" en CPython 3.13.
    const casos: Array<[number, string]> = [
      [30, "30"],
      [30.5, "30.5"],
      [0.5, "0.5"],
      [1, "1"],
      [0.001, "0.001"],
      [0.0001, "0.0001"],
      // Redondea a 0.0001 y por tanto NO entra en notación exponencial, aunque
      // su log10 esté por debajo de -4.
      [9.9999999e-5, "0.0001"],
      // Al revés: log10 < 6 pero redondea a 1000000, así que sí sale como 1e+06.
      [999999.5, "1e+06"],
      [1e7, "1e+07"],
      [123456.7, "123457"],
      [0, "0"],
      [-0, "-0"],
    ];
    for (const [x, esperado] of casos) {
      expect(formatoG(x), String(x)).toBe(esperado);
    }
  });

  it("el mensaje del SLO usa el mismo formato que Python", () => {
    const g = GPUS.find((x) => x.nombre === "DGX Spark")!;
    for (const [slo_ms, texto] of [
      [30, "30"],
      [30.5, "30.5"],
      [0.5, "0.5"],
      [1, "1"],
    ] as Array<[number, string]>) {
      const t = techos(MODELOS[0], g, { ...CARGA_DEMO, slo_ms });
      expect(t.motivo).toBe(`SLO de ${texto} ms inalcanzable en DGX Spark`);
    }
  });
});

// --------------------------------------------------------------------------- //
// 6. Chasis: una unidad de n GPUs
// --------------------------------------------------------------------------- //

describe("chasis: una unidad de n GPUs", () => {
  const h100: GPU = GPUS.find((g) => g.nombre === "H100 SXM")!;
  const qwen = MODELOS[0]; // 4 cabezas de KV
  const denso8 = MODELOS[1]; // 8 cabezas de KV

  /** La misma H100, pero como una unidad de n GPUs con escalado σ. */
  const unidad = (n: number, escala = 1): GPU => ({ ...h100, nombre: `${n}×H100`, n, escala });

  it("la VRAM, el ancho de banda y los FLOPS se suman", () => {
    const c8 = unidad(8);
    // n es potencia de 2 y σ=1: multiplicar no redondea, así que la igualdad es exacta.
    expect(Vt(c8)).toBe(8 * Vt(h100));
    expect(W(c8)).toBe(8 * W(h100));
    expect(F(c8)).toBe(8 * F(h100));
  });

  it("σ descuenta ancho de banda y FLOPS por igual, y no toca la VRAM", () => {
    const mala = unidad(8, 0.5);
    const perfecta = unidad(8, 1);
    expect(W(mala)).toBe(W(perfecta) / 2);
    expect(F(mala)).toBe(F(perfecta) / 2);
    expect(Vt(mala)).toBe(Vt(perfecta));
  });

  it("el overhead del motor se paga una vez por GPU", () => {
    const c8 = unidad(8);
    const t = techos(qwen, c8, CARGA_DEMO);
    expect(t.memoria).toBe(Vt(c8) - Pm(qwen) - 8 * CARGA_DEMO.overhead_gb * GB);
  });

  it("los pesos no se replican: un chasis deja a las n GPUs sueltas por detrás en caché", () => {
    const suelta = techos(qwen, h100, CARGA_DEMO);
    const chasis = techos(qwen, unidad(8), CARGA_DEMO);
    // 8 GPUs sueltas gastan 8 veces los pesos; el chasis los guarda una sola vez.
    expect(chasis.memoria).toBe(8 * suelta.memoria + 7 * Pm(qwen));
  });

  it("con σ=1 el techo de cómputo de la unidad es n veces el de una GPU", () => {
    const suelta = techos(qwen, h100, CARGA_DEMO);
    expect(techos(qwen, unidad(8), CARGA_DEMO).computo).toBe(8 * suelta.computo);
    expect(techos(qwen, unidad(4), CARGA_DEMO).computo).toBe(4 * suelta.computo);
  });

  it("un modelo que no cabe en una GPU cabe en un chasis", () => {
    const m70: Modelo = { ...MODELOS[2], quant_pesos: "fp16", quant_cache: "fp16" }; // 140 GB
    const suelta = dimensionar(m70, h100, CARGA_DEMO);
    expect(suelta.viable).toBe(false);
    expect(suelta.motivo).toBe("Denso 70B no cabe en H100 SXM");

    const chasis = dimensionar(m70, unidad(8, 0.75), CARGA_DEMO);
    expect(chasis.viable).toBe(true);
    expect(chasis.G).toBeGreaterThanOrEqual(1);
  });

  it("el ejemplo del documento: un 70B en fp8 no alcanza 30 ms en una H100, y sí en un chasis", () => {
    // La sección «Chasis completos» dice que leer los pesos de un 70B en fp8 desde
    // una H100 suelta tarda unos 42 ms con η = 0.5. Si cambia una fórmula o el
    // catálogo, el texto tiene que cambiar con ellos: esta prueba lo obliga.
    const m70 = MODELOS[2];
    const piso = (Pm(m70) / W(h100)) * 1000;
    expect(piso).toBeGreaterThan(41);
    expect(piso).toBeLessThan(43);
    expect(dimensionar(m70, h100, CARGA_DEMO).viable).toBe(false);
    expect(dimensionar(m70, unidad(8, 0.75), CARGA_DEMO).viable).toBe(true);
  });

  it("el factor n·σ·η es todo lo que cambia: una GPU ficticia con las cifras sumadas da lo mismo", () => {
    // Un chasis de 8 con σ=1 equivale a una sola GPU con 8× el ancho de banda y
    // los FLOPS, siempre que se le pague el mismo overhead (8 veces) a la VRAM.
    // Es la prueba de que "las ecuaciones no cambian, solo sus parámetros".
    const c = CARGA_DEMO;
    const chasis = unidad(8);
    const ficticia: GPU = {
      ...h100,
      nombre: "ficticia",
      vram_gb: 8 * h100.vram_gb - 7 * c.overhead_gb, // descuenta de antemano los 7 overheads extra
      bw_gbs: 8 * h100.bw_gbs,
      tflops: 8 * h100.tflops,
      n: 1,
      escala: 1,
    };
    // Con 8 cabezas de KV el chasis no replica nada, así que el modelo es el mismo.
    const a = dimensionar(denso8, chasis, c);
    const b = dimensionar(denso8, ficticia, c);
    expect(a.G).toBe(b.G);
    expect(a.cuello).toBe(b.cuello);
    expect(a.G_mem).toBe(b.G_mem);
    expect(a.G_lat).toBe(b.G_lat);
    expect(a.G_comp).toBe(b.G_comp);
    expect(a.tpot_ms).toBe(b.tpot_ms);
  });

  describe("réplica de las cabezas de KV", () => {
    const m8: Modelo = { ...qwen, kv_heads: 8 };
    const c8 = unidad(8, 0.75);

    it("con más GPUs que cabezas, el caché por token se multiplica por n/H", () => {
      // 8 GPUs y 4 cabezas: cada cabeza vive en 2 GPUs, que es lo mismo que
      // tener 8 cabezas. Se verifica contra el modelo de 8 cabezas, campo a campo.
      expect(dimensionar(qwen, c8, CARGA_DEMO)).toEqual(dimensionar(m8, c8, CARGA_DEMO));
      expect(capacidad(qwen, c8, CARGA_DEMO, 2)).toEqual(capacidad(m8, c8, CARGA_DEMO, 2));
      expect(cruces(qwen, c8, CARGA_DEMO)).toEqual(cruces(m8, c8, CARGA_DEMO));
      expect(techosAbsolutos(qwen, c8, 3000)).toEqual(techosAbsolutos(m8, c8, 3000));
    });

    it("duplica el caché por token de un modelo de 4 cabezas en 8 GPUs", () => {
      // La fórmula ingenua, KVₜ = 2·Lₐ·H·dₖ·b con H=4, dice la mitad de lo que de
      // verdad ocupa el caché una vez repartido en 8 GPUs.
      expect(KVt(modeloEn(qwen, c8))).toBe(2 * KVt(qwen));
    });

    it("no replica cuando las GPUs caben en las cabezas, ni con una sola GPU", () => {
      expect(modeloEn(qwen, unidad(4))).toBe(qwen); // n = H
      expect(modeloEn(qwen, unidad(2))).toBe(qwen); // n < H
      expect(modeloEn(denso8, unidad(8))).toBe(denso8); // n = H
      expect(modeloEn(qwen, h100)).toBe(qwen); // una GPU suelta
      // Ni siquiera con un modelo de cabezas fraccionarias o inexistentes.
      const raro: Modelo = { ...qwen, kv_heads: 0.5 };
      expect(modeloEn(raro, h100)).toBe(raro);
      const sinCache: Modelo = { ...qwen, kv_heads: 0 };
      expect(modeloEn(sinCache, unidad(8))).toBe(sinCache);
    });

    it("la réplica es proporcional a n/H", () => {
      for (const n of [8, 16, 32, 72]) {
        const r = modeloEn(qwen, unidad(n));
        expect(KVt(r) / KVt(qwen), `n=${n}`).toBe(n / qwen.kv_heads);
      }
    });
  });

  describe("monotonía", () => {
    // Una carga lo bastante grande como para que haga falta más de un chasis.
    const grande: Carga = {
      humanos: { U: 120000, D: 0.15, C: 6000 },
      agentes: { U: 900, D: 0.95, C: 40000 },
      slo_ms: 30,
      overhead_gb: 4,
    };

    it("más escala σ nunca pide más chasis", () => {
      let previo = Infinity;
      for (const s of [0.2, 0.4, 0.6, 0.8, 1]) {
        const d = dimensionar(denso8, unidad(8, s), grande);
        expect(d.viable, `σ=${s}`).toBe(true);
        expect(d.G, `σ=${s}`).toBeLessThanOrEqual(previo);
        previo = d.G;
      }
    });

    it("más escala σ solo baja las presiones de latencia y de cómputo, no la de memoria", () => {
      const mala = dimensionar(denso8, unidad(8, 0.5), grande);
      const buena = dimensionar(denso8, unidad(8, 1), grande);
      expect(buena.G_lat).toBeLessThan(mala.G_lat);
      expect(buena.G_comp).toBeLessThan(mala.G_comp);
      expect(buena.G_mem).toBe(mala.G_mem);
    });

    it("dimensionar y capacidad siguen cerrando el círculo con chasis", () => {
      let verificados = 0;
      for (const g of CHASIS) {
        for (const m of MODELOS) {
          const d = dimensionar(m, g, grande);
          if (!d.viable) continue;
          const cap = capacidad(m, g, grande, d.G);
          expect(cap.alcanza, `${m.nombre}/${g.nombre}`).toBe(true);
          expect(cap.usuarios, `${m.nombre}/${g.nombre}`).toBeGreaterThanOrEqual(grande.humanos.U);
          verificados++;
        }
      }
      expect(verificados).toBeGreaterThan(10);
    });
  });
});

// --------------------------------------------------------------------------- //
// 7. Los catálogos de catalogos.ts son los de motor.py
// --------------------------------------------------------------------------- //

describe("los catálogos coinciden con los de motor.py", () => {
  // Los dos catálogos se escriben a mano, uno por lenguaje, y una cifra mal
  // copiada no la detecta ninguna prueba de paridad del motor: el motor recibe
  // lo que le den. Esta sí: compara campo a campo y en el mismo orden.
  const cat = referencia.catalogos;

  it("GPUs: mismos nombres, orden y cifras", () => {
    expect(GPUS.map((g) => g.nombre)).toEqual(cat.gpus.map((g) => g.nombre));
    cat.gpus.forEach((py, i) => {
      const ts = GPUS[i];
      for (const k of ["vram_gb", "bw_gbs", "tflops", "precio_hora", "eff", "n", "escala"] as const) {
        expect(ts[k], `${py.nombre}.${k}`).toBe(py[k]);
      }
    });
  });

  it("chasis: mismos nombres, orden y cifras", () => {
    expect(CHASIS.map((g) => g.nombre)).toEqual(cat.chasis.map((g) => g.nombre));
    cat.chasis.forEach((py, i) => {
      const ts = CHASIS[i];
      for (const k of ["vram_gb", "bw_gbs", "tflops", "precio_hora", "eff", "n", "escala"] as const) {
        expect(ts[k], `${py.nombre}.${k}`).toBe(py[k]);
      }
    });
  });

  it("modelos: mismos nombres, orden y cifras", () => {
    expect(MODELOS.map((m) => m.nombre)).toEqual(cat.modelos.map((m) => m.nombre));
    cat.modelos.forEach((py, i) => {
      const ts = MODELOS[i];
      for (const k of ["N", "capas_atn", "kv_heads", "head_dim", "quant_pesos", "quant_cache"] as const) {
        expect(ts[k], `${py.nombre}.${k}`).toBe(py[k]);
      }
    });
  });

  it("los chasis son de verdad chasis, y las GPUs sueltas son una sola GPU", () => {
    for (const g of GPUS) expect(g.n, g.nombre).toBe(1);
    for (const c of CHASIS) {
      expect(c.n, c.nombre).toBeGreaterThan(1);
      expect(c.escala, c.nombre).toBeGreaterThan(0);
      expect(c.escala, c.nombre).toBeLessThanOrEqual(1);
    }
  });

  it("los nombres no se repiten: cada unidad se identifica por el suyo", () => {
    const nombres = [...GPUS, ...CHASIS].map((g) => g.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    const ids = [...GPUS, ...CHASIS].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// --------------------------------------------------------------------------- //
// 8. Lo que los documentos dicen de las pruebas es lo que las pruebas hacen
// --------------------------------------------------------------------------- //

describe("los documentos citan el número real de escenarios", () => {
  // El número de escenarios de paridad está escrito a mano en los READMEs y en
  // el pie de la página. Cada vez que se agrega una unidad al catálogo cambia, y
  // una cifra vieja ahí es justo el tipo de afirmación falsa que este proyecto
  // se jura no hacer. La prueba la ata al fixture real.
  const n = referencia.casos.length;

  const cifras = (ruta: string, patron: RegExp): number[] => {
    const texto = readFileSync(new URL(ruta, import.meta.url), "utf8");
    return Array.from(texto.matchAll(patron), (m) => Number(m[1]));
  };

  it("README.md", () => {
    const citadas = cifras("../../README.md", /\b(\d{3,5})\s+(?:escenarios|casos)\b/g);
    expect(citadas.length).toBeGreaterThan(0);
    for (const c of citadas) expect(c, "README.md cita una cifra vieja").toBe(n);
  });

  it("README.en.md", () => {
    const citadas = cifras("../../README.en.md", /\b(\d{3,5})\s+(?:scenarios|cases)\b/g);
    expect(citadas.length).toBeGreaterThan(0);
    for (const c of citadas) expect(c, "README.en.md cita una cifra vieja").toBe(n);
  });

  it("el pie de la página, en los dos idiomas", () => {
    const es = cifras("../i18n/textos.ts", /\b(\d{3,5})\s+escenarios\b/g);
    const en = cifras("../i18n/textos.ts", /\b(\d{3,5})\s+scenarios\b/g);
    expect(es.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
    for (const c of [...es, ...en]) expect(c, "el pie cita una cifra vieja").toBe(n);
  });
});

// --------------------------------------------------------------------------- //
// 9. Los precios de los chasis tienen procedencia y siguen una regla
// --------------------------------------------------------------------------- //

describe("los precios por hora de los chasis", () => {
  // Un precio por hora suelto es un número del que nadie sabe de dónde salió. Cada
  // chasis lleva su precio de lista, su consumo y la fuente, y su USD/h tiene que
  // ser el que da la regla de `horaria` con esos datos, al centavo: si se cambia
  // uno sin el otro, esta prueba falla.
  for (const c of CHASIS) {
    describe(c.nombre, () => {
      const ref = REFERENCIA_CHASIS[c.id];

      it("tiene referencia de precio", () => {
        expect(ref, `falta REFERENCIA_CHASIS["${c.id}"]`).toBeDefined();
      });

      it("su USD/h es el de la regla, al centavo", () => {
        expect(Math.abs(c.precio_hora - horaria(ref.usd, ref.kw))).toBeLessThanOrEqual(0.005 + 1e-9);
      });

      it("su fuente es una URL https y su fecha un AAAA-MM", () => {
        expect(ref.fuente.url).toMatch(/^https:\/\/[^\s]+$/);
        expect(ref.fuente.url, "quedó una URL de relleno").not.toContain("example.com");
        expect(ref.fecha).toMatch(/^20\d\d-(0[1-9]|1[0-2])$/);
        expect(ref.fuente.nombre.length).toBeGreaterThan(0);
        expect(["alta", "media", "baja"]).toContain(ref.confianza);
      });
    });
  }

  it("los σ que cita el documento son los del catálogo", () => {
    // La sección «Chasis completos» dice cuánto vale σ en cada chasis de NVIDIA y
    // en el de AMD. Si se cambia uno en el catálogo, el texto tiene que cambiar.
    const f = (nombre: string) => CHASIS.find((c) => c.nombre === nombre)!.escala.toFixed(2);
    const leer = (ruta: string) =>
      readFileSync(new URL(ruta, import.meta.url), "utf8").replace(/\s+/g, " ");

    expect(leer("../contenido/documento.mdx")).toContain(
      `Sale ${f("DGX H100")} en la H100, ${f("DGX H200")} en la H200, ${f("DGX B200")} en la B200 y ${f("DGX B300")} en la B300`,
    );
    expect(leer("../contenido/documento.mdx")).toContain(`se supuso ${f("MI300X x8")}`);

    expect(leer("../contenido/documento.en.mdx")).toContain(
      `It comes out at ${f("DGX H100")} for the H100, ${f("DGX H200")} for the H200, ${f("DGX B200")} for the B200 and ${f("DGX B300")} for the B300`,
    );
    expect(leer("../contenido/documento.en.mdx")).toContain(`${f("MI300X x8")} was assumed`);
  });

  it("no sobra ninguna referencia: cada una corresponde a un chasis del catálogo", () => {
    const ids = new Set(CHASIS.map((c) => c.id));
    for (const id of Object.keys(REFERENCIA_CHASIS)) expect(ids.has(id), id).toBe(true);
  });

  it("un chasis cuesta más que sus GPUs sueltas pero no una barbaridad más", () => {
    // Cota de cordura entre el precio por GPU dentro del chasis y el de la GPU
    // suelta del mismo modelo cuando el catálogo la trae: ni gratis ni 5 veces más.
    const pares: Array<[string, string]> = [
      ["DGX A100", "A100 80GB"],
      ["DGX H100", "H100 SXM"],
      ["DGX H200", "H200 SXM"],
      ["8x L40S", "L40S"],
    ];
    for (const [chasis, gpu] of pares) {
      const c = CHASIS.find((x) => x.nombre === chasis);
      const g = GPUS.find((x) => x.nombre === gpu);
      if (!c || !g) continue;
      const razon = c.precio_hora / c.n / g.precio_hora;
      expect(razon, `${chasis} por GPU frente a ${gpu}`).toBeGreaterThan(0.3);
      expect(razon, `${chasis} por GPU frente a ${gpu}`).toBeLessThan(3);
    }
  });
});
