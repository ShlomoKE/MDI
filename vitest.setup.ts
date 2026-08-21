/**
 * React necesita saber que corre dentro de un entorno de pruebas para que
 * `act()` funcione; sin esta bandera avisa por consola en cada render.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

export {};
