/**
 * El criterio de aceptación, automatizado.
 *
 * Corre `python motor.py`, abre el sitio construido en un Chrome real y compara
 * las tablas que imprime Python contra las que pinta la página, celda por celda,
 * con los mismos parámetros. La calculadora arranca justo en el escenario de la
 * demo de motor.py, así que no hay que tocar ningún campo.
 *
 * Son tres comparaciones: la tabla de GPUs sueltas (`?vista=gpus`), la de chasis
 * completos (`?vista=chasis`) y la vista por defecto, `?vista=ambos`, que trae las
 * dos juntas y tiene que dar, fila por fila, los mismos números que las separadas.
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort   # en otra terminal
 *   npm i -D --no-save chrome-launcher puppeteer-core
 *   node scripts/comparar.mjs
 *
 * Las pruebas de `npm test` ya verifican la paridad del motor sobre cientos de
 * escenarios con igualdad exacta de punto flotante; esto verifica el último
 * tramo, el que va del motor a los píxeles: que la capa de presentación no
 * deforme el número por el camino.
 */

import { execFileSync } from "node:child_process";
import { launch } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const base = process.argv[2] || "http://localhost:4173";

// --------------------------------------------------------------------------- //
// 1. La salida de Python
// --------------------------------------------------------------------------- //

const salida = execFileSync("python", ["motor.py"], {
  encoding: "utf8",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

/**
 * Las filas de las dos tablas de dimensionar: nombre, G, cuello, TPOT, tok/s,
 * USD/h. La salida las separa con un título; la tabla de capacidad del final
 * tiene otro formato y no se compara aquí.
 */
const python = { gpus: new Map(), chasis: new Map() };
let seccion = "gpus";
for (const cruda of salida.split("\n")) {
  // En JavaScript `.` no coincide con \r, así que con finales de línea de
  // Windows los patrones de abajo fallarían por el último carácter.
  const linea = cruda.replace(/\r$/, "");
  if (linea.startsWith("Chasis completos")) seccion = "chasis";
  else if (linea.startsWith("Capacidad")) seccion = "capacidad";
  if (!python[seccion]) continue;

  const m = linea.match(
    /^(.{1,16}?)\s{2,}(\d+)\s+(memoria|latencia|computo)\s+([\d.]+)m\s+([\d.]+)\s+([\d.]+)\s*$/,
  );
  if (m) {
    python[seccion].set(m[1].trim(), {
      G: Number(m[2]),
      cuello: m[3],
      tpot: Number(m[4]),
      tokS: Number(m[5]),
      usd: Number(m[6]),
    });
    continue;
  }
  const inviable = linea.match(/^(.{1,16}?)\s{2,}(SLO de .+|.+ no cabe en .+)$/);
  if (inviable) python[seccion].set(inviable[1].trim(), { motivo: inviable[2].trim() });
}

if (!python.gpus.size || !python.chasis.size) {
  console.error("No se pudieron leer las tablas de motor.py. ¿Cambió el formato del demo?");
  process.exit(1);
}

// --------------------------------------------------------------------------- //
// 2. Lo que muestra el sitio
// --------------------------------------------------------------------------- //

const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
let fallos = 0;

const num = (s) => Number(String(s).replace(/[^\d.,-]/g, "").replace(/,/g, ""));

/** Abre la calculadora en `ruta` y compara su tabla contra las filas de Python. */
async function comparar(browser, titulo, ruta, filasPython) {
  const page = await browser.newPage();
  await page.goto(base + ruta, { waitUntil: "networkidle0" });
  await page.waitForSelector("#calculadora table tbody tr", { timeout: 10000 });

  const sitio = await page.$$eval("#calculadora table tbody tr", (filas) =>
    filas.map((tr) => {
      const celdas = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim());
      return { nombre: tr.querySelector("td span")?.textContent.trim() ?? celdas[0], celdas };
    }),
  );
  await page.close();

  console.log(
    "\n" +
      titulo.padEnd(15) +
      "| G  py/web | cuello  py/web      | TPOT ms py/web   | USD/h py/web",
  );
  console.log("-".repeat(88));

  for (const [nombre, py] of filasPython) {
    const fila = sitio.find((f) => f.nombre === nombre);
    if (!fila) {
      console.log(`${nombre.padEnd(15)}| no aparece en la tabla del sitio`);
      fallos++;
      continue;
    }

    if (py.motivo) {
      // Las unidades inviables muestran el motivo, textual, en vez de números.
      const texto = fila.celdas.join(" ");
      const igual = texto.includes(py.motivo);
      console.log(`${nombre.padEnd(15)}| ${igual ? "=" : "≠"} «${py.motivo}»`);
      if (!igual) fallos++;
      continue;
    }

    // celdas: [nombre, VRAM, GB/s, precio, G, presión, TPOT, tok/s, costo, borrar].
    // La celda de G de un chasis trae además «(8 GPUs)»: se lee el primer entero.
    const web = {
      G: Number.parseInt(fila.celdas[4], 10),
      tpot: num(fila.celdas[6]),
      tokS: num(fila.celdas[7]),
      usd: num(fila.celdas[8]),
    };

    const ok =
      web.G === py.G &&
      Math.abs(web.tpot - py.tpot) < 0.05 &&
      Math.abs(web.tokS - py.tokS) < 0.05 &&
      Math.abs(web.usd - py.usd) < 0.005;

    console.log(
      `${nombre.padEnd(15)}| ${ok ? "=" : "≠"} ${String(py.G).padStart(2)}/${String(web.G).padEnd(2)} ` +
        `| ${py.cuello.padEnd(8)}         ` +
        `| ${py.tpot.toFixed(1)}/${web.tpot.toFixed(1)}        ` +
        `| ${py.usd.toFixed(2)}/${web.usd.toFixed(2)}`,
    );
    if (!ok) fallos++;
  }

  // Que la página no muestre filas que Python no conoce: una unidad de más o
  // de menos en el catálogo de la web también es una discrepancia.
  const extra = sitio.filter((f) => !filasPython.has(f.nombre)).map((f) => f.nombre);
  if (extra.length) {
    console.log(`${"".padEnd(15)}| filas del sitio que Python no imprime: ${extra.join(", ")}`);
    fallos++;
  }
}

try {
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chrome.port}`,
    defaultViewport: { width: 1600, height: 1000 },
  });

  await comparar(browser, "GPU", "/?vista=gpus#calculadora", python.gpus);
  await comparar(browser, "Chasis", "/?vista=chasis#calculadora", python.chasis);
  // Sin ninguna query: lo que ve quien abre la página.
  await comparar(browser, "Ambos", "/#calculadora", new Map([...python.gpus, ...python.chasis]));

  await browser.disconnect();
} finally {
  try {
    await chrome.kill();
  } catch {
    /* Chrome ya se fue */
  }
}

console.log(
  fallos
    ? `\n${fallos} discrepancias: la calculadora NO reproduce motor.py`
    : "\nTodas las filas coinciden hasta el redondeo de presentación.",
);
process.exitCode = fallos ? 1 : 0;
