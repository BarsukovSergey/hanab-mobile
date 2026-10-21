import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
const boundary = readFileSync(resolve(__dirname, 'AppErrorBoundary.tsx'), 'utf8');

describe('app render failure containment', () => {
  test('contains the authenticated app subtree without moving networking into a UI boundary', () => {
    expect(app).toContain('<AppErrorBoundary>');
    expect(app).toContain('<AppContent />');
    expect(app).toContain('</AppErrorBoundary>');
    expect(boundary).toContain('static getDerivedStateFromError()');
    expect(boundary).toContain('onPress={() => this.setState({ failed: false })}');
  });

  test('reports component context without logging exception messages or raw protocol frames', () => {
    expect(boundary).toContain(
      "console.error('[Hanab] UI error boundary caught a render failure', info.componentStack)",
    );
    expect(boundary).not.toContain('console.error(_error)');
    expect(boundary).not.toContain('JSON.stringify');
  });
});
