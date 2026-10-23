import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const source = readFileSync(resolve(__dirname, 'TerminationControls.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('termination controls', () => {
  test('requires an explicit confirmation before terminating the game', () => {
    expect(source).toContain('Alert.alert(');
    expect(source).toContain("'Terminate game?'");
    expect(source).toContain("'This immediately ends the game for everyone.'");
    expect(source).toContain("{ text: 'Cancel', style: 'cancel' }");
    expect(source).toContain('const confirm = terminationRuntime.createTerminationConfirmation();');
    expect(source).toContain("text: 'Terminate',\n                style: 'destructive',\n                onPress: () => { confirm(); }");
    expect(source).toContain('{ cancelable: false }');
  });

  test('keeps termination voting outside the destructive confirmation', () => {
    expect(source).toContain("title={ourVote ? 'Cancel termination vote' : 'Vote to terminate'}");
    expect(source).toContain('onPress={() => terminationRuntime.voteForTermination()}');
  });
});
