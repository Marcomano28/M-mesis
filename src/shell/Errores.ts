// Panel de errores visible — ningún fallo de runtime debe ser invisible.
// Captura excepciones globales, promesas rechazadas y console.error,
// y las muestra en un banner rojo en pantalla.

export function instalarPanelErrores(): void {
  const caja = document.createElement('div');
  caja.style.cssText = [
    'position:fixed', 'bottom:8px', 'left:8px', 'right:8px', 'z-index:99999',
    'max-height:40vh', 'overflow:auto', 'display:none',
    'background:rgba(120,10,20,0.92)', 'color:#ffd9d9',
    'font:12px/1.5 ui-monospace,monospace', 'padding:10px 14px',
    'border-radius:8px', 'white-space:pre-wrap',
  ].join(';');
  document.body.appendChild(caja);

  const mostrar = (msg: string) => {
    caja.style.display = 'block';
    caja.textContent += (caja.textContent ? '\n' : '') + '✗ ' + msg;
  };

  addEventListener('error', (e) => mostrar(e.message + (e.filename ? `  (${e.filename.split('/').pop()}:${e.lineno})` : '')));
  addEventListener('unhandledrejection', (e) => mostrar('Promise: ' + (e.reason?.message ?? String(e.reason))));

  const errorOriginal = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errorOriginal(...args);
    mostrar(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  };
}
