/**
 * El nombre visible de cada restricción.
 *
 * Vivía en `formato.ts`, pero ese archivo es la capa de presentación de
 * números y no debe saber de idiomas. Aquí toma el diccionario vigente y
 * devuelve la palabra: "memoria" o "memory", según la página.
 *
 * Los valores que usa el motor —"memoria", "latencia", "computo"— NO se
 * traducen: son la salida de motor.py y viajan tal cual al CSV y a las pruebas
 * de paridad. Lo que se traduce es solo cómo se enseñan.
 */

import type { Cuello } from "../lib/motor";
import type { Textos } from "./textos";

export function nombreCuello(t: Textos, k: Cuello | "" | null | undefined): string {
  if (k === "memoria" || k === "latencia" || k === "computo") return t.cuellos[k];
  return t.cuellos.ninguno;
}
