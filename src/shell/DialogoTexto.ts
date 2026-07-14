// Diálogo mínimo propio de MIA. Evita depender de prompt(), que bloquea el
// hilo, no puede estilizarse y no existe en algunos contenedores de navegador.

export function pedirTexto(titulo: string, valorInicial = ''): Promise<string | null> {
  return new Promise((resolver) => {
    const fondo = document.createElement('div');
    fondo.style.cssText =
      'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;' +
      'background:rgba(5,6,10,.72);backdrop-filter:blur(7px)';

    const formulario = document.createElement('form');
    formulario.setAttribute('role', 'dialog');
    formulario.setAttribute('aria-modal', 'true');
    formulario.setAttribute('aria-labelledby', 'mia-dialogo-titulo');
    formulario.style.cssText =
      'width:min(420px,calc(100vw - 32px));padding:20px;border-radius:12px;' +
      'background:#181922;border:1px solid rgba(255,255,255,.15);' +
      'box-shadow:0 24px 80px rgba(0,0,0,.55);color:#f2f3f7;' +
      'font:13px ui-sans-serif,system-ui,sans-serif';

    const etiqueta = document.createElement('label');
    etiqueta.id = 'mia-dialogo-titulo';
    etiqueta.textContent = titulo;
    etiqueta.style.cssText = 'display:block;margin-bottom:12px;font-size:15px;font-weight:650';

    const campo = document.createElement('input');
    campo.name = 'valor';
    campo.value = valorInicial;
    campo.autocomplete = 'off';
    campo.maxLength = 100;
    campo.style.cssText =
      'box-sizing:border-box;width:100%;padding:10px 12px;border-radius:7px;' +
      'border:1px solid rgba(255,255,255,.2);outline:none;background:#0f1017;' +
      'color:#fff;font:14px ui-sans-serif,system-ui,sans-serif';

    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
    const cancelar = boton('Cancelar', 'button', false);
    const aceptar = boton('Guardar', 'submit', true);
    acciones.append(cancelar, aceptar);
    formulario.append(etiqueta, campo, acciones);
    fondo.append(formulario);
    document.body.append(fondo);

    let terminado = false;
    const terminar = (valor: string | null) => {
      if (terminado) return;
      terminado = true;
      removeEventListener('keydown', alTeclado);
      fondo.remove();
      resolver(valor);
    };
    const alTeclado = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') terminar(null);
    };
    addEventListener('keydown', alTeclado);
    cancelar.addEventListener('click', () => terminar(null));
    fondo.addEventListener('pointerdown', (ev) => {
      if (ev.target === fondo) terminar(null);
    });
    formulario.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const valor = campo.value.trim();
      if (valor) terminar(valor);
      else campo.focus();
    });

    requestAnimationFrame(() => {
      campo.focus();
      campo.select();
    });
  });
}

export function confirmar(titulo: string, detalle: string): Promise<boolean> {
  return new Promise((resolver) => {
    const fondo = document.createElement('div');
    fondo.style.cssText =
      'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;' +
      'background:rgba(5,6,10,.72);backdrop-filter:blur(7px)';
    const caja = document.createElement('div');
    caja.setAttribute('role', 'alertdialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-label', titulo);
    caja.style.cssText =
      'width:min(420px,calc(100vw - 32px));padding:20px;border-radius:12px;' +
      'background:#181922;border:1px solid rgba(255,255,255,.15);' +
      'box-shadow:0 24px 80px rgba(0,0,0,.55);color:#f2f3f7;' +
      'font:13px ui-sans-serif,system-ui,sans-serif';
    const encabezado = document.createElement('div');
    encabezado.textContent = titulo;
    encabezado.style.cssText = 'font-size:15px;font-weight:650';
    const texto = document.createElement('p');
    texto.textContent = detalle;
    texto.style.cssText = 'margin:10px 0 0;color:#b9bac5;line-height:1.45';
    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
    const cancelar = boton('Cancelar', 'button', false);
    const aceptar = boton('Borrar', 'button', true);
    acciones.append(cancelar, aceptar);
    caja.append(encabezado, texto, acciones);
    fondo.append(caja);
    document.body.append(fondo);

    let terminado = false;
    const terminar = (resultado: boolean) => {
      if (terminado) return;
      terminado = true;
      removeEventListener('keydown', alTeclado);
      fondo.remove();
      resolver(resultado);
    };
    const alTeclado = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') terminar(false);
    };
    addEventListener('keydown', alTeclado);
    cancelar.addEventListener('click', () => terminar(false));
    aceptar.addEventListener('click', () => terminar(true));
    fondo.addEventListener('pointerdown', (ev) => {
      if (ev.target === fondo) terminar(false);
    });
    requestAnimationFrame(() => aceptar.focus());
  });
}

function boton(texto: string, tipo: 'button' | 'submit', primario: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = tipo;
  b.textContent = texto;
  b.style.cssText =
    'padding:8px 13px;border-radius:7px;border:1px solid rgba(255,255,255,.18);' +
    `background:${primario ? '#dce6ff' : '#242631'};color:${primario ? '#11131a' : '#e8e9ef'};` +
    'font:600 13px ui-sans-serif,system-ui,sans-serif;cursor:pointer';
  return b;
}
