import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

const c17 = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8');
const legacy = readFileSync('src/ui/game/LegacyGameScreen.tsx', 'utf8');
const paceModal = readFileSync('src/ui/game/PaceDetailsModal.tsx', 'utf8');

describe('Eff and Pace HUD details', () => {
  it.each([['C17', c17], ['Legacy', legacy]])('%s keeps both metrics inspectable', (_name, screen) => {
    expect(screen).toMatch(/label="Eff"[\s\S]*?onPress=\{\(\) => setEfficiencyDetailsOpen\(true\)\}/);
    expect(screen).toMatch(/label="Pace"[\s\S]*?onPress=\{\(\) => setPaceDetailsOpen\(true\)\}/);
    expect(screen).toContain('accessibilityHint="Opens read-only efficiency calculation details"');
    expect(screen).toContain('accessibilityHint="Opens read-only Pace details"');
    expect(screen).toContain('<EfficiencyDetailsModal');
    expect(screen).toContain('<PaceDetailsModal');
    expect(screen).toMatch(/onPress === undefined[\s\S]*?styles\.hudStat[\s\S]*?styles\.hudStatOutline[\s\S]*?styles\.hudStatInfo/);
    expect(screen).toContain('pointerEvents="none"');
    expect(screen).toContain('StyleSheet.absoluteFill');
    expect(screen).toMatch(/hudStat: \{[^}]*alignItems: 'center', minWidth: 34, position: 'relative'/);
    expect(screen).not.toMatch(/hudStat: \{[^}]*minHeight|hudStat: \{[^}]*padding|hudStat: \{[^}]*width/);
  });

  it('uses baseline Pace risk colors and defaults for low or unavailable risk', () => {
    expect(paceModal).toContain("if (risk === 'medium') return '#efef1d'");
    expect(paceModal).toContain("if (risk === 'high') return '#ef8c1d'");
    expect(paceModal).toContain("if (risk === 'zero') return '#df1c2d'");
    expect(paceModal).toContain('return defaultColor');
    expect(c17).toContain('getPaceRiskColor(gameplayPresentation.paceRisk, theme.colors.text)');
    expect(legacy).toContain('getPaceRiskColor(gameplayPresentation.paceRisk, theme.colors.text)');
  });

  it('colors Eff cyan only when the authoritative modifier flag applies', () => {
    const colorBehavior = "gameplayPresentation.appliesEfficiencyModifier ? '#00ffff' : undefined";
    expect(c17).toContain(colorBehavior);
    expect(legacy).toContain(colorBehavior);
  });

  it('provides read-only Pace meaning, formula, and accessible risk explanations', () => {
    expect(paceModal).toContain('Pace details');
    expect(paceModal).toContain('Pace value:');
    expect(paceModal).toContain('Current risk:');
    expect(paceModal).toContain('Meaning: Pace is the number of discards that can still happen while preserving the maximum score.');
    expect(paceModal).toContain('Formula: score + deck size - max score + final-round length');
    for (const label of ['Low', 'Medium', 'High', 'Zero', 'Unavailable']) {
      expect(paceModal).toContain(`['${label}'`);
    }
    expect(paceModal).toContain('#efef1d');
    expect(paceModal).toContain('#ef8c1d');
    expect(paceModal).toContain('#df1c2d');
    expect(paceModal).toContain('onRequestClose={onClose}');
    expect(paceModal).toContain('title="Close"');
    expect(paceModal).not.toMatch(/TextInput|onChangeText|editable=/);
  });
});


it('portrait moves resources into CompactTable while retaining Turn, Pace and Eff at the top', () => {
  const table = readFileSync('src/ui/game/CompactTable.tsx', 'utf8');
  const viewer = readFileSync('src/ui/game/DiscardViewer.tsx', 'utf8');
  const cards = readFileSync('src/ui/game/GameCard.tsx', 'utf8');
  expect(c17).toContain("<CompactTable presentation={portraitV2 ? 'portrait-v2' : 'landscape-v2'}");
  expect(c17).toContain('landscapeMetricStrip: { height: 34');
  expect(c17).toContain('`LIVE T${liveTurn}`');
  expect(c17).toContain('numberOfLines={portraitV2 ? undefined : 2}');
  expect(table).toContain('Score {game.score} / {game.stats.maxScore}');
  expect(table).toContain('[0, 1, 2].map');
  expect(table).toContain('getPortraitResourceRailFit(availableWidth, suits.length, fontScale)');
  expect(table).toContain('Discard Pile');
  expect(table).toContain('No relevant cards');
  expect(table).toContain('discard.relevantCards.map');
  expect(viewer).toContain('faded={isEngineTrash(');
  expect(cards).toContain('(faded || statePresentation?.shouldFade) && styles.engineTrashCard');
});


it('CompactTable defaults to Legacy and packs landscape resources plus individual relevant discards into 92dp', () => {
  const table = readFileSync('src/ui/game/CompactTable.tsx', 'utf8');
  expect(table).toContain("presentation = 'legacy'");
  expect(table).toContain("presentation?: 'legacy' | 'portrait-v2' | 'landscape-v2'");
  const v2 = table.slice(table.indexOf('function V2Table('), table.indexOf('function compactSuitName('));
  expect(v2).toContain('height: 92, flexShrink: 0');
  expect(v2).toContain('height: 62, gap: 0');
  expect(v2).toContain('height: 26');
  expect(v2).toContain('getDiscardPresentation(game, cardIdentities)');
  expect(v2).toContain('discard.relevantCards.map');
  expect(v2).toContain('key={card.order}');
  expect(v2).not.toContain('getDiscardSummary');
  expect(v2).not.toContain('count > 1');
  expect(v2).not.toContain('deckPlays');
});
