type Matrix = readonly [number, number, number, number, number, number];

type Point = {
  x: number;
  y: number;
};

type GradientStop = {
  offset: number;
  color: string;
};

class SvgLinearGradient {
  readonly stops: GradientStop[] = [];

  constructor(
    readonly id: string,
    readonly start: Point,
    readonly end: Point,
  ) {}

  addColorStop(offset: number, color: string): void {
    this.stops.push({ offset, color });
  }
}

type Paint = string | SvgLinearGradient;

type DrawState = {
  fillStyle: Paint;
  strokeStyle: Paint;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  lineDash: readonly number[];
  matrix: Matrix;
};

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const TAU = Math.PI * 2;
const EPSILON = 1e-9;

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function transformPoint(matrix: Matrix, x: number, y: number): Point {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  };
}

function effectiveScale(matrix: Matrix): number {
  const [a, b, c, d] = matrix;
  return Math.sqrt(Math.abs(a * d - b * c));
}

function formatNumber(value: number): string {
  if (Math.abs(value) < EPSILON) {
    return "0";
  }

  return Number(value.toFixed(6)).toString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function attributes(values: Record<string, string | number | undefined>): string {
  return Object.entries(values)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");
}

function normalizeSweep(start: number, end: number, counterClockwise: boolean): number {
  let delta = end - start;

  if (!counterClockwise) {
    if (delta >= TAU) {
      return TAU;
    }
    while (delta < 0) {
      delta += TAU;
    }
    return delta;
  }

  if (delta <= -TAU) {
    return -TAU;
  }
  while (delta > 0) {
    delta -= TAU;
  }
  return delta;
}

function parseFont(font: string): {
  family: string;
  size: string;
  weight?: string;
  style?: string;
} {
  const match = /^(?:(italic|oblique)\s+)?(?:(bold|[1-9]00)\s+)?([\d.]+(?:px|pt|em|rem))\s+(.+)$/i.exec(
    font.trim(),
  );
  if (match === null) {
    return { family: "sans-serif", size: "10px" };
  }

  return {
    style: match[1],
    weight: match[2],
    size: match[3]!,
    family: match[4]!,
  };
}

function textAnchor(textAlign: string): string {
  switch (textAlign) {
    case "center":
      return "middle";
    case "right":
    case "end":
      return "end";
    default:
      return "start";
  }
}

function dominantBaseline(textBaseline: string): string {
  switch (textBaseline) {
    case "top":
      return "text-before-edge";
    case "middle":
      return "central";
    case "bottom":
      return "text-after-edge";
    case "hanging":
      return "hanging";
    default:
      return "alphabetic";
  }
}

export class SvgCanvasContext {
  fillStyle: Paint = "#000000";
  strokeStyle: Paint = "#000000";
  lineWidth = 1;
  lineJoin = "miter";
  lineCap = "butt";
  globalAlpha = 1;
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  shadowColor = "#000000";
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  shadowBlur = 0;
  filter = "none";

  private matrix: Matrix = IDENTITY;
  private readonly stack: DrawState[] = [];
  private readonly gradients: SvgLinearGradient[] = [];
  private readonly elements: string[] = [];
  private path: string[] = [];
  private currentPoint: Point | undefined;
  private lineDash: readonly number[] = [];
  private nextGradientId = 0;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  save(): void {
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineJoin: this.lineJoin,
      lineCap: this.lineCap,
      globalAlpha: this.globalAlpha,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      lineDash: [...this.lineDash],
      matrix: this.matrix,
    });
  }

  restore(): void {
    const state = this.stack.pop();
    if (state === undefined) {
      return;
    }

    this.fillStyle = state.fillStyle;
    this.strokeStyle = state.strokeStyle;
    this.lineWidth = state.lineWidth;
    this.lineJoin = state.lineJoin;
    this.lineCap = state.lineCap;
    this.globalAlpha = state.globalAlpha;
    this.font = state.font;
    this.textAlign = state.textAlign;
    this.textBaseline = state.textBaseline;
    this.lineDash = state.lineDash;
    this.matrix = state.matrix;
  }

  translate(x: number, y: number): void {
    this.matrix = multiply(this.matrix, [1, 0, 0, 1, x, y]);
  }

  scale(x: number, y = x): void {
    this.matrix = multiply(this.matrix, [x, 0, 0, y, 0, 0]);
  }

  rotate(angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.matrix = multiply(this.matrix, [cos, sin, -sin, cos, 0, 0]);
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.matrix = multiply(this.matrix, [a, b, c, d, e, f]);
  }

  beginPath(): void {
    this.path = [];
    this.currentPoint = undefined;
  }

  closePath(): void {
    if (this.path.length > 0) {
      this.path.push("Z");
    }
  }

  moveTo(x: number, y: number): void {
    const point = transformPoint(this.matrix, x, y);
    this.path.push(`M ${formatNumber(point.x)} ${formatNumber(point.y)}`);
    this.currentPoint = point;
  }

  lineTo(x: number, y: number): void {
    const point = transformPoint(this.matrix, x, y);
    if (this.currentPoint === undefined) {
      this.path.push(`M ${formatNumber(point.x)} ${formatNumber(point.y)}`);
    } else {
      this.path.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`);
    }
    this.currentPoint = point;
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    const cp1 = transformPoint(this.matrix, cp1x, cp1y);
    const cp2 = transformPoint(this.matrix, cp2x, cp2y);
    const point = transformPoint(this.matrix, x, y);
    this.path.push(
      `C ${formatNumber(cp1.x)} ${formatNumber(cp1.y)} ${formatNumber(cp2.x)} ${formatNumber(cp2.y)} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    );
    this.currentPoint = point;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    const cp = transformPoint(this.matrix, cpx, cpy);
    const point = transformPoint(this.matrix, x, y);
    this.path.push(
      `Q ${formatNumber(cp.x)} ${formatNumber(cp.y)} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    );
    this.currentPoint = point;
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.closePath();
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterClockwise = false,
  ): void {
    this.ellipse(
      x,
      y,
      radius,
      radius,
      0,
      startAngle,
      endAngle,
      counterClockwise,
    );
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterClockwise = false,
  ): void {
    const sweep = normalizeSweep(startAngle, endAngle, counterClockwise);
    if (Math.abs(sweep) < EPSILON) {
      return;
    }

    const segments = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const delta = sweep / segments;
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);

    const pointAt = (angle: number): Point => ({
      x: x + radiusX * Math.cos(angle) * cosRotation - radiusY * Math.sin(angle) * sinRotation,
      y: y + radiusX * Math.cos(angle) * sinRotation + radiusY * Math.sin(angle) * cosRotation,
    });
    const derivativeAt = (angle: number): Point => ({
      x: -radiusX * Math.sin(angle) * cosRotation - radiusY * Math.cos(angle) * sinRotation,
      y: -radiusX * Math.sin(angle) * sinRotation + radiusY * Math.cos(angle) * cosRotation,
    });

    const start = pointAt(startAngle);
    const transformedStart = transformPoint(this.matrix, start.x, start.y);
    if (this.currentPoint === undefined) {
      this.path.push(
        `M ${formatNumber(transformedStart.x)} ${formatNumber(transformedStart.y)}`,
      );
    } else {
      this.path.push(
        `L ${formatNumber(transformedStart.x)} ${formatNumber(transformedStart.y)}`,
      );
    }
    this.currentPoint = transformedStart;

    let t0 = startAngle;
    for (let index = 0; index < segments; index += 1) {
      const t1 = t0 + delta;
      const p0 = pointAt(t0);
      const p1 = pointAt(t1);
      const d0 = derivativeAt(t0);
      const d1 = derivativeAt(t1);
      const factor = (4 / 3) * Math.tan(delta / 4);
      const cp1 = {
        x: p0.x + factor * d0.x,
        y: p0.y + factor * d0.y,
      };
      const cp2 = {
        x: p1.x - factor * d1.x,
        y: p1.y - factor * d1.y,
      };
      const transformedCp1 = transformPoint(this.matrix, cp1.x, cp1.y);
      const transformedCp2 = transformPoint(this.matrix, cp2.x, cp2.y);
      const transformedP1 = transformPoint(this.matrix, p1.x, p1.y);
      this.path.push(
        `C ${formatNumber(transformedCp1.x)} ${formatNumber(transformedCp1.y)} ${formatNumber(transformedCp2.x)} ${formatNumber(transformedCp2.y)} ${formatNumber(transformedP1.x)} ${formatNumber(transformedP1.y)}`,
      );
      this.currentPoint = transformedP1;
      t0 = t1;
    }
  }

  fill(fillRule: string = "nonzero"): void {
    if (this.path.length === 0) {
      return;
    }
    this.elements.push(
      `<path${attributes({
        d: this.path.join(" "),
        fill: this.paintValue(this.fillStyle),
        "fill-rule": fillRule === "evenodd" ? "evenodd" : undefined,
        "fill-opacity": this.globalAlpha === 1 ? undefined : formatNumber(this.globalAlpha),
        stroke: "none",
      })}/>` ,
    );
  }

  stroke(): void {
    if (this.path.length === 0) {
      return;
    }
    const width = this.lineWidth * effectiveScale(this.matrix);
    this.elements.push(
      `<path${attributes({
        d: this.path.join(" "),
        fill: "none",
        stroke: this.paintValue(this.strokeStyle),
        "stroke-width": formatNumber(width),
        "stroke-linejoin": this.lineJoin,
        "stroke-linecap": this.lineCap,
        "stroke-dasharray": this.lineDash.length === 0
          ? undefined
          : this.lineDash.map(formatNumber).join(","),
        "stroke-opacity": this.globalAlpha === 1 ? undefined : formatNumber(this.globalAlpha),
      })}/>` ,
    );
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const previousPath = this.path;
    const previousPoint = this.currentPoint;
    this.beginPath();
    this.rect(x, y, width, height);
    this.fill();
    this.path = previousPath;
    this.currentPoint = previousPoint;
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    const previousPath = this.path;
    const previousPoint = this.currentPoint;
    this.beginPath();
    this.rect(x, y, width, height);
    this.stroke();
    this.path = previousPath;
    this.currentPoint = previousPoint;
  }

  clearRect(): void {
    // Card rendering starts with a fresh context, so partial clear operations are not needed.
  }

  createLinearGradient(x1: number, y1: number, x2: number, y2: number): SvgLinearGradient {
    const gradient = new SvgLinearGradient(
      `g${this.nextGradientId}`,
      transformPoint(this.matrix, x1, y1),
      transformPoint(this.matrix, x2, y2),
    );
    this.nextGradientId += 1;
    this.gradients.push(gradient);
    return gradient;
  }

  fillText(text: string, x: number, y: number): void {
    this.drawText(text, x, y, "fill");
  }

  strokeText(text: string, x: number, y: number): void {
    this.drawText(text, x, y, "stroke");
  }

  setLineDash(values: readonly number[]): void {
    this.lineDash = [...values];
  }

  toSvg(): string {
    const defs = this.gradients
      .map((gradient) => {
        const stops = gradient.stops
          .map(
            (stop) => `<stop${attributes({
              offset: formatNumber(stop.offset),
              "stop-color": stop.color,
            })}/>` ,
          )
          .join("");
        return `<linearGradient${attributes({
          id: gradient.id,
          x1: formatNumber(gradient.start.x),
          y1: formatNumber(gradient.start.y),
          x2: formatNumber(gradient.end.x),
          y2: formatNumber(gradient.end.y),
          gradientUnits: "userSpaceOnUse",
        })}>${stops}</linearGradient>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><defs>${defs}</defs>${this.elements.join("")}</svg>\n`;
  }

  private paintValue(paint: Paint): string {
    return typeof paint === "string" ? paint : `url(#${paint.id})`;
  }

  private drawText(text: string, x: number, y: number, mode: "fill" | "stroke"): void {
    const font = parseFont(this.font);
    const matrix = this.matrix.map(formatNumber).join(" ");
    const common = {
      x: formatNumber(x),
      y: formatNumber(y),
      transform: `matrix(${matrix})`,
      "font-family": font.family,
      "font-size": font.size,
      "font-style": font.style,
      "font-weight": font.weight,
      "text-anchor": textAnchor(this.textAlign),
      "dominant-baseline": dominantBaseline(this.textBaseline),
    };

    if (mode === "fill") {
      this.elements.push(
        `<text${attributes({
          ...common,
          fill: this.paintValue(this.fillStyle),
          "fill-opacity": this.globalAlpha === 1 ? undefined : formatNumber(this.globalAlpha),
          stroke: "none",
        })}>${escapeXml(text)}</text>`,
      );
      return;
    }

    this.elements.push(
      `<text${attributes({
        ...common,
        fill: "none",
        stroke: this.paintValue(this.strokeStyle),
        "stroke-width": formatNumber(this.lineWidth),
        "stroke-linejoin": this.lineJoin,
        "stroke-opacity": this.globalAlpha === 1 ? undefined : formatNumber(this.globalAlpha),
      })}>${escapeXml(text)}</text>`,
    );
  }
}

export function createSvgCardRendererBackend(width: number, height: number) {
  return {
    createCanvas: () => {
      const context = new SvgCanvasContext(width, height);
      return {
        cvs: context,
        ctx: context as unknown as CanvasRenderingContext2D,
      };
    },
    cloneCanvas: (_canvas: SvgCanvasContext, context: CanvasRenderingContext2D) => (
      context as unknown as SvgCanvasContext
    ).toSvg(),
    saveCanvas: (_canvas: SvgCanvasContext, context: CanvasRenderingContext2D) => (
      context as unknown as SvgCanvasContext
    ).toSvg(),
  };
}
