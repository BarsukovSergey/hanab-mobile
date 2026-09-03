export type PipGradient = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly { offset: number; color: string }[];
};

export type PipVectorShape = {
  d: string;
  fill?: string;
  gradient?: PipGradient;
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
};

export type PipVector = {
  shapes: readonly PipVectorShape[];
};

type PipFillRule = 'nonzero' | 'evenodd';
type Matrix = readonly [number, number, number, number, number, number];

export type RecordingGradient = {
  readonly kind: 'gradient';
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stops: Array<{ offset: number; color: string }>;
  addColorStop(offset: number, color: string): void;
};

type FillStyle = string | RecordingGradient;

type SavedState = {
  matrix: Matrix;
  fillStyle: FillStyle;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: 'miter' | 'round' | 'bevel';
};

export interface PipDrawingContext {
  fillStyle: FillStyle;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: 'miter' | 'round' | 'bevel';
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  scale(x: number, y: number): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  save(): void;
  restore(): void;
  fill(fillRule?: PipFillRule): void;
  stroke(): void;
  createLinearGradient(x1: number, y1: number, x2: number, y2: number): RecordingGradient;
}

export function recordPipVector(draw: (ctx: PipDrawingContext, colors?: readonly string[]) => void, options: {
  colors?: readonly string[];
  fill: string;
}): PipVector {
  const recorder = new PipVectorRecorder();
  recorder.fillStyle = options.fill;
  draw(recorder, options.colors);

  if (options.colors === undefined) {
    recorder.fill();
  }
  recorder.lineWidth = 3;
  recorder.strokeStyle = '#000000';
  recorder.stroke();
  return { shapes: recorder.shapes };
}

class PipVectorRecorder implements PipDrawingContext {
  readonly shapes: PipVectorShape[] = [];
  fillStyle: FillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  lineJoin: 'miter' | 'round' | 'bevel' = 'miter';

  private matrix: Matrix = [1, 0, 0, 1, 0, 0];
  private path = '';
  private gradientCounter = 0;
  private readonly stack: SavedState[] = [];

  beginPath(): void { this.path = ''; }
  closePath(): void { this.path += ' Z'; }

  moveTo(x: number, y: number): void {
    const [tx, ty] = point(this.matrix, x, y);
    this.path += ` M ${num(tx)} ${num(ty)}`;
  }

  lineTo(x: number, y: number): void {
    const [tx, ty] = point(this.matrix, x, y);
    this.path += ` L ${num(tx)} ${num(ty)}`;
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    const [a, b] = point(this.matrix, cp1x, cp1y);
    const [c, d] = point(this.matrix, cp2x, cp2y);
    const [tx, ty] = point(this.matrix, x, y);
    this.path += ` C ${num(a)} ${num(b)} ${num(c)} ${num(d)} ${num(tx)} ${num(ty)}`;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    const [a, b] = point(this.matrix, cpx, cpy);
    const [tx, ty] = point(this.matrix, x, y);
    this.path += ` Q ${num(a)} ${num(b)} ${num(tx)} ${num(ty)}`;
  }

  scale(x: number, y: number): void { this.matrix = multiply(this.matrix, [x, 0, 0, y, 0, 0]); }
  translate(x: number, y: number): void { this.matrix = multiply(this.matrix, [1, 0, 0, 1, x, y]); }
  rotate(angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.matrix = multiply(this.matrix, [cos, sin, -sin, cos, 0, 0]);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.matrix = multiply(this.matrix, [a, b, c, d, e, f]);
  }

  save(): void {
    this.stack.push({
      matrix: this.matrix,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineJoin: this.lineJoin,
    });
  }

  restore(): void {
    const saved = this.stack.pop();
    if (saved === undefined) return;
    this.matrix = saved.matrix;
    this.fillStyle = saved.fillStyle;
    this.strokeStyle = saved.strokeStyle;
    this.lineWidth = saved.lineWidth;
    this.lineJoin = saved.lineJoin;
  }

  fill(_fillRule?: PipFillRule): void {
    const d = this.path.trim();
    if (d.length === 0) return;
    if (typeof this.fillStyle === 'string') {
      this.shapes.push({ d, fill: this.fillStyle });
      return;
    }
    this.shapes.push({
      d,
      gradient: {
        id: this.fillStyle.id,
        x1: this.fillStyle.x1,
        y1: this.fillStyle.y1,
        x2: this.fillStyle.x2,
        y2: this.fillStyle.y2,
        stops: [...this.fillStyle.stops],
      },
    });
  }

  stroke(): void {
    const d = this.path.trim();
    if (d.length === 0) return;
    this.shapes.push({
      d,
      fill: 'none',
      stroke: this.strokeStyle,
      strokeWidth: this.lineWidth,
      strokeLinejoin: this.lineJoin,
    });
  }

  createLinearGradient(x1: number, y1: number, x2: number, y2: number): RecordingGradient {
    const [tx1, ty1] = point(this.matrix, x1, y1);
    const [tx2, ty2] = point(this.matrix, x2, y2);
    const gradient: RecordingGradient = {
      kind: 'gradient',
      id: `pip-gradient-${this.gradientCounter++}`,
      x1: tx1,
      y1: ty1,
      x2: tx2,
      y2: ty2,
      stops: [],
      addColorStop(offset, color) { this.stops.push({ offset, color }); },
    };
    return gradient;
  }
}

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function point(matrix: Matrix, x: number, y: number): readonly [number, number] {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

function num(value: number): string {
  const rounded = Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6));
  return String(rounded);
}
