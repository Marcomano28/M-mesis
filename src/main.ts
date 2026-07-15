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
  bajorelieve: () => new BajoRelieveSalon(),
  delaunay: () => new DelaunaySalon(),
};

const galeria = new Galeria(
  [new SupershapesSalon(), new CrossHatchSalon(), new BajoRelieveSalon(), new DelaunaySalon(), new EscenarioSalon(fabricas)],
  engine,
  bus,
);

// Fuentes vivas: LFOs (oscilan) y Acumuladores (recuerdan — Etapa 1 del templo)
const motorLFO = new MotorLFO(bus);
const motorAcum = new MotorAcumuladores(bus);
new PanelModuladores(motorLFO, motorAcum, () => galeria.destinosModulables());

// La actividad del usuario alimenta a los acumuladores:
bus.onEscritura(() => motorAcum.registrarActividad(1)); // mover cualquier slider
addEventListener('pointermove', (e) => {
  const v = (Math.abs(e.movementX) + Math.abs(e.movementY)) / 60; // velocidad del ratón
  if (v > 0.05) motorAcum.registrarActividad(Math.min(1, v));
});

// Primera mesa de mapeo: fuentes vivas normalizadas → parámetros visuales
const motorSinestesia = new MotorSinestesia(bus);
new PanelSinestesia(motorSinestesia, () => galeria.destinosModulables());

// Acceso de depuración desde la consola
(window as unknown as Record<string, unknown>).MIA = { engine, bus, galeria, motorLFO, motorAcum, motorSinestesia };

let errorLoop = false;
engine.arrancar((dt, tiempo) => {
  const salon = galeria.salonActivo;
  if (!salon) return;
  try {
    motorLFO.tick(tiempo); // los moduladores respiran antes de que el salón lea
    motorAcum.tick(dt, tiempo); // la memoria digiere la actividad (Etapa 1)
    motorSinestesia.tick(dt, tiempo); // la mesa de sinestesia escribe en el mismo plano
    salon.update(dt, tiempo, bus.deSalon(salon.id));
    errorLoop = false;
  } catch (err) {
    if (!errorLoop) {
      errorLoop = true; // reporta una vez, no 60 veces por segundo
      console.error(`Error en update() de «${salon.nombre}»:`, err);
    }
  }
});
