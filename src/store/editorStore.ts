// src/store/editorStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import { WALLPAPERS } from '../lib/constants';
import { shallow } from 'zustand/shallow';

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
  borderWidth: 10,
}

const MINIMUM_REGION_DURATION = 0.1;

// --- Store Implementation ---
export const useEditorStore = create(
  temporal(
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

      setDuration: (duration) => set(state => {
        state.duration = duration;

        if (duration > 0) {
          Object.values(state.zoomRegions).forEach(region => {
            const regionEndTime = region.startTime + region.duration;
            if (regionEndTime > duration) {
              const newDuration = duration - region.startTime;
              region.duration = Math.max(MINIMUM_REGION_DURATION, newDuration);
            }
          });
          Object.values(state.cutRegions).forEach(region => {
            const regionEndTime = region.startTime + region.duration;
            if (regionEndTime > duration) {
              const newDuration = duration - region.startTime;
              region.duration = Math.max(MINIMUM_REGION_DURATION, newDuration);
            }
          });
        }
      }),

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

        // If type is changing, create a new default state for that type first
        if (bg.type && bg.type !== currentBg.type) {
          let newBackgroundState: Background = { type: bg.type };
          switch (bg.type) {
            case 'color':
              newBackgroundState = { type: 'color', color: '#ffffff' };
              break;
            case 'gradient':
              newBackgroundState = {
                type: 'gradient',
                gradientStart: '#6366f1',
                gradientEnd: '#9ca9ff',
                gradientDirection: 'to bottom right',
              };
              break;
            case 'image':
            case 'wallpaper':
              newBackgroundState = {
                type: bg.type,
                imageUrl: WALLPAPERS[0].imageUrl,
                thumbnailUrl: WALLPAPERS[0].thumbnailUrl,
              };
              break;
          }
          // IMPORTANT: Merge the incoming changes (bg) over the new default state
          // This ensures the selected wallpaper/color is applied immediately, not the default.
          state.frameStyles.background = { ...newBackgroundState, ...bg };
        } else {
          // If type is not changing, just merge the properties
          Object.assign(state.frameStyles.background, bg);
        }
      }),

      setAspectRatio: (ratio) => set(state => { state.aspectRatio = ratio; }),

      addZoomRegion: () => {
        const { metadata, currentTime, videoDimensions, duration, nextZIndex } = get();
        if (duration === 0) return;

        const lastMousePos = metadata.find(m => m.timestamp <= currentTime);
        const id = `zoom-${Date.now()}`;

        const newRegion: ZoomRegion = {
          id,
          type: 'zoom',
          startTime: currentTime,
          duration: 3,
          zoomLevel: 2,
          easing: 'ease-in-out',
          targetX: lastMousePos?.x || videoDimensions.width / 2,
          targetY: lastMousePos?.y || videoDimensions.height / 2,
          zIndex: nextZIndex,
        };

        if (newRegion.startTime + newRegion.duration > duration) {
          newRegion.duration = Math.max(MINIMUM_REGION_DURATION, duration - newRegion.startTime);
        }

        set(state => {
          state.zoomRegions[id] = newRegion;
          state.selectedRegionId = id;
          state.nextZIndex++;
        });
      },

      addCutRegion: (regionData) => {
        const { currentTime, duration, nextZIndex } = get();
        if (duration === 0) return;

        const id = `cut-${Date.now()}`;

        const newRegion: CutRegion = {
          id,
          type: 'cut',
          startTime: currentTime,
          duration: 2,
          zIndex: nextZIndex,
          ...regionData,
        };

        if (newRegion.startTime + newRegion.duration > duration) {
          newRegion.duration = Math.max(MINIMUM_REGION_DURATION, duration - newRegion.startTime);
        }

        set(state => {
          state.cutRegions[id] = newRegion;
          state.selectedRegionId = id;
          if (!regionData?.trimType) {
            state.nextZIndex++;
          }
        });
      },

      updateRegion: (id, updates) => set(state => {
        const region = state.zoomRegions[id] || state.cutRegions[id];

        if (region) {
          Object.assign(region, updates);
          const videoDuration = state.duration;
          if (videoDuration > 0) {
            region.startTime = Math.max(0, Math.min(region.startTime, videoDuration - MINIMUM_REGION_DURATION));
            const maxPossibleDuration = videoDuration - region.startTime;
            region.duration = Math.max(MINIMUM_REGION_DURATION, Math.min(region.duration, maxPossibleDuration));
          }
        }
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
    })),
    {
      equality: shallow,
    }
  )
);

export const usePlaybackState = () => useEditorStore(useShallow(state => ({
  currentTime: state.currentTime,
  duration: state.duration,
  isPlaying: state.isPlaying,
  isCurrentlyCut: state.isCurrentlyCut
})));

export const useFrameStyles = () => useEditorStore(useShallow(state => state.frameStyles));

export const useAllRegions = () => useEditorStore(useShallow(state => ({
  zoomRegions: state.zoomRegions,
  cutRegions: state.cutRegions,
})));