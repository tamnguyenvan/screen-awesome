// src/store/editorStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { WALLPAPERS } from '../lib/constants';

// --- Types ---
type BackgroundType = 'color' | 'gradient' | 'image' | 'wallpaper';
export type AspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

interface Background {
  type: BackgroundType;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

interface FrameStyles {
  padding: number;
  background: Background;
  borderRadius: number;
  shadow: number;
  borderWidth: number;
  borderColor: string;
}

// NEW: Define region types
export interface ZoomRegion {
  id: string;
  type: 'zoom';
  startTime: number;
  duration: number;
  zoomLevel: number;
  easing: 'linear' | 'ease-in-out';
}

export interface CutRegion {
  id: string;
  type: 'cut';
  startTime: number;
  duration: number;
}

export type TimelineRegion = ZoomRegion | CutRegion;

// --- State ---
interface EditorState {
  videoPath: string | null;
  metadataPath: string | null;
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  frameStyles: FrameStyles;
  aspectRatio: AspectRatio;
  // NEW: State for timeline
  zoomRegions: ZoomRegion[];
  cutRegions: CutRegion[];
  selectedRegionId: string | null;
  timelineZoom: number; // e.g., 1 = 100%, 2 = 200%
}

// --- Actions ---
interface EditorActions {
  loadProject: (paths: { videoPath: string; metadataPath: string }) => Promise<void>;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;
  updateFrameStyle: (style: Partial<Omit<FrameStyles, 'background'>>) => void;
  updateBackground: (bg: Partial<Background>) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  // NEW: Actions for timeline
  addZoomRegion: () => void;
  addCutRegion: () => void;
  updateRegion: (id: string, updates: Partial<TimelineRegion>) => void;
  deleteRegion: (id: string) => void;
  setSelectedRegionId: (id: string | null) => void;
  setTimelineZoom: (zoom: number) => void;
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
  aspectRatio: '16:9',
  zoomRegions: [],
  cutRegions: [],
  selectedRegionId: null,
  timelineZoom: 1,
};

const initialFrameStyles: FrameStyles = {
  padding: 15,
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

// --- Store Implementation ---
export const useEditorStore = create(
  immer<EditorState & EditorActions>((set, get) => ({
    ...initialState,
    frameStyles: initialFrameStyles,

    loadProject: async ({ videoPath, metadataPath }) => {
      const videoUrl = `media://${videoPath}`;
      
      // Reset state before loading new project
      set(state => {
        Object.assign(state, initialState);
        state.frameStyles = initialFrameStyles;
        state.videoPath = videoPath;
        state.metadataPath = metadataPath;
        state.videoUrl = videoUrl;
      });

      // --- Auto-generate zoom regions from metadata ---
      try {
        const metadataContent = await window.electronAPI.readFile(metadataPath);
        const clicks: { timestamp: number; x: number; y: number; type: 'click' }[] = JSON.parse(metadataContent);
        
        if (clicks.length === 0) return;

        const mergedClicks = [];
        let lastClick = clicks[0];

        for (let i = 1; i < clicks.length; i++) {
          const currentClick = clicks[i];
          if (currentClick.timestamp - lastClick.timestamp < 3.0) {
            // Merge by extending the end time of the last click
            lastClick = { ...lastClick, timestamp: currentClick.timestamp }; 
          } else {
            mergedClicks.push(lastClick);
            lastClick = currentClick;
          }
        }
        mergedClicks.push(lastClick); // Add the last group

        const newZoomRegions: ZoomRegion[] = mergedClicks.map((click, index) => {
          // Find the actual start time from original clicks to define duration
          const originalStartTime = clicks.find(c => c.timestamp === click.timestamp)?.timestamp || click.timestamp;
          const duration = Math.max(0.5, click.timestamp - originalStartTime); // Min duration 0.5s

          return {
            id: `auto-zoom-${Date.now()}-${index}`,
            type: 'zoom',
            startTime: originalStartTime - 0.25, // Start zoom slightly before click
            duration: duration + 0.5, // Hold zoom for a bit after
            zoomLevel: 2,
            easing: 'ease-in-out',
          };
        });

        set(state => {
          state.zoomRegions = newZoomRegions;
        });

      } catch (error) {
        console.error("Failed to process metadata file:", error);
      }
    },

    setDuration: (duration) => set(state => { state.duration = duration; }),
    setCurrentTime: (time) => set(state => { state.currentTime = time; }),
    togglePlay: () => set(state => { state.isPlaying = !state.isPlaying; }),
    setPlaying: (isPlaying) => set(state => { state.isPlaying = isPlaying; }),

    updateFrameStyle: (style) => set(state => {
      Object.assign(state.frameStyles, style);
    }),

    updateBackground: (bg) => set(state => {
      Object.assign(state.frameStyles.background, bg);
    }),

    setAspectRatio: (ratio) => set(state => { state.aspectRatio = ratio; }),

    // --- New Actions ---
    addZoomRegion: () => {
      const newRegion: ZoomRegion = {
        id: `zoom-${Date.now()}`,
        type: 'zoom',
        startTime: get().currentTime,
        duration: 3, // Default duration
        zoomLevel: 2,
        easing: 'ease-in-out',
      };
      set(state => {
        state.zoomRegions.push(newRegion);
      });
    },

    addCutRegion: () => {
      const newRegion: CutRegion = {
        id: `cut-${Date.now()}`,
        type: 'cut',
        startTime: get().currentTime,
        duration: 2, // Default duration
      };
      set(state => {
        state.cutRegions.push(newRegion);
      });
    },

    updateRegion: (id, updates) => set(state => {
      const region = state.zoomRegions.find(r => r.id === id) || state.cutRegions.find(r => r.id === id);
      if (region) {
        Object.assign(region, updates);
      }
    }),

    deleteRegion: (id) => set(state => {
      state.zoomRegions = state.zoomRegions.filter(r => r.id !== id);
      state.cutRegions = state.cutRegions.filter(r => r.id !== id);
    }),

    setSelectedRegionId: (id) => set(state => { state.selectedRegionId = id; }),
    setTimelineZoom: (zoom) => set(state => { state.timelineZoom = zoom; }),

    reset: () => set(state => {
      Object.assign(state, initialState);
      state.frameStyles = initialFrameStyles;
    }),
  }))
);