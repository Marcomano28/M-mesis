// MIA — punto de entrada.
// Motor + bus + galería de salones con selector.

import { instalarPanelErrores } from './shell/Errores';
import { Engine } from './core/Engine';

instalarPanelErrores();
import { ParamBus } from './core/ParamBus';
import { Galeria } from './shell/Galeria';
import { MotorLFO } from './core/Moduladores';
import { MotorAcumuladores } from './core/Acumuladores';
import { PanelModuladores } from './shell/PanelModuladores';
import { MotorSinestesia } from './core/Sinestesia';
import { PanelSinestesia } from './shell/PanelSinestesia';
import { SupershapesSalon } from './salones/supershapes/SupershapesSalon';
import { CrossHatchSalon } from './salones/crosshatch/CrossHatchSalon';
import { BajoRelieveSalon } from './salones/bajorelieve/BajoRelieveSalon';
import { DelaunaySalon } from './salones/delaunay/DelaunaySalon';
import { EscenarioSalon } from './salones/escenario/EscenarioSalon';
import { Transporte } from './core/Transporte';
import { PanelTransporte } from './shell/PanelTransporte';
import { MotorGestos } from './core/Gestos';
import { MotorBarniz, fichaBarnizPorDefecto } from './core/Barniz';
import type { EjeVector } from './core/VectorEstado';
import { PanelBarniz } from './shell/PanelBarniz';
import { MotorNarrador } from './core/Narrador';
import { PanelNarrador } from './shell/PanelNarrador';
import { MotorSemilla } from './core/Semilla';
import { PanelSemilla } from './shell/PanelSemilla';

const bus = new ParamBus();
const engine = new Engine(document.getElementById('lienzo')!);
await engine.init();

// Fábricas: cómo crear instancias nuevas de cada salón (el Escenario las usa
// para montar actores independientes a partir de fichas)
const fabricas = {
  // En el escenario Formas Exóticas solo construye la familia usada por la
  // ficha, no los cuatro camerinos completos.
  supershapes: (ficha: { params: Record<string, number> }) => new SupershapesSalon(ficha.params.modo),
  crosshatch: (ficha: { extra?: unknown }) => new CrossHatchSalon(ficha.extra),
  bajorelieve: (ficha: { extra?: unknown }) => new BajoRelieveSalon(ficha.extra),
  delaunay: () => new DelaunaySalon(),
};

// El transporte y los motores existen antes que el Escenario para que DocumentoEscena v3
// pueda guardar y restaurar la manera de tocar cada actor.
const transporte = new Transporte();
const motorLFO = new MotorLFO(bus);
const motorAcum = new MotorAcumuladores(bus);
const motorSinestesia = new MotorSinestesia(bus, transporte);
const motorGestos = new MotorGestos(bus);
const motorBarniz = new MotorBarniz(bus); // el paisaje de coherencia (biblia, Anexo I)
const motorNarrador = new MotorNarrador(motorBarniz); // el órgano del tiempo (Etapa 7)
const motorSemilla = new MotorSemilla(bus); // la ontogénesis visual (Etapa 3)
const escenario = new EscenarioSalon(fabricas, bus, {
  sinestesia: motorSinestesia,
  lfo: motorLFO,
  acumuladores: motorAcum,
  transporte,
  gestos: motorGestos,
  barniz: motorBarniz,
  narrador: motorNarrador,
  semilla: motorSemilla,
});

const galeria = new Galeria(
  [new SupershapesSalon(), new CrossHatchSalon(), new BajoRelieveSalon(), new DelaunaySalon(), escenario],
  engine,
  bus,
  motorGestos,
);
escenario.conectarCamerino((actorId, ficha, alDevolver) => {
  galeria.iniciarRetoqueActor(actorId, ficha, alDevolver);
});
galeria.onCambioDestinos(() => {
  motorSinestesia.refrescarDestinos();
  motorLFO.refrescarDestinos();
});
const panelTransporte = new PanelTransporte(transporte);

// Fuentes vivas: LFOs (oscilan) y Acumuladores (recuerdan — Etapa 1 del templo)
new PanelModuladores(motorLFO, motorAcum, () => galeria.destinosModulables());

// La actividad del usuario alimenta a los acumuladores:
bus.onEscritura(() => motorAcum.registrarActividad(1)); // mover cualquier slider
addEventListener('pointermove', (e) => {
  const v = (Math.abs(e.movementX) + Math.abs(e.movementY)) / 60; // velocidad del ratón
  if (v > 0.05) motorAcum.registrarActividad(Math.min(1, v));
});

// Primera mesa de mapeo: fuentes vivas normalizadas → parámetros visuales.
// Excluye las direcciones protegidas por el Barniz (tono/paleta): la música
// nunca escribe el color directamente (biblia, Anexo I §V).
new PanelSinestesia(motorSinestesia, () => {
  const protegidas = motorBarniz.direccionesProtegidas();
  return galeria.destinosModulables().filter((d) => !protegidas.has(d.dir));
});

// Deriva los ejes del Barniz de las direcciones con rango del salón activo.
function ejesDelSalon(): EjeVector[] {
  return galeria.destinosModulables().map((h): EjeVector => {
    bus.registrarRango(h.dir, h.min, h.max);
    const texto = h.dir + ' ' + h.etiqueta;
    const paleta = /tono|hue|color|satur|paleta|brillo/i.test(texto);
    return {
      direccion: h.dir,
      circular: /tono|hue|color/i.test(texto),
      familia: paleta ? 'paleta' : 'forma',
    };
  });
}

// Panel del Barniz: monitores de energía, afinación y transición A↔B.
new PanelBarniz(motorBarniz, ejesDelSalon);

// Panel del Narrador: repertorio de barnices, umbrales y bitácora de decisiones.
new PanelNarrador(motorNarrador);

// Panel de la Semilla: el diafragma de manifestación (etapa, apertura, protocolo).
new PanelSemilla(motorSemilla, () => ejesDelSalon().map((e) => e.direccion));

// Acceso de depuración desde la consola.
// `armarBarniz(ejes?)` monta el paisaje sobre un conjunto de direcciones del bus
// (si se omite, usa las direcciones con rango del salón activo) y lo enciende.
function armarBarniz(ejes?: EjeVector[]): void {
  motorBarniz.aplicar(fichaBarnizPorDefecto(ejes ?? ejesDelSalon()));
  motorBarniz.encender();
  console.info(`Barniz armado sobre ${motorBarniz.ficha?.ejes.length ?? 0} ejes.`);
}

(window as unknown as Record<string, unknown>).MIA = {
  engine, bus, galeria, transporte, motorLFO, motorAcum, motorSinestesia, motorGestos,
  motorBarniz, armarBarniz, motorNarrador, motorSemilla,
};

let errorLoop = false;
engine.arrancar((dt, tiempo) => {
  const marco = transporte.tick();
  panelTransporte.actualizar();
  const salon = galeria.salonActivo;
  if (!salon) return;
  try {
    // Los camerinos conservan el reloj libre de modelado. Solo el Escenario
    // obedece play/stop y el reloj musical común.
    const enEscenario = salon.id === 'escenario';
    const deltaObra = enEscenario ? marco.delta : dt;
    const tiempoObra = enEscenario ? marco.tiempo : tiempo;
    motorLFO.tick(tiempoObra);
    motorAcum.tick(deltaObra, tiempoObra);
    motorSinestesia.tick(deltaObra, tiempoObra, enEscenario ? marco.bpm : 15);
    motorGestos.tick(deltaObra);
    // Métricas de Frase: máximo por tipo de acumulador (la historia de la señal).
    let tension = 0, densidad = 0, meseta = 0;
    for (const a of motorAcum.acumuladores) {
      if (a.proceso === 'tension') tension = Math.max(tension, a.valor);
      else if (a.proceso === 'densidad') densidad = Math.max(densidad, a.valor);
      else if (a.proceso === 'meseta') meseta = Math.max(meseta, a.valor);
    }
    // El Narrador lee la historia y dirige (transiciona el barniz, sesga la temperatura).
    motorNarrador.tick(deltaObra, { tension, densidad, meseta });
    // La Semilla abre el diafragma de manifestación: germinación ganada de la
    // música, o dirigida por el Narrador (transiciones de etapa) si dirige.
    const objetivoApertura = motorNarrador.activo ? motorNarrador.objetivoApertura : null;
    motorSemilla.tick(deltaObra, { tension, densidad, meseta }, objetivoApertura);
    // El Barniz corrige DESPUÉS de que música y memoria ya empujaron el estado.
    // Su temperatura la gobierna la tensión, sesgada por el Narrador si dirige.
    const sesgo = motorNarrador.activo ? motorNarrador.sesgoTemperatura : 1;
    motorBarniz.fijarTension(tension * sesgo);
    motorBarniz.tick(deltaObra);
    salon.update(deltaObra, tiempoObra, bus.deSalon(salon.id));
    errorLoop = false;
  } catch (err) {
    if (!errorLoop) {
      errorLoop = true; // reporta una vez, no 60 veces por segundo
      console.error(`Error en update() de «${salon.nombre}»:`, err);
    }
  }
});
