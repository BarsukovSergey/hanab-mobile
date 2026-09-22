import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

const PULSE_DURATION_MS = 170;

export function AuthoritativePulse({ children, enabled = true, pulseKey }: { children: ReactNode; enabled?: boolean; pulseKey: number | null }) {
  const value = useRef(new Animated.Value(0)).current;
  const previousPulseKey = useRef<number | null>(pulseKey);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || pulseKey === null || pulseKey === previousPulseKey.current || reduceMotion) {
      previousPulseKey.current = pulseKey;
      return;
    }
    previousPulseKey.current = pulseKey;
    value.stopAnimation();
    value.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(value, { duration: PULSE_DURATION_MS / 2, toValue: 1, useNativeDriver: true }),
      Animated.timing(value, { duration: PULSE_DURATION_MS / 2, toValue: 0, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [enabled, pulseKey, reduceMotion, value]);

  return <Animated.View style={{
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }],
  }}>{children}</Animated.View>;
}
