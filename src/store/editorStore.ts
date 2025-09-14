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

// Thêm targetX và targetY
export interface ZoomRegion {
  id: string;
  type: 'zoom';
  startTime: number;
  duration: number;
  zoomLevel: number;
  easing: 'linear' | 'ease-in-out';
  targetX: number; // Click position X (0 to 1)
  targetY: number; // Click position Y (0 to 1)
}

export interface CutRegion {
  id: string;
  type: 'cut';
  startTime: number;
  duration: number;
}

export type TimelineRegion = ZoomRegion | CutRegion;

// Define metadata type
interface MetaDataItem {
  timestamp: number;
  x: number;
  y: number;
  type: 'click' | 'move' | 'scroll';
  button?: string;
  pressed?: boolean;
}

// --- State ---
interface EditorState {
  videoPath: string | null;
  metadataPath: string | null;
  videoUrl: string | null;
  videoDimensions: { width: number; height: number };
  metadata: MetaDataItem[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  frameStyles: FrameStyles;
  aspectRatio: AspectRatio;
  zoomRegions: ZoomRegion[];
  cutRegions: CutRegion[];
  selectedRegionId: string | null;
  activeZoomRegionId: string | null;
  isCurrentlyCut: boolean;
  timelineZoom: number;
}

// --- Actions ---
interface EditorActions {
  loadProject: (paths: { videoPath: string; metadataPath: string }) => Promise<void>;
  setVideoDimensions: (dims: { width: number; height: number }) => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaying: (isPlaying: boolean) => void;
  updateFrameStyle: (style: Partial<Omit<FrameStyles, 'background'>>) => void;
  updateBackground: (bg: Partial<Background>) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
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
  videoDimensions: { width: 1920, height: 1080 },
  metadata: [],
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  aspectRatio: '16:9',
  zoomRegions: [],
  cutRegions: [],
  selectedRegionId: null,
  activeZoomRegionId: null,
  isCurrentlyCut: false,
  timelineZoom: 1,
};

const initialFrameStyles: FrameStyles = {
  padding: 5,
  background: {
    type: 'wallpaper',
    thumbnailUrl: WALLPAPERS[0].thumbnailUrl,
    imageUrl: WALLPAPERS[0].imageUrl,
  },
  borderRadius: 16,
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

      set(state => {
        Object.assign(state, initialState);
        state.frameStyles = initialFrameStyles;
        state.videoPath = videoPath;
        state.metadataPath = metadataPath;
        state.videoUrl = videoUrl;
      });

      try {
        const metadataContent = await window.electronAPI.readFile(metadataPath);
        const metadata: MetaDataItem[] = JSON.parse(metadataContent);

        // Convert timestamp from ms to s
        const processedMetadata = metadata.map(item => ({ ...item, timestamp: item.timestamp / 1000 }));
        set(state => { state.metadata = processedMetadata });

        const clicks = processedMetadata.filter(item => item.type === 'click' && item.pressed);

        if (clicks.length === 0) return;

        // Logic to merge clicks that are close to each other
        const mergedClickGroups: MetaDataItem[][] = [];
        if (clicks.length > 0) {
          let currentGroup = [clicks[0]];
          for (let i = 1; i < clicks.length; i++) {
            if (clicks[i].timestamp - currentGroup[currentGroup.length - 1].timestamp < 3.0) {
              currentGroup.push(clicks[i]);
            } else {
              mergedClickGroups.push(currentGroup);
              currentGroup = [clicks[i]];
            }
          }
          mergedClickGroups.push(currentGroup);
        }

        const newZoomRegions: ZoomRegion[] = mergedClickGroups.map((group, index) => {
          const firstClick = group[0];
          const lastClick = group[group.length - 1];

          const startTime = firstClick.timestamp - 0.25; // Start zoom before click
          const duration = (lastClick.timestamp - firstClick.timestamp) + 0.75; // Time from first click to last click + add 0.25s at start and 0.5s at end

          return {
            id: `auto-zoom-${Date.now()}-${index}`,
            type: 'zoom',
            startTime: Math.max(0, startTime),
            duration: Math.max(3, duration),
            zoomLevel: 2.0,
            easing: 'ease-in-out',
            targetX: firstClick.x,
            targetY: firstClick.y,
          };
        });

        set(state => {
          state.zoomRegions = newZoomRegions;
        });

      } catch (error) {
        console.error("Failed to process metadata file:", error);
      }
    },

    setVideoDimensions: (dims) => set(state => { state.videoDimensions = dims }),

    setDuration: (duration) => set(state => { state.duration = duration; }),
    setCurrentTime: (time) => set(state => {
      state.currentTime = time;

      // --- Logic for Zoom Region ---
      const activeRegion = state.zoomRegions.find(r => r.id === state.activeZoomRegionId);

      // If time still within the active region, do nothing
      if (activeRegion && time >= activeRegion.startTime && time <= activeRegion.startTime + activeRegion.duration) {
        // Still in the old region, but need to check cut logic
      } else {
         // otherwise, find new region
        const newActiveRegion = state.zoomRegions.find(
          r => time >= r.startTime && time <= r.startTime + r.duration
        );
        state.activeZoomRegionId = newActiveRegion ? newActiveRegion.id : null;
      }

      // --- Logic for Cut Region ---
      const activeCutRegion = state.cutRegions.find(
        r => time >= r.startTime && time <= r.startTime + r.duration
      );
      state.isCurrentlyCut = !!activeCutRegion; // Set boolean flag
    }),
    togglePlay: () => set(state => { state.isPlaying = !state.isPlaying; }),
    setPlaying: (isPlaying) => set(state => { state.isPlaying = isPlaying; }),

    updateFrameStyle: (style) => set(state => {
      Object.assign(state.frameStyles, style);
    }),

    updateBackground: (bg) => set(state => {
      Object.assign(state.frameStyles.background, bg);
    }),

    setAspectRatio: (ratio) => set(state => { state.aspectRatio = ratio; }),

    addZoomRegion: () => {
      const lastMousePos = get().metadata.find(m => m.timestamp <= get().currentTime);
      const newRegion: ZoomRegion = {
        id: `zoom-${Date.now()}`,
        type: 'zoom',
        startTime: get().currentTime,
        duration: 3,
        zoomLevel: 2,
        easing: 'ease-in-out',
        targetX: lastMousePos?.x || get().videoDimensions.width / 2,
        targetY: lastMousePos?.y || get().videoDimensions.height / 2,
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
        duration: 2,
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