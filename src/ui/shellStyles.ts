import { StyleSheet } from 'react-native';

export const shellStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 16, padding: 20, paddingTop: 56 },
  gameContainer: { flexGrow: 1, padding: 16, paddingTop: 48 },
  centered: { flex: 1, gap: 8, justifyContent: 'center', padding: 24 },
  authBar: {
    alignItems: 'center', borderBottomColor: '#d5d9dd', borderBottomWidth: 1,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingTop: 44, paddingBottom: 8,
  },
  authName: { fontSize: 16, fontWeight: '700' },
  authActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  section: { borderColor: '#999', borderWidth: 1, gap: 10, padding: 14 },
  subsection: { gap: 8 },
  heading: { fontSize: 19, fontWeight: '600' },
  input: { borderColor: '#777', borderWidth: 1, padding: 10 },
  tableRow: { borderColor: '#bbb', borderWidth: 1, gap: 5, padding: 10 },
  tableName: { fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  error: { color: '#a00' },
});
