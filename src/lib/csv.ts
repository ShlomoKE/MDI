/**
 * Exportación de la tabla de resultados a CSV.
 *
 * Los números salen sin formato de presentación (punto decimal, sin separador
 * de miles) para que se puedan comparar directamente contra la salida de
 * `motor.py` o meter en una hoja de cálculo sin reparsear.
 */

export type Celda = string | number | boolean | null | undefined;

function celda(v: Celda): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Suficientes cifras para no perder nada al comparar contra Python.
    return String(Number(v.toPrecision(12)));
  }
  return v;
}

function escapar(s: string): string {
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function aCSV(filas: Celda[][]): string {
  return filas.map((f) => f.map((v) => escapar(celda(v))).join(",")).join("\r\n");
}

/** Arma el CSV y lo entrega al navegador como descarga. */
export function descargarCSV(nombreArchivo: string, filas: Celda[][]): void {
  // El BOM hace que Excel reconozca UTF-8 y no destroce los acentos.
  const blob = new Blob(["﻿" + aCSV(filas)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revocar en el siguiente tick: Safari necesita que el click ya haya corrido.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Nombre de archivo con la fecha, sin caracteres que molesten en Windows. */
export function nombreConFecha(base: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
}
