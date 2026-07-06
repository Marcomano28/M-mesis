// Estela — canvas 2D que registra el paso del puntero con círculos radiales
// que se desvanecen. Sirve de textura de extrusión para el bajorrelieve.
// (Portado de trial.ts del proyecto immersive.)

export class Estela {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  radio: number;      // radio del círculo en px
  desvanecer: number; // alpha del velado negro por frame (0–1)

  constructor(ancho: number, alto: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ancho;
    this.canvas.height = alto;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, ancho, alto);
    this.radio = ancho * 0.1;
    this.desvanecer = 0.02;
  }

  update(puntero?: { x: number; y: number }): void {
    // Velado: la estela se apaga poco a poco
    this.ctx.fillStyle = `rgba(0, 0, 0, ${this.desvanecer})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (puntero) {
      const g = this.ctx.createRadialGradient(
        puntero.x, puntero.y, 0,
        puntero.x, puntero.y, this.radio,
      );
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.2, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(puntero.x, puntero.y, this.radio, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  redimensionar(ancho: number, alto: number): void {
    this.canvas.width = ancho;
    this.canvas.height = alto;
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, ancho, alto);
  }

  limpiar(): void {
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
