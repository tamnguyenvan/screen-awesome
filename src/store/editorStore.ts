// src/store/editorStore.ts
import { create } from 'zustand';

// --- Types ---
interface FrameStyles {
  padding: number;
  background: string;
  borderRadius: number;
  shadow: number;
  borderWidth: number;
  borderColor: string;
}

interface EditorState {
  videoPath: string | null;
  metadataPath: string | null;
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  frameStyles: FrameStyles;
}

interface EditorActions {
  loadProject: (paths: { videoPath: string; metadataPath: string }) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;
  updateFrameStyle: (style: Partial<FrameStyles>) => void;
  reset: () => void;
}

// --- Initial State ---
const initialState: Omit<EditorState, 'frameStyles'> = {
  videoPath: null,
  metadataPath: null,
  videoUrl: null,
  duration: 0,
  currentTime: 0,
  isPlaying: false,
};

const initialFrameStyles: FrameStyles = {
    padding: 64,
    background: 'linear-gradient(145deg, #2b3a67, #0b0f2b)',
    borderRadius: 24,
    shadow: 5,
    borderWidth: 0,
    borderColor: '#ffffff',
}

// --- Store ---
export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...initialState,
  frameStyles: initialFrameStyles,

  loadProject: ({ videoPath, metadataPath }) => {
    // Convert file path to a URL the custom protocol can handle
    const videoUrl = `media://${videoPath}`;
    set({
      ...initialState, // Reset state for new project
      frameStyles: initialFrameStyles,
      videoPath,
      metadataPath,
      videoUrl,
    });
  },

  setDuration: (duration) => set({ duration }),
  setCurrentTime: (time) => set({ currentTime: time }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (isPlaying) => set({ isPlaying }),

  updateFrameStyle: (style) => set((state) => ({
    frameStyles: { ...state.frameStyles, ...style },
  })),

  reset: () => set({ ...initialState, frameStyles: initialFrameStyles }),
}));