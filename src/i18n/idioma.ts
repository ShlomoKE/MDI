/**
 * Los dos idiomas del sitio.
 *
 * Cada uno se publica como una página propia y completa: `/` en español y
 * `/en/` en inglés, las dos prerenderizadas. No hay cambio de idioma en
 * caliente —el selector es un enlace de una a otra— y esa es justamente la
 * gracia: quien lea en inglés comparte SU enlace, los buscadores indexan las
 * dos versiones y la cita apunta al idioma correcto.
 */

export type Idioma = "es" | "en";

export const IDIOMAS: readonly Idioma[] = ["es", "en"] as const;

export const NOMBRE_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  en: "English",
};

/** El prefijo de ruta de cada idioma. El español vive en la raíz. */
export const RUTA_IDIOMA: Record<Idioma, string> = {
  es: "/",
  en: "/en/",
};

/**
 * Deduce el idioma de una ruta. Se usa en el cliente al arrancar, para que la
 * hidratación coincida con lo que prerenderizó el build.
 */
export function idiomaDeRuta(pathname: string): Idioma {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "es";
}

/** La misma página en el otro idioma, conservando la query y el ancla. */
export function rutaAlterna(idioma: Idioma, busqueda = "", ancla = ""): string {
  return RUTA_IDIOMA[idioma] + busqueda + ancla;
}

export const OTRO_IDIOMA: Record<Idioma, Idioma> = { es: "en", en: "es" };
