// Vendored from Hanabi-Live/hanabi-live at 054e859b97ebacc514ca37470e6bdfae5a93d467.
// Source: packages/client/src/game/ui/drawPipFunctions.ts
// Keep this file source-faithful; platform adaptation belongs outside it.
import type { Pip } from '../../upstream/enums/Pip';

type DrawFunction = (
  ctx: CanvasRenderingContext2D,
  colors?: readonly string[],
) => void;

const SCALE_FACTOR = 3;

export const DRAW_PIP_FUNCTIONS = {
  // ------------
  // Vanilla pips
  // ------------

  hanabiRed1: (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.scale(SCALE_FACTOR, SCALE_FACTOR);
    ctx.translate(-40.903_844, -80.253_155);
    ctx.moveTo(47.530_531, 88.392_69);
    ctx.bezierCurveTo(
      29.757_962,
      90.070_21,
      31.193_616,
      78.987_85,
      34.277_276,
      72.111_26,
    );
    ctx.bezierCurveTo(
      52.049_847,
      70.433_711,
      50.616_495,
      81.5161,
      47.530_531,
      88.392_69,
    );
    ctx.moveTo(38.201_088, 59.405_974);
    ctx.bezierCurveTo(
      36.488_459,
      59.405_974,
      35.161_286,
      62.901_259,
      34.279_579,
      66.242_17,
    );
    ctx.bezierCurveTo(
      11.602_243,
      72.595_989,
      17.005_567,
      101.105_07,
      43.609_027,
      101.100_33,
    );
    ctx.bezierCurveTo(
      45.321_658,
      101.100_33,
      46.646_522,
      97.604_97,
      47.530_531,
      94.261_78,
    );
    ctx.bezierCurveTo(
      70.205_57,
      87.912_67,
      64.799_917,
      59.401_233,
      38.201_088,
      59.405_974,
    );
    ctx.scale(1 / SCALE_FACTOR, 1 / SCALE_FACTOR);
    ctx.closePath();
  },

  hanabiYellow2: (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.scale(SCALE_FACTOR, SCALE_FACTOR);
    ctx.translate(-58.029_065, -70.265_748);
    ctx.moveTo(48.471_374, 76.245_007);
    ctx.bezierCurveTo(
      52.478_308,
      74.048_764,
      57.340_783,
      70.758_733,
      60.960_015,
      66.9381,
    );
    ctx.bezierCurveTo(
      60.918_765,
      71.616_441,
      61.423_545,
      77.451_433,
      63.024_126,
      82.374_519,
    );
    ctx.bezierCurveTo(
      59.019_361,
      79.968_19,
      53.639_232,
      77.395_132,
      48.471_374,
      76.245_007,
    );
    ctx.moveTo(78.213_664, 83.015_659);
    ctx.bezierCurveTo(
      74.748_208,
      79.849_062,
      67.217_334,
      70.373_217,
      64.219_708,
      62.721_08,
    );
    ctx.bezierCurveTo(
      64.353_955,
      62.493_95,
      64.505_635,
      62.265_928,
      64.629_079,
      62.034_484,
    );
    ctx.bezierCurveTo(
      64.629_079,
      62.034_484,
      66.385_639,
      60.000_655,
      63.054_465,
      55.839_957,
    );
    ctx.bezierCurveTo(
      59.727_624,
      51.679_247,
      56.955_259,
      51.308_84,
      56.214_513,
      51.402_032,
    );
    ctx.bezierCurveTo(
      55.473_773,
      51.495_022,
      54.735_194,
      51.633_868,
      54.460_129,
      52.881_296,
    );
    ctx.bezierCurveTo(
      53.420_489,
      57.587_859,
      48.768_108,
      69.322_751,
      43.468_126,
      75.640_741,
    );
    ctx.bezierCurveTo(
      43.271_019,
      75.640_741,
      43.069_626,
      75.626_481,
      42.876_825,
      75.633_641,
    );
    ctx.bezierCurveTo(
      42.876_825,
      75.633_641,
      40.236_578,
      75.126_788,
      38.300_255,
      80.091_092,
    );
    ctx.bezierCurveTo(
      36.359_599,
      85.053_189,
      37.4274,
      87.641_479,
      37.875_753,
      88.234_939,
    );
    ctx.bezierCurveTo(
      38.324_091,
      88.830_219,
      38.815_757,
      89.402_319,
      40.032_999,
      89.016_809,
    );
    ctx.bezierCurveTo(
      44.609_566,
      87.567_769,
      57.020_243,
      85.739_789,
      65.144_575,
      87.138_969,
    );
    ctx.bezierCurveTo(
      65.166_335,
      87.171_069,
      65.183_225,
      87.212_469,
      65.205_475,
      87.244_869,
    );
    ctx.bezierCurveTo(
      65.205_475,
      87.244_869,
      66.084_837,
      89.785_519,
      71.354_499,
      88.984_149,
    );
    ctx.bezierCurveTo(
      76.622_002,
      88.180_599,
      78.326_561,
      85.962_679,
      78.618_964,
      85.278_249,
    );
    ctx.bezierCurveTo(
      78.907_03,
      84.591_659,
      79.160_44,
      83.876_899,
      78.213_916,
      83.017_049,
    );
    ctx.scale(1 / SCALE_FACTOR, 1 / SCALE_FACTOR);
    ctx.closePath();
  },

  hanabiGreen3: (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.scale(SCALE_FACTOR, SCALE_FACTOR);
    ctx.translate(-37.891_88, -52.702_171);
    ctx.moveTo(56.910_015, 58.292_302);
    ctx.bezierCurveTo(55.483_093,57.138_514,52.978_323,54.513_89,49.381_539,52.702_161);
    ctx.bezierCurveTo(52.978_323,50.888_05,55.483_093,48.265_81,56.910_015,47.112_026);
    ctx.bezierCurveTo(59.841_692,44.740_087,58.374_671,43.555_312,58.374_671,43.555_312);
    ctx.bezierCurveTo(55.737_819,38.372_817,52.749_542,35.352_476,49.728_244,32.591_968);
    ctx.bezierCurveTo(47.638_57,30.684_887,47.214_037,32.868_471,46.836_666,34.568_186);
    ctx.bezierCurveTo(46.277_71,37.083_148,45.362_573,39.512_295,44.150_277,41.779_343);
    ctx.bezierCurveTo(42.449_773,44.964_172,40.294_055,47.336_103,37.893_058,49.669_898);
    ctx.bezierCurveTo(35.4897,47.336_103,33.333_993,44.964_172,31.633_476,41.779_343);
    ctx.bezierCurveTo(30.423_545,39.512_295,29.506_07,37.083_148,28.949_451,34.568_186);
    ctx.bezierCurveTo(28.569_708,32.868_496,28.145_185,30.684_887,26.055_515,32.591_968);
    ctx.bezierCurveTo(23.034_217,35.352_476,20.045_939,38.372_817,17.409_083,43.555_312);
    ctx.bezierCurveTo(17.409_083,43.555_312,15.942_073,44.740_087,18.873_743,47.112_026);
    ctx.bezierCurveTo(20.303_023,48.265_81,22.807_798,50.888_05,26.402_219,52.702_161);
    ctx.bezierCurveTo(22.807_798,54.513_89,20.303_023,57.138_514,18.873_743,58.292_302);
    ctx.bezierCurveTo(15.942_073,60.661_853,17.409_083,61.846_624,17.409_083,61.846_624);
    ctx.bezierCurveTo(20.045_939,67.031_506,23.034_217,70.051_852,26.055_515,72.812_352);
    ctx.bezierCurveTo(28.145_185,74.719_433,28.569_729,72.535_849,28.949_451,70.836_141);
    ctx.bezierCurveTo(29.506_055,68.321_168,30.423_545,65.892_021,31.633_476,63.622_593);
    ctx.bezierCurveTo(33.333_993,60.440_152,35.4897,58.065_829,37.893_058,55.734_422);
    ctx.bezierCurveTo(40.294_055,58.065_829,42.449_773,60.440_152,44.150_277,63.622_593);
    ctx.bezierCurveTo(45.362_573,65.892_021,46.277_689,68.321_168,46.836_666,70.836_141);
    ctx.bezierCurveTo(47.214_058,72.535_82,47.638_57,74.719_433,49.728_244,72.812_352);
    ctx.bezierCurveTo(52.749_542,70.051_852,55.737_819,67.031_506,58.374_671,61.846_624);
    ctx.bezierCurveTo(58.374_671,61.846_624,59.841_692,60.661_853,56.910_015,58.292_302);
    ctx.scale(1 / SCALE_FACTOR, 1 / SCALE_FACTOR);
    ctx.closePath();
  },

  hanabiBlue4: (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath(); ctx.scale(SCALE_FACTOR,SCALE_FACTOR); ctx.translate(-99.694_341,-76.779_331);
    ctx.moveTo(56.910_015,58.292_302); ctx.moveTo(115.297_82,63.128_745);
    ctx.bezierCurveTo(115.509_04,62.943_572,115.738_42,62.783_73,115.9409,62.592_635);
    ctx.bezierCurveTo(116.136_78,62.405_678,117.7273,61.097_621,118.499_32,60.145_425);
    ctx.bezierCurveTo(118.991_05,59.542_738,118.503_32,59.119_802,118.070_18,59.159_833);
    ctx.bezierCurveTo(85.907_335,62.087_565,79.611_335,57.902_868,79.611_335,57.902_868);
    ctx.bezierCurveTo(76.592_38,67.042_068,83.408_965,72.218_957,83.408_965,72.218_957);
    ctx.bezierCurveTo(83.423_265,72.226_057,83.506_365,72.240_367,83.548_825,72.247_497);
    ctx.bezierCurveTo(81.513_235,82.240_997,82.770_205,92.034_227,83.053_065,92.330_067);
    ctx.bezierCurveTo(83.053_065,92.330_067,88.939_675,98.539_287,97.700_645,94.541_477);
    ctx.bezierCurveTo(97.700_645,94.541_477,94.483_705,90.692_697,92.968_635,71.800_37);
    ctx.bezierCurveTo(97.351_385,71.230_615,102.626_21,70.080_615,107.502_75,67.947_093);
    ctx.bezierCurveTo(103.987_71,79.224_239,105.578_38,91.991_907,105.9032,92.330_067);
    ctx.bezierCurveTo(105.9032,92.330_067,111.792_06,98.539_287,120.546_36,94.541_477);
    ctx.bezierCurveTo(120.546_36,94.541_477,116.388_35,89.549_157,115.298_22,63.130_56);
    ctx.scale(1/SCALE_FACTOR,1/SCALE_FACTOR); ctx.closePath();
  },

  // The remaining canonical upstream pip functions are intentionally kept in the source-faithful
  // follow-up file. This first vendored slice establishes the exact vanilla path source while the
  // SVG adapter lands in the same corrective series.
} as const satisfies Partial<Record<Pip, DrawFunction>>;
