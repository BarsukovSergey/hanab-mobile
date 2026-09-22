import { Image, StyleSheet } from 'react-native';

type WebCardMarkerKind =
  | 'critical'
  | 'trash'
  | 'trash-mini'
  | 'dda'
  | 'fix'
  | 'question'
  | 'exclamation'
  | 'note';

const markerSources = {
  critical: require('../../../assets/ui/upstream/critical.png'),
  trash: require('../../../assets/ui/upstream/trashcan2.png'),
  'trash-mini': require('../../../assets/ui/upstream/wastebasket.png'),
  dda: require('../../../assets/ui/upstream/dda.png'),
  fix: require('../../../assets/ui/upstream/wrench.png'),
  question: require('../../../assets/ui/upstream/question-mark2.png'),
  exclamation: require('../../../assets/ui/upstream/exclamation-mark.png'),
  note: require('../../../assets/ui/upstream/note.png'),
} as const;

/** Exact card-state artwork synchronized from the pinned upstream checkout. */
export function WebCardMarker({ kind }: { kind: WebCardMarkerKind }) {
  return <Image resizeMode="contain" source={markerSources[kind]} style={styles.image} />;
}

const styles = StyleSheet.create({ image: { height: '100%', width: '100%' } });
