// src/store/editorStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { WALLPAPERS } from '../lib/constants';

// --- Types ---
type BackgroundType = 'color' | 'gradient' | 'image' | 'wallpaper';
export type AspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

interface Background {
  type: BackgroundType;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: string;
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

export interface ZoomRegion {
  id: string;
  type: 'zoom';
  startTime: number;
  duration: number;
  zoomLevel: number;
  easing: 'linear' | 'ease-in-out';
  targetX: number;
  targetY: number;
  zIndex: number; // ADD THIS
}

export interface CutRegion {
  id: string;
  type: 'cut';
  startTime: number;
  duration: number;
  trimType?: 'start' | 'end';
  zIndex: number;
}

export type TimelineRegion = ZoomRegion | CutRegion;

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
  zoomRegions: Record<string, ZoomRegion>; // OPTIMIZATION: Array -> Record
  cutRegions: Record<string, CutRegion>;   // OPTIMIZATION: Array -> Record
  previewCutRegion: CutRegion | null;
  selectedRegionId: string | null;
  activeZoomRegionId: string | null;
  isCurrentlyCut: boolean;
  theme: 'light' | 'dark';
  timelineZoom: number;
  nextZIndex: number,
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
  addCutRegion: (regionData?: Partial<CutRegion>) => void;
  updateRegion: (id: string, updates: Partial<TimelineRegion>) => void;
  deleteRegion: (id: string) => void;
  setSelectedRegionId: (id: string | null) => void;
  setPreviewCutRegion: (region: CutRegion | null) => void;
  toggleTheme: () => void;
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
  zoomRegions: {}, // OPTIMIZATION: Init as empty object
  cutRegions: {},   // OPTIMIZATION: Init as empty object
  previewCutRegion: null,
  selectedRegionId: null,
  activeZoomRegionId: null,
  isCurrentlyCut: false,
  theme: 'light',
  timelineZoom: 1,
  nextZIndex: 1,
};

const initialFrameStyles: FrameStyles = {
  padding: 2,
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
        const processedMetadata = metadata.map(item => ({ ...item, timestamp: item.timestamp / 1000 }));
        set(state => { state.metadata = processedMetadata });

        const clicks = processedMetadata.filter(item => item.type === 'click' && item.pressed);
        if (clicks.length === 0) return;

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

        const newZoomRegions: Record<string, ZoomRegion> = mergedClickGroups.reduce((acc, group, index) => {
          const firstClick = group[0];
          const lastClick = group[group.length - 1];
          const startTime = Math.max(0, firstClick.timestamp - 0.25);
          const duration = Math.max(3, (lastClick.timestamp - firstClick.timestamp) + 0.75);
          const id = `auto-zoom-${Date.now()}-${index}`;

          acc[id] = {
            id,
            type: 'zoom',
            startTime,
            duration,
            zoomLevel: 2.0,
            easing: 'ease-in-out',
            targetX: firstClick.x,
            targetY: firstClick.y,
            zIndex: index + 1,
          };
          return acc;
        }, {} as Record<string, ZoomRegion>);

        set(state => {
          state.zoomRegions = newZoomRegions;
          state.nextZIndex = mergedClickGroups.length + 1;
        });

      } catch (error) {
        console.error("Failed to process metadata file:", error);
      }
    },

    setVideoDimensions: (dims) => set(state => { state.videoDimensions = dims }),

    setDuration: (duration) => set(state => { state.duration = duration; }),

    setCurrentTime: (time) => set(state => {
      state.currentTime = time;
      const allZoomRegions = Object.values(state.zoomRegions);
      const allCutRegions = Object.values(state.cutRegions);

      const newActiveRegion = allZoomRegions.find(r => time >= r.startTime && time < r.startTime + r.duration);
      state.activeZoomRegionId = newActiveRegion?.id ?? null;

      const activeCutRegion = allCutRegions.find(r => time >= r.startTime && time < r.startTime + r.duration);
      state.isCurrentlyCut = !!activeCutRegion;
    }),

    togglePlay: () => set(state => { state.isPlaying = !state.isPlaying; }),
    setPlaying: (isPlaying) => set(state => { state.isPlaying = isPlaying; }),

    updateFrameStyle: (style) => set(state => { Object.assign(state.frameStyles, style); }),

    updateBackground: (bg) => set((state) => {
      const currentBg = state.frameStyles.background;
      if (!bg.type || bg.type === currentBg.type) {
        Object.assign(state.frameStyles.background, bg);
        return;
      }
      const newBackgroundState: Background = { type: bg.type };
      switch (bg.type) {
        case 'color': newBackgroundState.color = '#ffffff'; break;
        case 'gradient':
          newBackgroundState.gradientStart = currentBg.gradientStart || '#6366f1';
          newBackgroundState.gradientEnd = currentBg.gradientEnd || '#9ca9ff';
          newBackgroundState.gradientDirection = currentBg.gradientDirection || 'to bottom right';
          break;
        case 'image':
        case 'wallpaper':
          newBackgroundState.imageUrl = WALLPAPERS[0].imageUrl;
          newBackgroundState.thumbnailUrl = WALLPAPERS[0].thumbnailUrl;
          break;
      }
      state.frameStyles.background = newBackgroundState;
    }),

    setAspectRatio: (ratio) => set(state => { state.aspectRatio = ratio; }),

    addZoomRegion: () => {
      const lastMousePos = get().metadata.find(m => m.timestamp <= get().currentTime);
      const id = `zoom-${Date.now()}`;
      const zIndex = get().nextZIndex; // GET CURRENT Z-INDEX
      const newRegion: ZoomRegion = {
        id,
        type: 'zoom',
        startTime: get().currentTime,
        duration: 3,
        zoomLevel: 2,
        easing: 'ease-in-out',
        targetX: lastMousePos?.x || get().videoDimensions.width / 2,
        targetY: lastMousePos?.y || get().videoDimensions.height / 2,
        zIndex, // ASSIGN Z-INDEX
      };
      set(state => {
        state.zoomRegions[id] = newRegion;
        state.nextZIndex++; // INCREMENT FOR NEXT REGION
      });
    },

    addCutRegion: (regionData) => {
      const id = `cut-${Date.now()}`;
      const zIndex = get().nextZIndex; // GET CURRENT Z-INDEX
      const newRegion: CutRegion = {
        id,
        type: 'cut',
        startTime: get().currentTime,
        duration: 2,
        zIndex, // ASSIGN Z-INDEX
        ...regionData,
      };
      set(state => {
        state.cutRegions[id] = newRegion;
        if (!regionData?.trimType) { // Don't increment zIndex for trim regions
          state.nextZIndex++; // INCREMENT FOR NEXT REGION
        }
      });
    },

    updateRegion: (id, updates) => set(state => {
      const region = state.zoomRegions[id] || state.cutRegions[id];
      if (region) { Object.assign(region, updates); }
    }),

    deleteRegion: (id) => set(state => {
      delete state.zoomRegions[id];
      delete state.cutRegions[id];
      if (state.selectedRegionId === id) {
        state.selectedRegionId = null;
      }
    }),

    setSelectedRegionId: (id) => set(state => { state.selectedRegionId = id; }),
    toggleTheme: () => set(state => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; }),
    setPreviewCutRegion: (region) => set(state => { state.previewCutRegion = region; }),
    setTimelineZoom: (zoom) => set(state => { state.timelineZoom = zoom; }),
    reset: () => set(state => {
      Object.assign(state, initialState);
      state.frameStyles = initialFrameStyles;
    }),
  }))
);

// --- OPTIMIZATION: Specialized hooks with selectors to prevent unnecessary re-renders ---
export const usePlaybackState = () => useEditorStore(useShallow(state => ({
  currentTime: state.currentTime,
  duration: state.duration,
  isPlaying: state.isPlaying,
  isCurrentlyCut: state.isCurrentlyCut
})));

export const useFrameStyles = () => useEditorStore(useShallow(state => state.frameStyles));

// CORRECTED HOOK
export const useAllRegions = () => useEditorStore(useShallow(state => ({
  // Return the original objects, which are stable references
  zoomRegions: state.zoomRegions,
  cutRegions: state.cutRegions,
})));
