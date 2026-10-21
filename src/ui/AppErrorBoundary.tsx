import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Prevent a render/lifecycle exception from closing the app without a recoverable screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, info: ErrorInfo): void {
    // Component names only. Never log exception messages, props, session data, or frames.
    console.error('[Hanab] UI error boundary caught a render failure', info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.description}>
          The current screen could not be rendered. Reopen the app view to
          reconnect and refresh game state from the server. Unconfirmed moves
          will not be resent.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry app"
          onPress={() => this.setState({ failed: false })}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: '#151816',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  heading: { color: '#f1eee6', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  description: { color: '#b7b1a6', fontSize: 15, lineHeight: 22, maxWidth: 380, textAlign: 'center' },
  button: {
    backgroundColor: '#5aaa7d',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  buttonLabel: { color: '#101712', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
