import './vestuario.css';
import type { Vestuario } from './AlmacenDisfraces';

/** Editor reutilizable: recibe un vestuario, nunca un tipo de actor. */
export function crearPanelVestuario(vestuario: Vestuario, alCambiar: () => void): { abrir(): void; dispose(): void } {
  const dialogo = document.createElement('dialog'); dialogo.className = 'almacen-vestuario';
  const titulo = document.createElement('h2'); titulo.textContent = 'El almacén de disfraces';
  const intro = document.createElement('p'); intro.textContent = 'Combina prendas sobre el mismo cuerpo. Cambiar de vestido conserva su desarrollo y su memoria.';
  const cerrar = document.createElement('button'); cerrar.textContent = 'Volver al personaje'; cerrar.addEventListener('click', () => dialogo.close());
  const contenido = document.createElement('div');
  dialogo.append(titulo, intro, cerrar, contenido); document.body.append(dialogo);
  function dibujar(): void {
    contenido.replaceChildren();
    const capas = vestuario.configuracion();
    for (const d of vestuario.almacen.listar()) {
      const capa = capas.find(c => c.id === d.id), compatible = vestuario.compatible(d);
      const fila = document.createElement('section'); fila.className = 'prenda';
      const label = document.createElement('label'), check = document.createElement('input');
      check.type = 'checkbox'; check.checked = !!capa; check.disabled = !compatible;
      label.append(check, document.createTextNode(d.nombre));
      const descripcion = document.createElement('p'); descripcion.textContent = compatible ? d.descripcion : 'Este actor todavía no dispone de la conexión necesaria.';
      fila.append(label, descripcion);
      check.addEventListener('change', () => {
        if (check.checked) vestuario.configurar(d.id, 1); else vestuario.quitar(d.id);
        alCambiar(); dibujar();
      });
      if (capa) {
        for (const [clave, nombre] of [['intensidad', 'Presencia'], ['detalle', d.control]] as const) {
          const control = document.createElement('label'); control.textContent = nombre;
          const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.01'; input.value = String(capa[clave]);
          input.setAttribute('aria-label', `${d.nombre}: ${nombre}`);
          input.addEventListener('input', () => { capa[clave] = Number(input.value); vestuario.configurar(d.id, capa.intensidad, capa.detalle); alCambiar(); });
          control.append(input); fila.append(control);
        }
      }
      if (capa) for (const c of d.controles ?? []) {
        if (c.oculto) continue;
        const label = document.createElement('label'); label.textContent = c.nombre;
        if (c.opciones) {
          const select = document.createElement('select'); select.setAttribute('aria-label', `${d.nombre}: ${c.nombre}`);
          for (const o of c.opciones) { const opt = document.createElement('option'); opt.value = String(o.valor); opt.textContent = o.nombre; select.append(opt); }
          select.value = String(capa.parametros?.[c.clave] ?? c.valor);
          select.addEventListener('change', () => { vestuario.configurar(d.id, capa.intensidad, capa.detalle, { [c.clave]: Number(select.value) }); alCambiar(); });
          label.append(select); fila.append(label); continue;
        }
        const input = document.createElement('input'); input.type = 'range';
        input.min = String(c.min); input.max = String(c.max); input.step = String(c.paso);
        input.value = String(capa.parametros?.[c.clave] ?? c.valor);
        input.setAttribute('aria-label', `${d.nombre}: ${c.nombre}`);
        const valor = document.createElement('output'); valor.textContent = input.value;
        input.addEventListener('input', () => {
          const n = Number(input.value); valor.textContent = input.value;
          vestuario.configurar(d.id, capa.intensidad, capa.detalle, { [c.clave]: n }); alCambiar();
        });
        label.append(input, valor); fila.append(label);
      }
      contenido.append(fila);
    }
  }
  return { abrir() { dibujar(); dialogo.showModal(); }, dispose() { dialogo.remove(); } };
}
