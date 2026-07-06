// MIA — punto de entrada.
// Motor + bus + galería de salones con selector.

import { instalarPanelErrores } from './shell/Errores';
import { Engine } from './core/Engine';

instalarPanelErrores();
import { ParamBus } from './core/ParamBus';
import { Galeria } from './shell/Galeria';
import { MotorLFO } from './core/Moduladores';
import { PanelModuladores } from './shell/PanelModuladores';
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
  supershapes: () => new SupershapesSalon(),
  crosshatch: () => new CrossHatchSalon(),
  bajorelieve: () => new BajoRelieveSalon(),
  delaunay: () => new DelaunaySalon(),
};

const galeria = new Galeria(
  [new SupershapesSalon(), new CrossHatchSalon(), new BajoRelieveSalon(), new DelaunaySalon(), new EscenarioSalon(fabricas)],
  engine,
  bus,
);

// Capa de animación: LFOs escribiendo en el plano de modulación del bus
const motorLFO = new MotorLFO(bus);
new PanelModuladores(motorLFO, () => galeria.destinosModulables());

// Acceso de depuración desde la consola
(window as unknown as Record<string, unknown>).MIA = { engine, bus, galeria, motorLFO };

let errorLoop = false;
engine.arrancar((dt, tiempo) => {
  const salon = galeria.salonActivo;
  if (!salon) return;
  try {
    motorLFO.tick(tiempo); // los moduladores respiran antes de que el salón lea
    salon.update(dt, tiempo, bus.deSalon(salon.id));
    errorLoop = false;
  } catch (err) {
    if (!errorLoop) {
      errorLoop = true; // reporta una vez, no 60 veces por segundo
      console.error(`Error en update() de «${salon.nombre}»:`, err);
    }
  }
});
