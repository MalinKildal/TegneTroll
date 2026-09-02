import type { SkPath } from '@shopify/react-native-skia';

export type PersistedStroke = {
  color: string;
  width: number;
  path: string;
};

export type PersistedDrawing = {
  id: string;
  createdAt: number;
  updatedAt: number;
  strokes: PersistedStroke[];
};

export type DrawingSummary = {
  id: string;
  updatedAt: number;
};

export type LiveStroke = {
  color: string;
  width: number;
  path: SkPath;
};
