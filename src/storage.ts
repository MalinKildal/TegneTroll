import { Directory, File, Paths } from 'expo-file-system';
import type { DrawingSummary, PersistedDrawing } from './types';

const drawingsDir = new Directory(Paths.document, 'drawings');

function ensureDrawingsDir(): void {
  drawingsDir.create({ intermediates: true, idempotent: true });
}

function drawingFile(id: string): File {
  return new File(drawingsDir, `${id}.json`);
}

function thumbnailFile(id: string): File {
  return new File(drawingsDir, `${id}.png`);
}

function indexFile(): File {
  return new File(drawingsDir, 'index.json');
}

async function readIndex(): Promise<DrawingSummary[]> {
  ensureDrawingsDir();
  const file = indexFile();
  if (!file.exists) return [];
  try {
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: DrawingSummary[]): void {
  ensureDrawingsDir();
  indexFile().write(JSON.stringify(entries));
}

export function newDrawingId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function thumbnailUri(id: string): string {
  return thumbnailFile(id).uri;
}

export async function listDrawings(): Promise<DrawingSummary[]> {
  const entries = await readIndex();
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDrawing(id: string): Promise<PersistedDrawing | null> {
  const file = drawingFile(id);
  if (!file.exists) return null;
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

export async function saveDrawing(drawing: PersistedDrawing, thumbnailBytes: Uint8Array): Promise<void> {
  ensureDrawingsDir();
  drawingFile(drawing.id).write(JSON.stringify(drawing));
  thumbnailFile(drawing.id).write(thumbnailBytes);

  const entries = await readIndex();
  const others = entries.filter((entry) => entry.id !== drawing.id);
  writeIndex([...others, { id: drawing.id, updatedAt: drawing.updatedAt }]);
}

export async function deleteDrawing(id: string): Promise<void> {
  const file = drawingFile(id);
  if (file.exists) file.delete();
  const thumb = thumbnailFile(id);
  if (thumb.exists) thumb.delete();

  const entries = await readIndex();
  writeIndex(entries.filter((entry) => entry.id !== id));
}
