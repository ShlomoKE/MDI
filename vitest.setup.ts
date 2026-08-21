/**
 * React necesita saber que corre dentro de un entorno de pruebas para que
 * `act()` funcione; sin esta bandera avisa por consola en cada render.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * jsdom no implementa IntersectionObserver. En las pruebas todo cuenta como
 * visible, que es lo que hace falta para poder inspeccionar la calculadora.
 */
class ObservadorSiempreVisible implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [0];
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    ObservadorSiempreVisible as unknown as typeof IntersectionObserver;
}

export {};
