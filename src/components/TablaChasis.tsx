/**
 * La tabla de los chasis del catálogo, dentro del documento.
 *
 * No se escribe a mano: sale del mismo catálogo que usa la calculadora, así que
 * el precio que lee el lector es, por construcción, el que se calcula. Junto a
 * cada precio por hora va el precio de lista del que sale, de dónde se tomó y
 * cuándo, porque un precio sin procedencia no sirve para comparar.
 */

import { useIdioma, useTextos } from "../i18n/contexto";
import {
  AMORTIZACION_ANIOS,
  CHASIS,
  OPEX_ANUAL,
  PUE,
  REFERENCIA_CHASIS,
  USD_KWH,
} from "../lib/catalogos";
import { fmt, fmtGB, usd } from "../lib/formato";

export function TablaChasis() {
  const t = useTextos();
  const idioma = useIdioma();
  const c = t.chasis;

  return (
    <>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={c.caption}>
        <table style={{ minWidth: 640 }}>
          <caption className="sr-only">{c.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{c.colChasis}</th>
              <th scope="col">{c.colGPUs}</th>
              <th scope="col">{c.colMemoria}</th>
              <th scope="col">{c.colLista}</th>
              <th scope="col">{c.colHora}</th>
              <th scope="col">{c.colHoraGPU}</th>
            </tr>
          </thead>
          <tbody>
            {CHASIS.map((g) => {
              const ref = REFERENCIA_CHASIS[g.id];
              return (
                <tr key={g.id}>
                  <td>
                    {g.nombre}
                    {ref && (
                      <>
                        {" "}
                        <a
                          href={ref.fuente.url}
                          rel="noopener noreferrer"
                          className="text-xs"
                          style={{ color: "var(--color-comp)" }}
                        >
                          {ref.fuente.nombre}
                        </a>
                        {ref.nota && (
                          <span
                            className="block text-xs"
                            style={{
                              color: "var(--color-suave)",
                              fontFamily: "var(--font-sans)",
                              textAlign: "left",
                              fontWeight: 400,
                            }}
                          >
                            {ref.nota[idioma]}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td>{g.n}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtGB(g.n * g.vram_gb)} GB</td>
                  <td>
                    {ref ? usd(ref.usd, 0) : "—"}
                    {ref && (
                      <span
                        className="block text-xs"
                        style={{ color: "var(--color-suave)", fontFamily: "var(--font-sans)" }}
                      >
                        {c.confianza[ref.confianza]}
                      </span>
                    )}
                  </td>
                  <td>{usd(g.precio_hora)}</td>
                  <td>{usd(g.precio_hora / g.n)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm" style={{ color: "var(--color-suave)" }}>
        {c.notaRegla(
          fmt(AMORTIZACION_ANIOS),
          fmt(OPEX_ANUAL * 100),
          fmt(USD_KWH, 2),
          fmt(PUE, 1),
        )}
      </p>
    </>
  );
}

export default TablaChasis;
