import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";

const LOADING_FRAMES = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
  [4, 5, 6],
  [5, 6, 13],
  [6, 13, 20],
  [13, 20, 27],
  [20, 27, 34],
  [27, 34, 41],
  [34, 41, 48],
  [41, 48, 47],
  [48, 47, 46],
  [47, 46, 45],
  [46, 45, 44],
  [45, 44, 43],
  [44, 43, 42],
  [43, 42, 35],
  [42, 35, 28],
  [35, 28, 21],
  [28, 21, 14],
  [21, 14, 7],
  [14, 7, 0],
  [7, 0, 1],
];

interface Props {
  duration?: number;
  scale?: number;
}

export function DotLoader({ duration = 50, scale = 0.75 }: Props) {
  const [activeIndices, setActiveIndices] = useState<number[]>(
    LOADING_FRAMES[0]
  );
  const frameRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % LOADING_FRAMES.length;
      setActiveIndices(LOADING_FRAMES[frameRef.current]);
    }, duration);
    return () => clearInterval(interval);
  }, [duration]);

  const dotSize = 6 * scale;
  const gap = 2 * scale;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        width: (dotSize + gap) * 7 - gap,
      }}
    >
      {Array.from({ length: 49 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: 2 * scale,
            backgroundColor: activeIndices.includes(i)
              ? "#34D399"
              : "#404040",
            marginRight: i % 7 === 6 ? 0 : gap,
            marginBottom: i >= 42 ? 0 : gap,
          }}
        />
      ))}
    </View>
  );
}
