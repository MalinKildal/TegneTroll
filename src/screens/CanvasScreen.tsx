import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Fill, Path, Skia, useCanvasRef } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { CANVAS_BACKGROUND, COLORS, THICKNESSES } from '../colors';
import { loadDrawing, newDrawingId, saveDrawing } from '../storage';
import type { LiveStroke } from '../types';

type Props = {
  drawingId: string | null;
  onBack: () => void;
};

export function CanvasScreen({ drawingId, onBack }: Props) {
  const canvasRef = useCanvasRef();
  const idRef = useRef(drawingId ?? newDrawingId());
  const createdAtRef = useRef(Date.now());
  const currentPathRef = useRef(Skia.PathBuilder.Make().build());
  const currentBuilderRef = useRef(Skia.PathBuilder.Make());
  const strokeInProgressRef = useRef<{ color: string; width: number } | null>(null);

  const [strokes, setStrokes] = useState<LiveStroke[]>([]);
  const [drawTick, setDrawTick] = useState(0);
  const [color, setColor] = useState(COLORS[0]);
  const [thickness, setThickness] = useState(THICKNESSES[1]);
  const [dirty, setDirty] = useState(false);

  const colorRef = useRef(color);
  colorRef.current = color;
  const thicknessRef = useRef(thickness);
  thicknessRef.current = thickness;

  useEffect(() => {
    if (!drawingId) return;
    loadDrawing(drawingId).then((saved) => {
      if (!saved) return;
      createdAtRef.current = saved.createdAt;
      const restored = saved.strokes
        .map((s) => {
          const path = Skia.Path.MakeFromSVGString(s.path);
          return path ? { color: s.color, width: s.width, path } : null;
        })
        .filter((s): s is LiveStroke => s !== null);
      setStrokes(restored);
    });
  }, [drawingId]);

  const commitStroke = useCallback(() => {
    const meta = strokeInProgressRef.current;
    if (!meta) return;
    const finished = currentBuilderRef.current.detach();
    setStrokes((prev) => [...prev, { color: meta.color, width: meta.width, path: finished }]);
    setDirty(true);
    currentPathRef.current = Skia.PathBuilder.Make().build();
    strokeInProgressRef.current = null;
    setDrawTick((t) => t + 1);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          strokeInProgressRef.current = { color: colorRef.current, width: thicknessRef.current };
          const builder = Skia.PathBuilder.Make();
          builder.moveTo(locationX, locationY);
          builder.lineTo(locationX + 0.1, locationY + 0.1);
          currentBuilderRef.current = builder;
          currentPathRef.current = builder.build();
          setDrawTick((t) => t + 1);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentBuilderRef.current.lineTo(locationX, locationY);
          currentPathRef.current = currentBuilderRef.current.build();
          setDrawTick((t) => t + 1);
        },
        onPanResponderRelease: commitStroke,
        onPanResponderTerminate: commitStroke,
      }),
    [commitStroke]
  );

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
    setDirty(true);
  }, []);

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return;
    Alert.alert('Viske ut alt?', 'Hele tegningen blir tom.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Visk ut',
        style: 'destructive',
        onPress: () => {
          setStrokes([]);
          setDirty(true);
        },
      },
    ]);
  }, [strokes.length]);

  const persist = useCallback(async () => {
    const snapshot = canvasRef.current?.makeImageSnapshot();
    const thumbBytes = snapshot ? snapshot.encodeToBytes() : new Uint8Array();
    const now = Date.now();
    await saveDrawing(
      {
        id: idRef.current,
        createdAt: createdAtRef.current,
        updatedAt: now,
        strokes: strokes.map((s) => ({ color: s.color, width: s.width, path: s.path.toSVGString() })),
      },
      thumbBytes
    );
    setDirty(false);
  }, [canvasRef, strokes]);

  const handleSave = useCallback(async () => {
    if (strokes.length === 0) return;
    await persist();
    Alert.alert('Lagret!', 'Tegningen din er lagret i TegneTroll.');
  }, [persist, strokes.length]);

  const handleExport = useCallback(async () => {
    if (strokes.length === 0) return;
    const { status } = await requestPermissionsAsync(true);
    if (status !== 'granted') {
      Alert.alert('Mangler tillatelse', 'Vi trenger tilgang til bildegalleriet for å lagre bildet.');
      return;
    }
    const snapshot = canvasRef.current?.makeImageSnapshot();
    if (!snapshot) return;
    const bytes = snapshot.encodeToBytes();
    const tempFile = new File(Paths.cache, `tegnetroll-${Date.now()}.png`);
    tempFile.write(bytes);
    await Asset.create(tempFile.uri);
    Alert.alert('Eksportert!', 'Tegningen er lagret i bildegalleriet på telefonen.');
  }, [canvasRef, strokes.length]);

  const handleBack = useCallback(() => {
    if (!dirty) {
      onBack();
      return;
    }
    Alert.alert('Lagre tegningen?', 'Du har ulagrede endringer.', [
      { text: 'Forkast', style: 'destructive', onPress: onBack },
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Lagre',
        onPress: async () => {
          await persist();
          onBack();
        },
      },
    ]);
  }, [dirty, onBack, persist]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={handleBack}>
          <Text style={styles.iconButtonText}>{'‹ Tilbake'}</Text>
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable style={[styles.topActionButton, styles.saveButton]} onPress={handleSave}>
            <Text style={styles.topActionButtonText}>Lagre</Text>
          </Pressable>
          <Pressable style={[styles.topActionButton, styles.exportButton]} onPress={handleExport}>
            <Text style={styles.topActionButtonText}>Del til galleri</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
          <Fill color={CANVAS_BACKGROUND} />
          {strokes.map((s, i) => (
            <Path
              key={i}
              path={s.path}
              color={s.color}
              style="stroke"
              strokeWidth={s.width}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          <Path
            path={currentPathRef.current}
            color={color}
            style="stroke"
            strokeWidth={thickness}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.row}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchSelected,
              ]}
            />
          ))}
        </View>

        <View style={styles.row}>
          {THICKNESSES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setThickness(t)}
              style={[styles.thicknessButton, thickness === t && styles.thicknessButtonSelected]}
            >
              <View style={[styles.thicknessDot, { width: t, height: t, borderRadius: t / 2 }]} />
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.bottomActionButton,
              styles.bottomActionButtonSpaced,
              strokes.length === 0 && styles.bottomActionButtonDisabled,
            ]}
            onPress={handleUndo}
            disabled={strokes.length === 0}
          >
            <Ionicons name="arrow-undo" size={22} color={strokes.length === 0 ? '#C9C2B4' : '#2E2A24'} />
          </Pressable>
          <Pressable
            style={[styles.bottomActionButton, strokes.length === 0 && styles.bottomActionButtonDisabled]}
            onPress={handleClear}
            disabled={strokes.length === 0}
          >
            <Ionicons name="trash" size={22} color={strokes.length === 0 ? '#C9C2B4' : '#2E2A24'} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CANVAS_BACKGROUND,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E2A24',
  },
  disabledText: {
    color: '#C9C2B4',
  },
  canvasWrapper: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#EADFCB',
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#EADFCB',
  },
  colorSwatchSelected: {
    borderColor: '#2E2A24',
  },
  thicknessButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EEDD',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thicknessButtonSelected: {
    borderColor: '#43AA8B',
  },
  thicknessDot: {
    backgroundColor: '#2E2A24',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#277DA1',
  },
  exportButton: {
    backgroundColor: '#8E44AD',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  topActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  topActionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  bottomActionButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EEDD',
  },
  bottomActionButtonSpaced: {
    marginLeft: 20,
  },
  bottomActionButtonDisabled: {
    backgroundColor: '#F9F5EB',
  },
  bottomActionButtonIcon: {
    fontSize: 22,
  },
  disabledIcon: {
    opacity: 0.35,
  },
});
