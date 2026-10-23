import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

const c17 = readFileSync('src/ui/game/C17GameScreen.tsx', 'utf8');
const paceModal = readFileSync('src/ui/game/PaceDetailsModal.tsx', 'utf8');

describe('Efficiency and Pace HUD details', () => {
  it('C17 keeps both metrics inspectable', () => {
    const screen = c17;
    expect(screen).toMatch(/label="Efficiency"[\s\S]*?onPress=\{\(\) => setEfficiencyDetailsOpen\(true\)\}/);
    expect(screen).toMatch(/label="Pace"[\s\S]*?onPress=\{\(\) => setPaceDetailsOpen\(true\)\}/);
    expect(screen).toContain('accessibilityHint="Opens read-only efficiency calculation details"');
    expect(screen).toContain('accessibilityHint="Opens read-only Pace details"');
    expect(screen).toContain('<EfficiencyDetailsModal');
    expect(screen).toContain('<PaceDetailsModal');
    expect(screen).toContain('accessibilityLabel={`Pace ${gameplayPresentation.pace}`}');
    expect(screen).toContain('accessibilityLabel={`Efficiency. Future required ${formatEfficiency(gameplayPresentation.futureRequiredEfficiency)}, minimum required ${gameplayPresentation.minimumRequiredEfficiency.toFixed(2)}`}');
    expect(screen).toMatch(/<Pressable accessibilityHint=\{accessibilityHint\} accessibilityLabel=\{accessibilityLabel\}\s+accessibilityRole="button" hitSlop=\{6\} onPress=\{onPress\} style=\{styles\.hudStat\}>\s*\{contents\}\s*<View pointerEvents="none" style=\{\[styles\.hudStatOutline/);
    expect(screen).toContain('pointerEvents="none"');
    expect(screen).toContain('StyleSheet.absoluteFill');
    expect(screen).toMatch(/hudStat: \{[^}]*alignItems: 'center', minWidth: 34, position: 'relative'/);
    expect(screen).not.toMatch(/hudStat: \{[^}]*minHeight|hudStat: \{[^}]*padding|hudStat: \{[^}]*width/);
  });

  it('keeps the full FRE | MRE value and null formatting in the shared portrait/landscape strip', () => {
    const metricStrip = c17.slice(c17.indexOf('const metricStrip = ('), c17.indexOf('const tableResources = ('));
    expect(metricStrip).toContain('<HudStat label="Efficiency" value={`${formatEfficiency(gameplayPresentation.futureRequiredEfficiency)} | ${gameplayPresentation.minimumRequiredEfficiency.toFixed(2)}`}');
    expect(metricStrip).not.toContain('label="Eff"');
    expect(c17).toContain("return value === null ? '-' : value.toFixed(2);");
    expect(c17).toMatch(/portraitV2 \? <>\s*<View style=\{styles\.ledgerChrome\}>\{metricStrip\}/);
    expect(c17).toMatch(/style=\{\[styles\.landscapeLiveColumn[^\n]*\n\s*\{!noteEditorOpen && <>\s*\{metricStrip\}/);
  });

  it('places clickable badges beside the centered labels below values without adding metric height', () => {
    const hudStat = c17.slice(c17.indexOf('function HudStat('), c17.indexOf('function formatEfficiency('));
    expect(hudStat).toMatch(/styles\.hudValue[^\n]*>\{value\}<\/Text>\s*<View style=\{styles\.hudStatLabelRow\}>\s*<Text[^\n]*>\{label\}<\/Text>\s*\{onPress !== undefined && <View pointerEvents="none" style=\{\[styles\.hudStatInfo[^\n]*\n\s*<Text[^\n]*>i<\/Text>\s*<\/View>\}\s*<\/View>/);
    expect(hudStat.match(/styles\.hudStatInfo,/g)).toHaveLength(1);
    expect(c17).toContain("hudStatLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }");
    expect(c17).toMatch(/hudStatInfo: \{[^}]*height: 10,[^}]*width: 10 \}/);
    expect(c17).not.toMatch(/hudStatInfo: \{[^}]*(position:|right:|top:)/);
    expect(c17).not.toMatch(/hudStatLabelRow: \{[^}]*(height:|width:|padding|margin)/i);
    expect(c17).toContain("hudValue: { fontSize: 15, fontWeight: '900', lineHeight: 17 }");
    expect(c17).toContain("hudLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }");
    expect(c17).toContain('landscapeMetricStrip: { height: 34, flexShrink: 0, paddingVertical: 0 }');
  });

  it('uses baseline Pace risk colors and defaults for low or unavailable risk', () => {
    expect(paceModal).toContain("if (risk === 'medium') return '#efef1d'");
    expect(paceModal).toContain("if (risk === 'high') return '#ef8c1d'");
    expect(paceModal).toContain("if (risk === 'zero') return '#df1c2d'");
    expect(paceModal).toContain('return defaultColor');
    expect(c17).toContain('getPaceRiskColor(gameplayPresentation.paceRisk, theme.colors.text)');
  });

  it('colors Efficiency cyan only when the authoritative modifier flag applies', () => {
    const colorBehavior = "gameplayPresentation.appliesEfficiencyModifier ? '#00ffff' : undefined";
    expect(c17).toContain(colorBehavior);
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


it('portrait moves resources into CompactTable while retaining Turn, Pace and Efficiency at the top', () => {
  const table = readFileSync('src/ui/game/CompactTable.tsx', 'utf8');
  const viewer = readFileSync('src/ui/game/DiscardViewer.tsx', 'utf8');
  const cards = readFileSync('src/ui/game/GameCard.tsx', 'utf8');
  expect(c17).toContain("<CompactTable presentation={portraitV2 ? 'portrait-v2' : 'landscape-v2'}");
  expect(c17).toContain('landscapeMetricStrip: { height: 34');
  expect(c17).toContain('`LIVE T${liveTurn}`');
  expect(c17).toContain('numberOfLines={portraitV2 ? undefined : 1}');
  expect(table).toContain('Score {game.score} / {game.stats.maxScore}');
  expect(table).toContain('[0, 1, 2].map');
  expect(table).toContain('getPortraitResourceRailFit(availableWidth, suits.length, fontScale)');
  expect(table).toContain('Discard Pile');
  expect(table).toContain('No relevant cards');
  expect(table).toContain('discard.relevantCards.map');
  expect(viewer).toContain('faded={isEngineTrash(');
  expect(cards).toContain('(faded || statePresentation?.shouldFade) && styles.engineTrashCard');
});


it('CompactTable defaults to Legacy and packs landscape resources and larger individual relevant discards from the shared envelope', () => {
  const table = readFileSync('src/ui/game/CompactTable.tsx', 'utf8');
  expect(table).toContain("presentation = 'legacy'");
  expect(table).toContain("presentation?: 'legacy' | 'portrait-v2' | 'landscape-v2'");
  const v2 = table.slice(table.indexOf('function V2Table('), table.indexOf('function compactSuitName('));
  expect(v2).toContain('height: landscapeEnvelope.height, flexShrink: 0');
  expect(v2).toContain('height: landscapeEnvelope.rowHeight, gap: 0');
  expect(v2).toContain('height: landscapeEnvelope.discardHeight');
  expect(v2).toContain('getDiscardPresentation(game, cardIdentities)');
  expect(v2).toContain('discard.relevantCards.map');
  expect(v2).toContain('key={card.order}');
  expect(v2).not.toContain('getDiscardSummary');
  expect(v2).not.toContain('count > 1');
  expect(v2).not.toContain('deckPlays');
});
