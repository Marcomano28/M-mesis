// Fichas — figuras guardadas: preset + miniatura, persistentes en IndexedDB.
// Una ficha es una obra decantada: el estado exacto de un salón en un momento
// que te gustó, lista para recargarse o (próximamente) colocarse en el Escenario.

export interface Ficha {
  id: string;
  nombre: string;
  salonId: string;
  params: Record<string, number>;
  miniatura: string; // dataURL jpeg
  fecha: number;
  /** Carga extra del salón (p.ej. la partitura de actores de una escena). */
  extra?: unknown;
}

export class AlmacenFichas {
  private db: Promise<IDBDatabase>;

  constructor() {
    this.db = new Promise((resolver, rechazar) => {
      const req = indexedDB.open('mia-fichas', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('fichas', { keyPath: 'id' });
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => rechazar(req.error);
    });
  }

  private async store(modo: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.db).transaction('fichas', modo).objectStore('fichas');
  }

  async guardar(ficha: Ficha): Promise<void> {
    await pedir((await this.store('readwrite')).put(ficha));
  }

  async listar(): Promise<Ficha[]> {
    const todas = await pedir((await this.store('readonly')).getAll());
    return (todas as Ficha[]).sort((a, b) => b.fecha - a.fecha);
  }

  async borrar(id: string): Promise<void> {
    await pedir((await this.store('readwrite')).delete(id));
  }
}

function pedir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}
