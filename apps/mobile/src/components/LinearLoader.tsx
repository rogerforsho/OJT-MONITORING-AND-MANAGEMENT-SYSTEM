import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface LinearLoaderProps {
  loading?: boolean;
}

export default function LinearLoader({ loading = false }: LinearLoaderProps) {
  const transX = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(transX, {
          toValue: 400,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      transX.setValue(-150);
    }
  }, [loading, transX]);

  if (!loading) return null;

  return (
    <View style={s.track}>
      <Animated.View
        style={[
          s.bar,
          {
            transform: [{ translateX: transX }],
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(6, 36, 21, 0.1)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    width: 150,
    backgroundColor: '#FFCC00',
    borderRadius: 2,
  },
});
