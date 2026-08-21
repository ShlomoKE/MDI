/**
 * La página: documento arriba, calculadora al final, navegación al costado.
 *
 * Es una sola página estática. El documento viene de MDX —lo que permite meter
 * componentes React entre los párrafos— y la calculadora es el mismo motor que
 * el documento explica.
 */

import Documento from "./contenido/documento.mdx";
import SeccionCalculadora from "./components/SeccionCalculadora";
import { ANIO, AUTOR } from "./components/Cita";
import Navegacion from "./components/Navegacion";

export function App() {
  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-linea bg-superficie">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <p className="rotulo text-suave mb-3">MDI · Nota técnica</p>
          <h1 className="font-cond font-bold tracking-tight text-4xl sm:text-5xl leading-[1.05] max-w-3xl">
            Modelo de Dimensionamiento de Infraestructura de Inferencia
          </h1>
          <p className="mt-3 text-sm">
            Propuesta por{" "}
            <span className="font-semibold text-tinta">{AUTOR}</span>
            <span className="text-suave"> · {ANIO}</span>
          </p>
          <p className="mt-4 text-base sm:text-lg text-suave max-w-2xl leading-relaxed">
            Para cargas mixtas de usuarios y agentes. Tres restricciones —memoria, latencia y
            cómputo— deciden cuánto hardware hace falta para servir un modelo; abajo, una
            calculadora que las aplica a tu carga concreta.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#calculadora"
              className="inline-flex items-center gap-2 rounded border border-tinta bg-tinta px-4 py-2 text-sm text-superficie hover:opacity-90 transition-opacity"
            >
              Ir a la calculadora ↓
            </a>
            <a
              href="#cómo-citar"
              className="inline-flex items-center gap-2 rounded border border-linea bg-superficie px-4 py-2 text-sm text-tinta hover:bg-fondo transition-colors"
            >
              Cómo citar
            </a>
            <span className="text-xs text-suave">
              Todo el cálculo ocurre en tu navegador. Nada se envía a ningún servidor.
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl flex flex-col lg:flex-row lg:gap-10 lg:px-6">
        <Navegacion />
        <article
          id="documento"
          className="documento flex-1 min-w-0 px-4 sm:px-6 lg:px-0 py-8 lg:py-12"
        >
          <Documento />
        </article>
      </div>

      <SeccionCalculadora />

      <footer className="border-t border-linea bg-superficie">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-xs text-suave leading-relaxed">
          <p>
            El motor de cálculo está escrito en Python (<code className="mono">motor.py</code>) y
            portado a TypeScript sin cambiar ninguna fórmula. Las pruebas comparan los dos, valor
            por valor, con igualdad exacta de punto flotante sobre 250 escenarios.
          </p>
          <p className="mt-2">
            Los precios por hora son referenciales y editables; los duty cycles están fijados en el
            peor caso. Lee la sección de limitaciones antes de usar estos números para comprar
            hardware.
          </p>
          <p className="mt-4 pt-4 border-t border-linea">
            MDI es una propuesta de <span className="text-tinta font-medium">{AUTOR}</span>, {ANIO}.
            Si te sirve para algo publicable, hay formatos de cita listos en{" "}
            <a href="#cómo-citar" className="text-mem underline underline-offset-2">
              cómo citar
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
