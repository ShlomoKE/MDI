// @vitest-environment jsdom
/**
 * Prueba de humo de la página completa.
 *
 * Monta la aplicación de verdad —documento MDX incluido— y falla si el
 * navegador escribe cualquier cosa en `console.error` o `console.warn`. Cubre
 * el requisito de "carga sin errores de consola" desde las pruebas, sin
 * depender de abrir el sitio a mano.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import DocumentoEs from "./contenido/documento.mdx";
import DocumentoEn from "./contenido/documento.en.mdx";
import { CHASIS, GPUS, MODELOS, REFERENCIA_CHASIS } from "./lib/catalogos";
import { fmt, fmtGB, usd } from "./lib/formato";
import { serializar, leer, ESTADO_INICIAL, type Estado } from "./lib/urlEstado";
import type { Idioma } from "./i18n/idioma";
import { TEXTOS } from "./i18n/textos";

let contenedor: HTMLDivElement;
let raiz: Root;
const problemas: string[] = [];

beforeEach(() => {
  problemas.length = 0;
  vi.spyOn(console, "error").mockImplementation((...a) => problemas.push("error: " + a.join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => problemas.push("warn: " + a.join(" ")));
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.restoreAllMocks();
});

function montar(idioma: Idioma = "es") {
  // En producción el documento lo resuelve `main.tsx` con un import dinámico,
  // uno por idioma; aquí se pasa directo porque la prueba ya sabe cuál quiere.
  act(() => {
    raiz.render(<App idioma={idioma} Documento={idioma === "en" ? DocumentoEn : DocumentoEs} />);
  });
}

describe("la página monta sin errores", () => {
  it("renderiza el documento y la calculadora sin ensuciar la consola", () => {
    montar();
    expect(problemas, problemas.join("\n")).toEqual([]);

    // El documento
    expect(contenedor.querySelector("#documento")).not.toBeNull();
    // Las ecuaciones del MDX ya vienen resueltas por rehype-katex en build.
    expect(contenedor.querySelectorAll(".katex").length).toBeGreaterThan(10);
    // La calculadora
    expect(contenedor.querySelector("#calculadora")).not.toBeNull();
  });

  it("la navegación lista todas las secciones del documento más la calculadora", () => {
    montar();
    const titulos = Array.from(contenedor.querySelectorAll("#documento h2[id]"));
    expect(titulos.length).toBeGreaterThanOrEqual(8);

    const enlaces = Array.from(contenedor.querySelectorAll('nav[aria-label="Secciones"] a')).map(
      (a) => a.getAttribute("href"),
    );
    for (const h of titulos) expect(enlaces).toContain("#" + h.id);
    expect(enlaces).toContain("#calculadora");
  });

  it("hay un enlace de salto a la calculadora desde el inicio", () => {
    montar();
    const saltos = Array.from(contenedor.querySelectorAll('a[href="#calculadora"]'));
    expect(saltos.length).toBeGreaterThan(0);
  });

  it("el prefill se define antes de que el documento lo dé por sabido", () => {
    montar();
    const titulos = Array.from(contenedor.querySelectorAll("#documento h2[id]"));
    const prefill = titulos.findIndex((h) => h.id === "antes-del-ciclo-el-prefill");
    const decode = titulos.findIndex((h) => h.id === "el-ciclo-de-decodificación");
    const limitaciones = titulos.findIndex((h) => h.id === "limitaciones");

    expect(prefill, "falta la sección del prefill").toBeGreaterThanOrEqual(0);
    // El orden importa: "chunked prefill" aparece en las limitaciones, y antes
    // de esta sección el documento nunca decía qué era un prefill.
    expect(prefill).toBeLessThan(decode);
    expect(prefill).toBeLessThan(limitaciones);

    // El MDX parte los párrafos en varias líneas, así que una frase puede llegar
    // al DOM con un salto en medio: se compara sobre el texto normalizado.
    const texto = (contenedor.textContent ?? "").replace(/\s+/g, " ");
    expect(texto).toContain("TTFT");
    expect(texto).toContain("time to first token");
    // El caché KV deja de ser una fórmula caída del cielo.
    expect(texto).toContain("caché KV");
    // Y el TTFT tiene ecuación, no solo mención.
    expect(texto).toMatch(/TTFT\s*=/);
  });

  it("la sección de limitaciones declara todo lo que el modelo no contempla", () => {
    montar();
    const texto = contenedor.textContent ?? "";
    for (const tema of [
      "Prefix caching",
      "MoE",
      "Paralelismo tensorial",
      "Variabilidad de la demanda",
      "Chunked prefill",
      "duty cycles",
      "precios",
    ]) {
      expect(texto, `falta la advertencia sobre ${tema}`).toContain(tema);
    }
  });

  it("la autoría aparece arriba, en el pie y en la sección de cita", () => {
    montar();
    const encabezado = contenedor.querySelector("header")?.textContent ?? "";
    expect(encabezado).toContain("Propuesta por");
    expect(encabezado).toContain("Shlomo Kalach");

    const pie = contenedor.querySelector("footer")?.textContent ?? "";
    expect(pie).toContain("Shlomo Kalach");

    const texto = contenedor.textContent ?? "";
    expect(texto).toContain("Kalach, S. (2026)");
    expect(texto).toContain("@misc{kalach2026mdi");
    expect(texto).toContain("author       = {Kalach, Shlomo}");
  });

  it("todos los enlaces internos apuntan a un id que existe", () => {
    montar();
    // El id de las secciones lo genera rehype-slug a partir del título, así que
    // renombrar un `##` puede romper un ancla escrita a mano sin que nadie note.
    const ids = new Set(
      Array.from(contenedor.querySelectorAll("[id]")).map((e) => e.id),
    );
    const anclas = Array.from(contenedor.querySelectorAll('a[href^="#"]'))
      .map((a) => (a.getAttribute("href") ?? "").slice(1))
      .filter(Boolean);
    expect(anclas.length).toBeGreaterThan(10);
    for (const destino of anclas) {
      expect(ids, `#${destino} no existe`).toContain(destino);
    }
  });

  it("la tabla arranca con los números que imprime motor.py", () => {
    montar();
    const texto = contenedor.textContent ?? "";
    // Pesos y KV por token del escenario demo.
    expect(texto).toContain("25.1 GB");
    expect(texto).toContain("32 KB");
    // κ y sesiones activas.
    expect(texto).toContain("63×");
    expect(texto).toContain(fmt(338));
    // El TPOT de la H100 SXM: 29.4 ms con 3 unidades.
    expect(texto).toContain("29.4 ms");
    // El motivo de inviabilidad, textual. Tiene que coincidir letra por letra con
    // el que imprime `python motor.py`: scripts/comparar.mjs compara los dos.
    expect(texto).toContain("SLO de 30 ms inalcanzable en L40S");
    expect(TEXTOS.es.motivo.sloInalcanzable("30", "L40S")).toBe(
      "SLO de 30 ms inalcanzable en L40S",
    );
    expect(TEXTOS.es.motivo.noCabe("Denso 70B", "H100 SXM")).toBe(
      "Denso 70B no cabe en H100 SXM",
    );
  });

  it("las tablas de escritorio tienen su equivalente en tarjetas para móvil", () => {
    montar();
    // La tabla se oculta por debajo de md y las tarjetas aparecen ahí.
    const tabla = contenedor.querySelector("#calculadora .hidden.md\\:block table");
    const tarjetas = contenedor.querySelectorAll("#calculadora .md\\:hidden article");
    expect(tabla).not.toBeNull();
    expect(tarjetas.length).toBe(GPUS.length);
  });
});

describe("chasis completos", () => {
  /** Monta la página con una query dada, como si el lector hubiera abierto un enlace. */
  function abrir(query: string, idioma: Idioma = "es") {
    window.history.replaceState(null, "", "/?" + query);
    montar(idioma);
  }
  afterEach(() => window.history.replaceState(null, "", "/"));

  const filasDeTabla = () =>
    contenedor.querySelectorAll("#calculadora .hidden.md\\:block table tbody tr");

  it("por defecto la tabla es la de siempre: solo GPUs sueltas, sin rastro de chasis", () => {
    montar();
    expect(filasDeTabla().length).toBe(GPUS.length);
    const calculadora = contenedor.querySelector("#calculadora")?.textContent ?? "";
    for (const c of CHASIS) expect(calculadora, c.nombre).not.toContain(c.nombre);
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("el selector ofrece GPUs, Chasis y Ambos, y arranca en GPUs", () => {
    montar();
    const grupo = contenedor.querySelector('[role="group"][aria-label="Qué hardware comparar"]');
    expect(grupo, "falta el selector de vista").not.toBeNull();
    const botones = Array.from(grupo!.querySelectorAll("button"));
    expect(botones.map((b) => b.textContent)).toEqual(["GPUs", "Chasis", "Ambos"]);
    expect(botones.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
  });

  it("con vista=chasis la tabla lista los chasis con su VRAM total y su número de GPUs", () => {
    abrir("vista=chasis");
    expect(filasDeTabla().length).toBe(CHASIS.length);
    const tabla = contenedor.querySelector("#calculadora .hidden.md\\:block table")?.textContent ?? "";
    for (const c of CHASIS) {
      expect(tabla, c.nombre).toContain(c.nombre);
      // La VRAM que se muestra es la del chasis entero, no la de una GPU.
      expect(tabla, `${c.nombre}: VRAM total`).toContain(`${fmtGB(c.n * c.vram_gb)} GB`);
      expect(tabla, `${c.nombre}: n GPUs`).toContain(`${c.n} GPUs`);
    }
    // La primera columna ya no dice "GPU" sino "Chasis".
    const cabeceras = Array.from(
      contenedor.querySelectorAll("#calculadora .hidden.md\\:block table thead th"),
    ).map((th) => th.textContent);
    expect(cabeceras[0]).toBe("Chasis");
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("con vista=ambos están las dos listas juntas", () => {
    abrir("vista=ambos");
    expect(filasDeTabla().length).toBe(GPUS.length + CHASIS.length);
    const tarjetas = contenedor.querySelectorAll("#calculadora .md\\:hidden article");
    expect(tarjetas.length).toBe(GPUS.length + CHASIS.length);
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("cada chasis lleva sus datos también en las tarjetas del móvil", () => {
    abrir("vista=chasis");
    const tarjetas = Array.from(contenedor.querySelectorAll("#calculadora .md\\:hidden article"));
    expect(tarjetas.length).toBe(CHASIS.length);
    CHASIS.forEach((c, i) => {
      const texto = tarjetas[i].textContent ?? "";
      expect(texto, c.nombre).toContain(c.nombre);
      expect(texto, c.nombre).toContain(`${c.n} GPUs`);
    });
  });

  it("pulsar Chasis cambia la vista", () => {
    montar();
    const grupo = contenedor.querySelector('[role="group"][aria-label="Qué hardware comparar"]')!;
    const chasis = Array.from(grupo.querySelectorAll("button")).find((b) => b.textContent === "Chasis")!;
    act(() => chasis.click());
    expect(chasis.getAttribute("aria-pressed")).toBe("true");
    expect(filasDeTabla().length).toBe(CHASIS.length);
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("el modo capacidad nombra la unidad que se está contando", () => {
    abrir("modo=capacidad&g=2&vista=chasis");
    const texto = contenedor.textContent ?? "";
    expect(texto).toContain("Frontera de capacidad con 2 chasis");
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("el editor del catálogo trae una pestaña de chasis con sus campos", () => {
    montar();
    // Hay otro botón con aria-expanded antes —el de la navegación—, así que se acota.
    const abrirEditor = contenedor.querySelector<HTMLButtonElement>(
      "#calculadora button[aria-expanded]",
    )!;
    act(() => abrirEditor.click());
    const editor = abrirEditor.parentElement!;
    const pestana = Array.from(editor.querySelectorAll("button")).find((b) => b.textContent === "Chasis")!;
    expect(pestana, "falta la pestaña de chasis").toBeDefined();
    act(() => pestana.click());

    // Cada chasis tiene su campo de GPUs y su σ, con etiqueta accesible.
    const c = CHASIS[0];
    expect(editor.querySelector(`input[aria-label="GPUs en ${c.nombre}"]`)).not.toBeNull();
    expect(editor.querySelector(`input[aria-label="Escala σ de ${c.nombre}"]`)).not.toBeNull();
    expect((editor.querySelector(`input[aria-label="GPUs en ${c.nombre}"]`) as HTMLInputElement).value).toBe(
      String(c.n),
    );
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("el documento trae la tabla de chasis, generada del catálogo, con sus precios", () => {
    montar();
    const tabla = contenedor.querySelector("#documento table");
    expect(tabla, "falta la tabla de chasis en el documento").not.toBeNull();
    const filas = tabla!.querySelectorAll("tbody tr");
    expect(filas.length).toBe(CHASIS.length);
    CHASIS.forEach((c, i) => {
      const texto = filas[i].textContent ?? "";
      const ref = REFERENCIA_CHASIS[c.id];
      expect(texto, c.nombre).toContain(c.nombre);
      // El precio de lista y el precio por hora son los mismos que usa el motor.
      expect(texto, `${c.nombre}: lista`).toContain(usd(ref.usd, 0));
      expect(texto, `${c.nombre}: USD/h`).toContain(usd(c.precio_hora));
      expect(texto, `${c.nombre}: USD/h por GPU`).toContain(usd(c.precio_hora / c.n));
      expect(filas[i].querySelector("a")?.getAttribute("href"), `${c.nombre}: fuente`).toBe(
        ref.fuente.url,
      );
    });
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("la tabla del documento inglés usa los rótulos en inglés", () => {
    montar("en");
    const tabla = contenedor.querySelector("#documento table")!;
    const cabeceras = Array.from(tabla.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(cabeceras).toEqual([
      TEXTOS.en.chasis.colChasis,
      TEXTOS.en.chasis.colGPUs,
      TEXTOS.en.chasis.colMemoria,
      TEXTOS.en.chasis.colLista,
      TEXTOS.en.chasis.colHora,
      TEXTOS.en.chasis.colHoraGPU,
    ]);
    expect(problemas, problemas.join(" | ")).toEqual([]);
  });

  it("en inglés los rótulos de chasis salen traducidos", () => {
    abrir("vista=chasis", "en");
    const texto = (contenedor.textContent ?? "").replace(/\s+/g, " ");
    expect(texto).toContain(TEXTOS.en.calculadora.notaVista.chasis);
    expect(texto).not.toContain(TEXTOS.es.calculadora.notaVista.chasis);
    const cabeceras = Array.from(
      contenedor.querySelectorAll("#calculadora .hidden.md\\:block table thead th"),
    ).map((th) => th.textContent);
    expect(cabeceras[0]).toBe("Chassis");
    expect(problemas, problemas.join(" | ")).toEqual([]);
  });
});

describe("la página en inglés", () => {
  it("monta sin ensuciar la consola", () => {
    montar("en");
    expect(problemas, problemas.join(" | ")).toEqual([]);
    expect(contenedor.querySelector("#documento")).not.toBeNull();
    expect(contenedor.querySelectorAll(".katex").length).toBeGreaterThan(10);
  });

  it("no queda nada del español en la interfaz", () => {
    montar("en");
    const texto = (contenedor.textContent ?? "").replace(/\s+/g, " ");

    // Cadenas del diccionario español que no deben aparecer en la página inglesa.
    const delatores = [
      TEXTOS.es.encabezado.firma,
      TEXTOS.es.encabezado.irCalculadora,
      TEXTOS.es.encabezado.comoCitar,
      TEXTOS.es.navegacion.contenido,
      TEXTOS.es.calculadora.titulo,
      TEXTOS.es.calculadora.modoDim,
      TEXTOS.es.calculadora.modoCap,
      TEXTOS.es.cuellos.computo,
    ];
    for (const d of delatores) {
      expect(texto, `quedó en español: "${d}"`).not.toContain(d);
    }

    // Y sí debe aparecer su equivalente en inglés.
    expect(texto).toContain(TEXTOS.en.encabezado.firma);
    expect(texto).toContain(TEXTOS.en.encabezado.titulo);
    expect(texto).toContain(TEXTOS.en.navegacion.contenido);
  });

  it("el documento está traducido y conserva su estructura", () => {
    montar("en");
    const titulos = Array.from(contenedor.querySelectorAll("#documento h2[id]"));
    expect(titulos.length).toBeGreaterThanOrEqual(8);

    const texto = (contenedor.textContent ?? "").replace(/\s+/g, " ");
    // Las mismas piezas que verifica la versión española, en inglés.
    expect(texto).toContain("TTFT");
    expect(texto).toContain("time to first token");
    for (const tema of ["Prefix caching", "MoE", "tensor", "prefill"]) {
      expect(texto.toLowerCase(), `falta la advertencia sobre ${tema}`).toContain(
        tema.toLowerCase(),
      );
    }
  });

  it("la autoría y la cita siguen siendo las mismas, con el título en inglés", () => {
    montar("en");
    const texto = contenedor.textContent ?? "";
    expect(texto).toContain("Shlomo Kalach");
    expect(texto).toContain("Kalach, S. (2026)");
    expect(texto).toContain("@misc{kalach2026mdi");
    expect(texto).toContain(TEXTOS.en.meta.tituloCita);
    expect(texto).not.toContain(TEXTOS.es.meta.tituloCita);
  });

  it("los números del motor no cambian con el idioma", () => {
    montar("en");
    const texto = contenedor.textContent ?? "";
    // El motor es el mismo: mismos resultados que imprime `python motor.py`.
    expect(texto).toContain("25.1 GB");
    expect(texto).toContain("32 KB");
    expect(texto).toContain("29.4 ms");

    // El motivo de inviabilidad sí se traduce, pero NO tocando el que devuelve
    // el motor: ese sigue siendo el de motor.py, palabra por palabra, y viaja al
    // CSV. Lo que hace la página es rearmarlo en su idioma a partir de los mismos
    // techos. Ver src/i18n/motivo.ts.
    expect(texto).toContain(TEXTOS.en.motivo.sloInalcanzable("30", "L40S"));
    expect(texto).not.toContain(TEXTOS.es.motivo.sloInalcanzable("30", "L40S"));
  });

  it("todos los enlaces internos apuntan a un id que existe", () => {
    montar("en");
    const ids = new Set(Array.from(contenedor.querySelectorAll("[id]")).map((e) => e.id));
    const anclas = Array.from(contenedor.querySelectorAll('a[href^="#"]'))
      .map((a) => (a.getAttribute("href") ?? "").slice(1))
      .filter(Boolean);
    expect(anclas.length).toBeGreaterThan(10);
    for (const destino of anclas) {
      expect(ids, `#${destino} no existe en la página inglesa`).toContain(destino);
    }
  });

  it("el selector lleva a la otra versión y conserva query y ancla", () => {
    montar("en");
    const aEspanol = contenedor.querySelector('a[hreflang="es"]');
    expect(aEspanol, "falta el enlace al español").not.toBeNull();
    expect(aEspanol?.getAttribute("href")).toMatch(/^\/(\?|#|$)/);

    act(() => raiz.unmount());
    raiz = createRoot(contenedor);
    montar("es");
    const aIngles = contenedor.querySelector('a[hreflang="en"]');
    expect(aIngles, "falta el enlace al inglés").not.toBeNull();
    expect(aIngles?.getAttribute("href")).toMatch(/^\/en\//);
  });
});

describe("el diccionario está completo", () => {
  it("las dos versiones tienen exactamente las mismas claves", () => {
    const rutas = (o: unknown, prefijo = ""): string[] => {
      if (typeof o !== "object" || o === null) return [prefijo];
      return Object.entries(o).flatMap(([k, v]) => rutas(v, prefijo ? `${prefijo}.${k}` : k));
    };
    expect(rutas(TEXTOS.en).sort()).toEqual(rutas(TEXTOS.es).sort());
  });

  it("ninguna cadena inglesa se quedó sin traducir", () => {
    // Se comparan solo las cadenas: si una es idéntica en los dos idiomas suele
    // ser un copy-paste olvidado. Se excluyen las que legítimamente coinciden.
    const IGUALES_A_PROPOSITO = new Set([
      "GPU", "GPUs", "VRAM", "TPOT", "USD/h", "TFLOPS", "Duty cycle", "tok",
      "BibTeX", "MDI calculator", "—", "mem", "lat", "cpu", "Agents", "Models",
      "Cache", "Name", "Lₐ", "H", "dₖ", "N (B)", "VRAM GB", "BW GB/s",
      "VRAM (GB)", "Bandwidth (GB/s)",
      "Hardware", "σ", "VRAM GB/GPU", "BW GB/s/GPU", "TFLOPS/GPU",
    ]);
    const pares = (a: unknown, b: unknown, ruta = ""): string[] => {
      if (typeof a === "string" && typeof b === "string") {
        return a === b && !IGUALES_A_PROPOSITO.has(a) ? [`${ruta}: "${a}"`] : [];
      }
      if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return [];
      return Object.keys(a).flatMap((k) =>
        pares(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          ruta ? `${ruta}.${k}` : k,
        ),
      );
    };
    const sospechosas = pares(TEXTOS.es, TEXTOS.en);
    expect(sospechosas, "cadenas idénticas en los dos idiomas").toEqual([]);
  });
});

describe("el estado viaja en la URL", () => {
  it("una configuración por defecto no ensucia la query string", () => {
    expect(serializar(ESTADO_INICIAL)).toBe("");
  });

  it("ida y vuelta: lo que se serializa se vuelve a leer igual", () => {
    const e: Estado = {
      ...ESTADO_INICIAL,
      modo: "capacidad",
      Uh: 5500,
      Ch: 12000,
      Ua: 7,
      Ca: 90000,
      slo_ms: 45,
      overhead_gb: 6,
      eff: 0.65,
      G: 24,
      modeloId: MODELOS[2].id,
    };
    const vuelta = leer(serializar(e));
    expect(vuelta.modo).toBe(e.modo);
    expect(vuelta.Uh).toBe(e.Uh);
    expect(vuelta.Ch).toBe(e.Ch);
    expect(vuelta.Ua).toBe(e.Ua);
    expect(vuelta.Ca).toBe(e.Ca);
    expect(vuelta.slo_ms).toBe(e.slo_ms);
    expect(vuelta.overhead_gb).toBe(e.overhead_gb);
    expect(vuelta.eff).toBe(e.eff);
    expect(vuelta.G).toBe(e.G);
    // El modelo se identifica por su posición en el catálogo vigente.
    expect(vuelta.modelos[2].nombre).toBe(MODELOS[2].nombre);
    expect(vuelta.modeloId).toBe(vuelta.modelos[2].id);
  });

  it("un catálogo editado sobrevive al enlace, con GPUs agregadas y borradas", () => {
    const e: Estado = {
      ...ESTADO_INICIAL,
      gpus: [
        { ...GPUS[0], precio_hora: 9.99, on: false },
        {
          id: "x",
          nombre: "MI300X | rara~ñ",
          vram_gb: 192,
          bw_gbs: 5300,
          tflops: 1307,
          precio_hora: 3.2,
          eff: 0.5,
          n: 1,
          escala: 1,
          on: true,
        },
      ],
    };
    const vuelta = leer(serializar(e));
    expect(vuelta.gpus).toHaveLength(2);
    expect(vuelta.gpus[0].precio_hora).toBe(9.99);
    expect(vuelta.gpus[0].on).toBe(false);
    // Los separadores dentro del nombre no rompen la codificación.
    expect(vuelta.gpus[1].nombre).toBe("MI300X | rara~ñ");
    expect(vuelta.gpus[1].vram_gb).toBe(192);
  });

  it("una query basura no rompe: cae en los valores por defecto", () => {
    const vuelta = leer("?uh=abc&slo=&eff=99&g=-4&m=999&gpus=%%%&mods=");
    expect(vuelta.Uh).toBe(ESTADO_INICIAL.Uh);
    expect(vuelta.slo_ms).toBe(ESTADO_INICIAL.slo_ms);
    expect(vuelta.eff).toBe(1); // recortado al rango válido
    expect(vuelta.G).toBe(1);
    expect(vuelta.modeloId).toBe(vuelta.modelos[0].id);
  });

  it("los chasis y la vista viajan en el enlace", () => {
    const e: Estado = {
      ...ESTADO_INICIAL,
      vista: "chasis",
      chasis: [
        { ...CHASIS[0], n: 4, escala: 0.6, precio_hora: 9.5, on: false },
        {
          id: "x",
          nombre: "Mi chasis | raro~ñ",
          vram_gb: 96,
          bw_gbs: 1800,
          tflops: 1000,
          precio_hora: 12,
          eff: 0.5,
          n: 8,
          escala: 0.4,
          on: true,
        },
      ],
    };
    const q = serializar(e);
    expect(q).toContain("vista=chasis");
    expect(q).toContain("ch=");
    const vuelta = leer(q);
    expect(vuelta.vista).toBe("chasis");
    expect(vuelta.chasis).toHaveLength(2);
    expect(vuelta.chasis[0]).toMatchObject({ n: 4, escala: 0.6, precio_hora: 9.5, on: false });
    // Los separadores dentro del nombre no rompen la codificación.
    expect(vuelta.chasis[1]).toMatchObject({
      nombre: "Mi chasis | raro~ñ",
      n: 8,
      escala: 0.4,
      vram_gb: 96,
      bw_gbs: 1800,
      tflops: 1000,
    });
    // El catálogo de GPUs no se entera.
    expect(vuelta.gpus).toEqual(GPUS);
  });

  it("el catálogo de chasis de fábrica no ensucia la query, aunque se cambie de vista", () => {
    expect(serializar({ ...ESTADO_INICIAL, vista: "ambos" })).toBe("vista=ambos");
  });

  it("un enlace de antes de los chasis sigue abriendo igual", () => {
    const vieja = leer("?uh=500&gpus=" + encodeURIComponent("Vieja~80~2000~900~1.5~1"));
    expect(vieja.vista).toBe("gpus");
    expect(vieja.chasis).toEqual(CHASIS);
    // Una GPU de un enlace viejo es una GPU suelta: una sola, escalado perfecto.
    expect(vieja.gpus[0]).toMatchObject({ nombre: "Vieja", n: 1, escala: 1 });
  });

  it("una query basura de chasis no rompe, y n y σ se acotan al rango válido", () => {
    const basura = leer("?ch=%%%&vista=nada");
    expect(basura.chasis).toEqual(CHASIS);
    expect(basura.vista).toBe("gpus");

    const extremos = leer("?ch=" + ["Raro", "0", "80", "2000", "900", "10", "7", "1"].join("~"));
    expect(extremos.chasis[0].n).toBe(1); // al menos una GPU
    expect(extremos.chasis[0].escala).toBe(1); // σ no pasa de 1

    const fraccion = leer("?ch=" + ["Raro", "2.9", "80", "2000", "900", "10", "0.01", "1"].join("~"));
    expect(fraccion.chasis[0].n).toBe(2); // un número entero de GPUs
    expect(fraccion.chasis[0].escala).toBe(0.05); // σ no baja de 0.05
  });

  it("el escenario del enlace es el que se muestra al montar", () => {
    const e: Estado = { ...ESTADO_INICIAL, modo: "capacidad", Ua: 40, G: 12 };
    window.history.replaceState(null, "", "/?" + serializar(e));
    montar();
    const texto = contenedor.textContent ?? "";
    expect(texto).toContain("Frontera de capacidad con 12 GPUs");
    // Los usuarios que motor.py reporta para la H100 SXM con G=12.
    expect(texto).toContain(fmt(16388));
    window.history.replaceState(null, "", "/");
  });
});

describe("exportación a CSV", () => {
  it("la tabla exportada trae una fila por GPU y sus parámetros", async () => {
    const { aCSV } = await import("./lib/csv");
    const csv = aCSV([
      ["gpu", "G", "motivo"],
      ["H100 SXM", 3, ""],
      ['GPU, con "comillas"', 1, "sin\nsalto"],
    ]);
    const lineas = csv.split("\r\n");
    expect(lineas[0]).toBe("gpu,G,motivo");
    expect(lineas[1]).toBe("H100 SXM,3,");
    expect(csv).toContain('"GPU, con ""comillas"""');
    expect(csv).toContain('"sin\nsalto"');
  });

  it("los números salen con punto decimal y sin separador de miles", async () => {
    const { aCSV } = await import("./lib/csv");
    expect(aCSV([[1234567.891, Infinity, NaN, null]])).toBe("1234567.891,,,");
  });
});
