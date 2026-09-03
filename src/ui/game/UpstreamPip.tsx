import { Defs, G, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

import {
  getRecordedPipVector,
  isUpstreamPipRenderable,
  isVanillaUpstreamPip,
} from '../../game/selectors/pipVectors';
import type { PipVector } from '../../game/selectors/pipVectorRecorder';

export function hasUpstreamSvgPip(pip: string): boolean {
  return isUpstreamPipRenderable(pip);
}

export function UpstreamPip({ pip, fillColors, size, suitName = '', duplicatePip = false }: {
  pip: string;
  fillColors: readonly string[];
  size: number;
  suitName?: string;
  duplicatePip?: boolean;
}) {
  return (
    <Svg height={size} viewBox="-100 -100 200 200" width={size}>
      <UpstreamPipPaths
        duplicatePip={duplicatePip}
        fillColors={fillColors}
        idPrefix={`pip-${pip}`}
        pip={pip}
        suitName={suitName}
      />
    </Svg>
  );
}

export function UpstreamPipPaths({ pip, fillColors, suitName, duplicatePip = false, idPrefix }: {
  pip: string;
  fillColors: readonly string[];
  suitName: string;
  duplicatePip?: boolean;
  idPrefix: string;
}) {
  const fill = suitName === 'Black' ? '#212121' : fillColors[0] ?? '#5d6570';
  const multi = fillColors.length > 1;
  const commonFill = multi ? `url(#${idPrefix}-fill)` : fill;
  const recorded = isVanillaUpstreamPip(pip) ? null : getRecordedPipVector(pip, fillColors, suitName);

  if (!isVanillaUpstreamPip(pip) && recorded === null) return null;

  return <>
    {multi && (
      <Defs>
        <LinearGradient id={`${idPrefix}-fill`} x1="0" x2="1" y1="0" y2="1">
          {fillColors.map((color, index) => (
            <Stop
              key={`${color}-${index}`}
              offset={fillColors.length === 1 ? 0 : index / (fillColors.length - 1)}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
    )}
    <G transform={duplicatePip ? 'scale(0.8)' : undefined}>
      {duplicatePip && <Path
        d="M 90 0 A 90 90 0 1 0 -90 0 A 90 90 0 1 0 90 0 M 80 0 A 80 80 0 1 1 -80 0 A 80 80 0 1 1 80 0 Z"
        fill={commonFill}
        fillRule="evenodd"
        stroke="#000000"
        strokeWidth={1}
      />}
      {isVanillaUpstreamPip(pip)
        ? <CanonicalPipPath fill={commonFill} pip={pip} />
        : recorded !== null && <RecordedPipPaths idPrefix={idPrefix} vector={recorded} />}
    </G>
  </>;
}

function RecordedPipPaths({ idPrefix, vector }: { idPrefix: string; vector: PipVector }) {
  const gradients = vector.shapes.flatMap((shape) => shape.gradient === undefined ? [] : [shape.gradient]);
  return <>
    {gradients.length > 0 && <Defs>{gradients.map((gradient) => (
      <LinearGradient
        gradientUnits="userSpaceOnUse"
        id={`${idPrefix}-${gradient.id}`}
        key={`${idPrefix}-${gradient.id}`}
        x1={gradient.x1}
        x2={gradient.x2}
        y1={gradient.y1}
        y2={gradient.y2}
      >
        {gradient.stops.map((stop, index) => (
          <Stop key={`${stop.offset}-${index}`} offset={stop.offset} stopColor={stop.color} />
        ))}
      </LinearGradient>
    ))}</Defs>}
    {vector.shapes.map((shape, index) => (
      <Path
        d={shape.d}
        fill={shape.gradient === undefined ? shape.fill : `url(#${idPrefix}-${shape.gradient.id})`}
        fillRule={shape.fillRule}
        key={`${idPrefix}-shape-${index}`}
        stroke={shape.stroke}
        strokeLinejoin={shape.strokeLinejoin}
        strokeWidth={shape.strokeWidth}
      />
    ))}
  </>;
}

export function CanonicalPipPath({ pip, fill }: { pip: string; fill: string }) {
  const common = { fill, stroke: '#000000', strokeLinejoin: 'round' as const, strokeWidth: 3 };
  switch (pip) {
    case 'hanabiRed1':
      return (
        <G transform="scale(3) translate(-40.903844 -80.253155)">
          <Path
            {...common}
            d="M47.530531 88.39269 C29.757962 90.07021 31.193616 78.98785 34.277276 72.11126 C52.049847 70.433711 50.616495 81.5161 47.530531 88.39269 M38.201088 59.405974 C36.488459 59.405974 35.161286 62.901259 34.279579 66.24217 C11.602243 72.595989 17.005567 101.10507 43.609027 101.10033 C45.321658 101.10033 46.646522 97.60497 47.530531 94.26178 C70.20557 87.91267 64.799917 59.401233 38.201088 59.405974 Z"
          />
        </G>
      );
    case 'hanabiYellow2':
      return (
        <G transform="scale(3) translate(-58.029065 -70.265748)">
          <Path
            {...common}
            d="M48.471374 76.245007 C52.478308 74.048764 57.340783 70.758733 60.960015 66.9381 C60.918765 71.616441 61.423545 77.451433 63.024126 82.374519 C59.019361 79.96819 53.639232 77.395132 48.471374 76.245007 M78.213664 83.015659 C74.748208 79.849062 67.217334 70.373217 64.219708 62.72108 C64.353955 62.49395 64.505635 62.265928 64.629079 62.034484 C64.629079 62.034484 66.385639 60.000655 63.054465 55.839957 C59.727624 51.679247 56.955259 51.30884 56.214513 51.402032 C55.473773 51.495022 54.735194 51.633868 54.460129 52.881296 C53.420489 57.587859 48.768108 69.322751 43.468126 75.640741 C43.271019 75.640741 43.069626 75.626481 42.876825 75.633641 C42.876825 75.633641 40.236578 75.126788 38.300255 80.091092 C36.359599 85.053189 37.4274 87.641479 37.875753 88.234939 C38.324091 88.830219 38.815757 89.402319 40.032999 89.016809 C44.609566 87.567769 57.020243 85.739789 65.144575 87.138969 C65.166335 87.171069 65.183225 87.212469 65.205475 87.244869 C65.205475 87.244869 66.084837 89.785519 71.354499 88.984149 C76.622002 88.180599 78.326561 85.962679 78.618964 85.278249 C78.90703 84.591659 79.16044 83.876899 78.213916 83.017049 Z"
          />
        </G>
      );
    case 'hanabiGreen3':
      return (
        <G transform="scale(3) translate(-37.89188 -52.702171)">
          <Path
            {...common}
            d="M56.910015 58.292302 C55.483093 57.138514 52.978323 54.51389 49.381539 52.702161 C52.978323 50.88805 55.483093 48.26581 56.910015 47.112026 C59.841692 44.740087 58.374671 43.555312 58.374671 43.555312 C55.737819 38.372817 52.749542 35.352476 49.728244 32.591968 C47.63857 30.684887 47.214037 32.868471 46.836666 34.568186 C46.27771 37.083148 45.362573 39.512295 44.150277 41.779343 C42.449773 44.964172 40.294055 47.336103 37.893058 49.669898 C35.4897 47.336103 33.333993 44.964172 31.633476 41.779343 C30.423545 39.512295 29.50607 37.083148 28.949451 34.568186 C28.569708 32.868496 28.145185 30.684887 26.055515 32.591968 C23.034217 35.352476 20.045939 38.372817 17.409083 43.555312 C17.409083 43.555312 15.942073 44.740087 18.873743 47.112026 C20.303023 48.26581 22.807798 50.88805 26.402219 52.702161 C22.807798 54.51389 20.303023 57.138514 18.873743 58.292302 C15.942073 60.661853 17.409083 61.846624 17.409083 61.846624 C20.045939 67.031506 23.034217 70.051852 26.055515 72.812352 C28.145185 74.719433 28.569729 72.535849 28.949451 70.836141 C29.506055 68.321168 30.423545 65.892021 31.633476 63.622593 C33.333993 60.440152 35.4897 58.065829 37.893058 55.734422 C40.294055 58.065829 42.449773 60.440152 44.150277 63.622593 C45.362573 65.892021 46.277689 68.321168 46.836666 70.836141 C47.214058 72.53582 47.63857 74.719433 49.728244 72.812352 C52.749542 70.051852 55.737819 67.031506 58.374671 61.846624 C58.374671 61.846624 59.841692 60.661853 56.910015 58.292302 Z"
          />
        </G>
      );
    case 'hanabiBlue4':
      return (
        <G transform="scale(3) translate(-99.694341 -76.779331)">
          <Path
            {...common}
            d="M56.910015 58.292302 M115.29782 63.128745 C115.50904 62.943572 115.73842 62.78373 115.9409 62.592635 C116.13678 62.405678 117.7273 61.097621 118.49932 60.145425 C118.99105 59.542738 118.50332 59.119802 118.07018 59.159833 C85.907335 62.087565 79.611335 57.902868 79.611335 57.902868 C76.59238 67.042068 83.408965 72.218957 83.408965 72.218957 C83.423265 72.226057 83.506365 72.240367 83.548825 72.247497 C81.513235 82.240997 82.770205 92.034227 83.053065 92.330067 C83.053065 92.330067 88.939675 98.539287 97.700645 94.541477 C97.700645 94.541477 94.483705 90.692697 92.968635 71.80037 C97.351385 71.230615 102.62621 70.080615 107.50275 67.947093 C103.98771 79.224239 105.57838 91.991907 105.9032 92.330067 C105.9032 92.330067 111.79206 98.539287 120.54636 94.541477 C120.54636 94.541477 116.38835 89.549157 115.29822 63.13056 Z"
          />
        </G>
      );
    case 'hanabiWhite5':
      return (
        <G transform="scale(0.25) scale(3) translate(-240.36951 -310.42858)">
          <Path
            {...common}
            d="M209.32783 329.84636 C216.84946 315.63443 219.83968 297.64058 220.32548 276.66186 C234.19607 285.09913 251.98661 288.63517 272.94328 289.37289 C264.65944 303.39826 261.20017 321.38368 260.47986 342.5574 C246.93591 334.28974 229.66468 330.70283 209.32783 329.84636 M304.8808 333.66226 C303.08838 316.81313 302.35966 300.01488 303.78357 283.12336 C305.86082 280.55403 307.97994 276.98406 309.91479 271.95565 C317.41964 252.5287 313.29028 242.40397 311.55646 240.0805 C309.82262 237.7486 307.92129 235.50997 303.20562 237.01935 C290.6752 241.03873 277.24853 243.00603 264.20713 244.42212 C247.48872 246.23679 230.80381 246.98295 214.01839 245.50752 C212.56097 245.37999 211.01979 245.18546 209.47862 244.97296 C207.65264 243.92995 205.54189 242.9039 203.05425 241.92028 C183.86491 234.33097 173.86402 238.51145 171.56901 240.26675 C169.26559 242.02204 167.05435 243.94694 168.54527 248.71252 C172.51548 261.39808 174.4587 274.99949 175.8575 288.18538 C177.54105 304.08479 178.21952 319.95026 177.10549 335.87509 C174.97802 338.45291 172.80864 342.06526 170.82355 347.21242 C163.31866 366.63936 167.44803 376.77261 169.1902 379.09604 C170.92406 381.42791 172.81702 383.66655 177.53268 382.14868 C190.06314 378.13781 203.48978 376.16204 216.52277 374.74595 C233.20769 372.9398 249.85072 372.20204 266.57753 373.66055 C269.12382 375.78047 272.66688 377.9428 277.67567 379.92701 C296.86502 387.51635 306.87431 383.33586 309.16092 381.58054 C311.47271 379.82528 313.67559 377.90038 312.19302 373.1348 C308.21445 360.44921 306.27123 346.8478 304.8808 333.6619 Z"
          />
        </G>
      );
    default:
      return null;
  }
}
