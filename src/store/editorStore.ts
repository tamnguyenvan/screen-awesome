// src/store/editorStore.ts

import { create } from 'zustand';
import { WALLPAPERS } from '../lib/constants';

// --- Types ---
// Định nghĩa các loại background
type BackgroundType = 'color' | 'gradient' | 'image' | 'wallpaper';

// Thêm type cho Aspect Ratio
export type AspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

// Định nghĩa cấu trúc cho background
interface Background {
  type: BackgroundType;
  // For 'color'
  color?: string;
  // For 'gradient'
  gradientStart?: string;
  gradientEnd?: string;
  // For 'image' and 'wallpaper'
  imageUrl?: string;
  thumbnailUrl?: string;
}

interface FrameStyles {
  padding: number; // Sẽ là % (0-30)
  background: Background;
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
  aspectRatio: AspectRatio;
}

interface EditorActions {
  loadProject: (paths: { videoPath: string; metadataPath: string }) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;
  updateFrameStyle: (style: Partial<FrameStyles>) => void;
  updateBackground: (bg: Partial<Background>) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
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
  aspectRatio: '16:9', // Giá trị mặc định
};

const initialFrameStyles: FrameStyles = {
    padding: 15, // Mặc định 15%
    background: {
        type: 'wallpaper',
        thumbnailUrl: WALLPAPERS[0].thumbnailUrl,
        imageUrl: WALLPAPERS[0].imageUrl,
    },
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
    const videoUrl = `media://${videoPath}`;
    set({
      ...initialState, 
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

  updateBackground: (bg) => set((state) => ({
    frameStyles: {
        ...state.frameStyles,
        background: { ...state.frameStyles.background, ...bg },
    }
  })),
  
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

  reset: () => set({ ...initialState, frameStyles: initialFrameStyles }),
}));