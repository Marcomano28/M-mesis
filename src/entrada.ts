// El ensayo es una entrada explícita: el taller y sus fichas conservan su flujo.
if (new URLSearchParams(location.search).get('ensayo') === 'caracol') {
  import('./ensayo/EnsayoCaracol').catch(mostrarError);
} else {
  import('./main').then(() => {
    const a = document.createElement('a');
    a.href = '?ensayo=caracol';
    a.textContent = '↗ Ensayo · Caracol vivo';
    a.style.cssText = 'position:fixed;bottom:8px;left:190px;z-index:30;color:#e9c8a1;font:12px system-ui;text-decoration:none';
    document.body.appendChild(a);
  }).catch(mostrarError);
}

function mostrarError(error: unknown): void {
  console.error(error);
  const aviso = document.createElement('p');
  aviso.style.cssText = 'position:fixed;inset:30% 15%;z-index:100;color:#ffd6b0;font:18px system-ui;white-space:pre-wrap';
  aviso.textContent = `No se pudo abrir MIA.\n${error instanceof Error ? error.message : String(error)}\nRecarga la página o prueba un navegador con WebGL2/WebGPU.`;
  document.body.appendChild(aviso);
}
