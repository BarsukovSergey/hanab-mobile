import type { PipDrawingContext } from '../pipVectorRecorder';

const SCALE_FACTOR = 3;

// Source-faithful port of Hanabi-Live drawPipFunctions.ts @ 054e859b...
export function drawInfinity(ctx: PipDrawingContext, colors?: readonly string[]): void {
  ctx.scale(1.2, 1.2);
  ctx.beginPath();
  ctx.scale(SCALE_FACTOR, SCALE_FACTOR);
  ctx.translate(-91.082_135, -80.110_718);
  ctx.transform(2.128_652, 0, 0, 2.476_848, -78.229_708, -213.117_53);
  ctx.moveTo(84.443_554, 124.560_58);
  ctx.bezierCurveTo(86.918_78, 124.464_38, 89.392_846, 122.020_23, 89.392_11, 117.589_85);
  ctx.bezierCurveTo(89.392_11, 117.082_88, 88.432_933, 116.691_02, 87.515_841, 116.429_29);
  ctx.bezierCurveTo(86.129_485, 111.085_71, 80.894_815, 111.014_25, 78.815_855, 115.1772);
  ctx.bezierCurveTo(76.486_172, 109.953_16, 69.685_595, 111.837_18, 69.686_815, 119.181_05);
  ctx.bezierCurveTo(69.686_815, 119.688_13, 70.646_062, 120.081_25, 71.562_529, 120.342_24);
  ctx.bezierCurveTo(72.949_924, 125.686_47, 78.184_271, 125.757_92, 80.263_07, 121.594_34);
  ctx.bezierCurveTo(81.188_027, 123.667_36, 82.815_125, 124.623_69, 84.443_554, 124.560_58);
  ctx.moveTo(83.404_271, 120.906_82);
  ctx.bezierCurveTo(82.731_479, 120.875_12, 82.029_116, 120.638_01, 81.439_628, 120.352_81);
  ctx.bezierCurveTo(80.979_448, 115.091_15, 84.019_975, 115.515_67, 85.906_337, 116.429_29);
  ctx.bezierCurveTo(86.222_708, 120.046_69, 84.884_415, 120.975_85, 83.404_271, 120.906_82);
  ctx.moveTo(75.136_667, 120.896_22);
  ctx.bezierCurveTo(74.463_876, 120.864_52, 73.761_523, 120.627_41, 73.172_033, 120.342_21);
  ctx.bezierCurveTo(72.711_854, 115.080_55, 75.752_37, 115.504_43, 77.638_733, 116.418_06);
  ctx.bezierCurveTo(77.955_104, 120.035_45, 76.616_822, 120.965_25, 75.136_667, 120.896_22);
  ctx.transform(1 / 2.128_652, 0, 0, 1 / 2.476_848, 0, 0);
  ctx.scale(1 / SCALE_FACTOR, 1 / SCALE_FACTOR);
  ctx.closePath();
  ctx.scale(5 / 6, 5 / 6);
  if (colors !== undefined) {
    const gradient = ctx.createLinearGradient(500, 0, 700, 0);
    for (const [i, color] of colors.entries()) gradient.addColorStop(i / (colors.length - 1), color);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}
