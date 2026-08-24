/**
 * Por qué una GPU no sirve, en el idioma del lector.
 *
 * El motor ya trae un `motivo` listo —"SLO de 30 ms inalcanzable en L40S"— pero
 * ese texto NO se puede traducir: es una copia byte por byte de lo que devuelve
 * `motor.py`, viaja al CSV y lo comparan las pruebas de paridad y
 * `scripts/comparar.mjs`. Tocarlo rompería el criterio de aceptación.
 *
 * La salida es no enseñarlo nunca y reconstruir el mensaje aquí, a partir de
 * los mismos hechos que lo generaron: si el techo de memoria es negativo el
 * modelo no cabe, y si el negativo es el de latencia el SLO es inalcanzable.
 * No hay que parsear nada.
 *
 * La versión española reproduce la de motor.py palabra por palabra —incluido el
 * formato `%g` del SLO— para que la página en español siga siendo comparable
 * contra la salida de Python. La inglesa es la traducción.
 */

import { formatoG, type Techos } from "../lib/motor";
import type { Textos } from "./textos";

export function motivoDe(
  t: Textos,
  techos: Techos,
  modelo: string,
  gpu: string,
  slo_ms: number,
): string {
  if (techos.viable) return "";
  // El mismo orden de comprobación que `techos()` en motor.py: primero memoria.
  if (techos.memoria <= 0) return t.motivo.noCabe(modelo, gpu);
  return t.motivo.sloInalcanzable(formatoG(slo_ms), gpu);
}
