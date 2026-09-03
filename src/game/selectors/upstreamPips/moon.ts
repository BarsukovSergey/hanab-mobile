import type { PipDrawingContext } from '../pipVectorRecorder';

const SCALE_FACTOR = 3;

// Source-faithful port of Hanabi-Live drawPipFunctions.ts @ 054e859b...
export function drawMoon(ctx: PipDrawingContext): void {
  ctx.scale(0.25, 0.25);
  ctx.beginPath();
  ctx.scale(SCALE_FACTOR, SCALE_FACTOR);
  ctx.translate(-414.893_82, -203.536_19);
  ctx.moveTo(374.946_29, 141.086_53);
  ctx.bezierCurveTo(340.464_47, 163.1565, 330.404_13, 209.013_71, 352.476_55, 243.488_28);
  ctx.bezierCurveTo(374.549_45, 277.965_45, 420.410_39, 288.024_39, 454.892_22, 265.955_19);
  ctx.bezierCurveTo(477.025_72, 251.7884, 489.042_88, 227.834_33, 489.011_38, 203.371_39);
  ctx.bezierCurveTo(485.2623, 214.509_46, 477.9108, 224.512_67, 467.2415, 231.3414);
  ctx.bezierCurveTo(442.362_79, 247.265_42, 409.218_42, 239.994_58, 393.293_88, 215.119_47);
  ctx.bezierCurveTo(377.367_61, 190.244_11, 384.683_48, 157.175_02, 409.562_19, 141.249_94);
  ctx.bezierCurveTo(418.141_55, 135.758_65, 427.650_37, 133.064_36, 437.139_06, 132.858_39);
  ctx.bezierCurveTo(416.929_67, 126.511_22, 394.181_38, 128.772_83, 374.943_62, 141.0852);
  ctx.scale(1 / SCALE_FACTOR, 1 / SCALE_FACTOR);
  ctx.closePath();
  ctx.scale(4, 4);
}
