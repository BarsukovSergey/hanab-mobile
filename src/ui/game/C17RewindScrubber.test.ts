import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import { gestureOriginFromGrant, scrubXFromPage } from './C17RewindScrubber';

test('rewind scrub coordinates stay anchored to the grant track origin', () => {
  const grantPageX = 240;
  const grantLocationX = 40;
  const originX = gestureOriginFromGrant(grantPageX, grantLocationX);

  expect(originX).toBe(200);
  // Later local coordinates may come from an underlying view after vertical drift.
  expect(scrubXFromPage(275, originX)).toBe(75);
  expect(scrubXFromPage(275, originX)).toBe(75);

  const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17RewindScrubber.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const move = source.slice(source.indexOf('onResponderMove='), source.indexOf('onResponderRelease='));
  expect(move).toContain('event.nativeEvent.pageX');
  expect(move).not.toContain('locationX');
});

test('release and terminate exactly flush their final page coordinate before clearing the origin', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17RewindScrubber.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const release = source.slice(source.indexOf('onResponderRelease='), source.indexOf('onResponderTerminate='));
  const terminate = source.slice(source.indexOf('onResponderTerminate='), source.indexOf('onStartShouldSetResponderCapture='));

  for (const handler of [release, terminate]) {
    expect(handler).toContain('scrubXFromPage(event.nativeEvent.pageX, gestureOriginX.current), true');
    expect(handler.indexOf('scrubToX(')).toBeLessThan(handler.indexOf('gestureOriginX.current = null;'));
    expect(handler).toContain('dragging.current = false;');
  }
});
