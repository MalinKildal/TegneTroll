import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { CanvasScreen } from './src/screens/CanvasScreen';

type Screen = { name: 'gallery' } | { name: 'canvas'; drawingId: string | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'gallery' });
  const [galleryKey, setGalleryKey] = useState(0);

  const openDrawing = useCallback((drawingId: string | null) => {
    setScreen({ name: 'canvas', drawingId });
  }, []);

  const goToGallery = useCallback(() => {
    setGalleryKey((k) => k + 1);
    setScreen({ name: 'gallery' });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen.name === 'gallery' ? (
        <GalleryScreen key={galleryKey} onOpenDrawing={openDrawing} />
      ) : (
        <CanvasScreen drawingId={screen.drawingId} onBack={goToGallery} />
      )}
    </SafeAreaProvider>
  );
}
