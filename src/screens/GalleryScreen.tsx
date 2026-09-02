import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { deleteDrawing, listDrawings, thumbnailUri } from '../storage';
import type { DrawingSummary } from '../types';

type Props = {
  onOpenDrawing: (drawingId: string | null) => void;
};

export function GalleryScreen({ onOpenDrawing }: Props) {
  const [drawings, setDrawings] = useState<DrawingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDrawings()
      .then(setDrawings)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Slette tegning?', 'Denne tegningen blir borte for godt.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          await deleteDrawing(id);
          setDrawings((prev) => prev.filter((d) => d.id !== id));
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TegneTroll</Text>
        <Pressable style={styles.newButton} onPress={() => onOpenDrawing(null)}>
          <Text style={styles.newButtonText}>+ Ny tegning</Text>
        </Pressable>
      </View>

      {!loading && drawings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Ingen tegninger enda.{'\n'}Trykk "Ny tegning" for å starte!</Text>
        </View>
      ) : (
        <FlatList
          data={drawings}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <Pressable
              style={styles.thumbWrapper}
              onPress={() => onOpenDrawing(item.id)}
              onLongPress={() => handleDelete(item.id)}
            >
              <Image
                source={{ uri: `${thumbnailUri(item.id)}?t=${item.updatedAt}` }}
                style={styles.thumb}
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9EC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2E2A24',
  },
  newButton: {
    backgroundColor: '#43AA8B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  grid: {
    padding: 12,
  },
  thumbWrapper: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#EADFCB',
  },
  thumb: {
    flex: 1,
    resizeMode: 'cover',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#7A6F5D',
  },
});
