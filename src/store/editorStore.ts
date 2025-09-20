// src/store/editorStore.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { temporal } from 'zundo';
import { WALLPAPERS } from '../lib/constants';
import { shallow } from 'zustand/shallow';
import {
  AspectRatio, Background, FrameStyles, Preset, ZoomRegion, CutRegion, TimelineRegion,
  EditorState, MetaDataItem
} from '../types/store';

// --- Types ---
let debounceTimer: NodeJS.Timeout;

// --- Actions ---
export interface EditorActions {
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
  _debouncedUpdatePreset: () => void;
  initializeSettings: () => Promise<void>;
  initializePresets: () => Promise<void>;
  applyPreset: (id: string) => void;
  saveCurrentStyleAsPreset: (name: string) => void;
  updateActivePreset: () => void;
  deletePreset: (id: string) => void;
}

// --- Initial State ---
const initialProjectState = {
  videoPath: null,
  metadataPath: null,
  videoUrl: null,
  videoDimensions: { width: 1920, height: 1080 },
  metadata: [],
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  aspectRatio: '16:9' as AspectRatio,
  zoomRegions: {},
  cutRegions: {},
  previewCutRegion: null,
  selectedRegionId: null,
  activeZoomRegionId: null,
  isCurrentlyCut: false,
  timelineZoom: 1,
  nextZIndex: 1,
};

// State toàn cục của ứng dụng, không bị reset bởi loadProject
const initialAppState = {
  theme: 'light' as 'light' | 'dark',
  presets: {},
  activePresetId: null,
  presetSaveStatus: 'idle' as const,
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
  borderWidth: 8,
}

const MINIMUM_REGION_DURATION = 0.1;

const LAST_PRESET_ID_KEY = 'screenawesome_lastActivePresetId';

// Helper function to persist presets to the main process
const _persistPresets = async (presets: Record<string, Preset>) => {
  try {
    await window.electronAPI.savePresets(presets);
  } catch (error) {
    console.error("Failed to save presets:", error);
  }
};

// --- Store Implementation ---
export const useEditorStore = create(
  temporal(
    immer<EditorState & EditorActions>((set, get) => ({
      ...initialProjectState,
      ...initialAppState,
      frameStyles: initialFrameStyles,

      loadProject: async ({ videoPath, metadataPath }) => {
        const videoUrl = `media://${videoPath}`;
        const lastActiveId = get().activePresetId;
        const currentPresets = get().presets;

        set(state => {
          // --- FIX: CHỈ RESET STATE CỦA PROJECT, KHÔNG RESET PRESETS/THEME ---
          Object.assign(state, initialProjectState);

          // Khôi phục lại frame style từ preset đang active, nếu có
          if (lastActiveId && currentPresets[lastActiveId]) {
            state.frameStyles = JSON.parse(JSON.stringify(currentPresets[lastActiveId].styles));
          } else {
            state.frameStyles = initialFrameStyles; // Nếu không thì dùng style mặc định
          }

          // Cập nhật thông tin project mới
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
              mode: 'auto',
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

      updateFrameStyle: (style) => {
        set(state => {
          Object.assign(state.frameStyles, style);
          // BỎ DÒNG NÀY: state.activePresetId = null; 
        });
        // GỌI HÀM DEBOUNCE
        get()._debouncedUpdatePreset();
      },

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

        get()._debouncedUpdatePreset();
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
          mode: 'auto',
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
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set(state => { state.theme = newTheme; });
        // NEW: Lưu lại cài đặt theme mới
        window.electronAPI.setSetting('appearance.theme', newTheme);
      },
      setPreviewCutRegion: (region) => set(state => { state.previewCutRegion = region; }),
      setTimelineZoom: (zoom) => set(state => { state.timelineZoom = zoom; }),

      _debouncedUpdatePreset: () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const { activePresetId, presets, frameStyles, aspectRatio } = get();
          if (activePresetId && presets[activePresetId]) {
            set({ presetSaveStatus: 'saving' });
            set(state => {
              state.presets[activePresetId].styles = JSON.parse(JSON.stringify(frameStyles));
              state.presets[activePresetId].aspectRatio = aspectRatio;
            });

            // MODIFIED: Sử dụng setSetting để lưu presets
            window.electronAPI.setSetting('presets', get().presets);
            
            console.log(`Auto-saved preset: "${presets[activePresetId].name}"`);
            set({ presetSaveStatus: 'saved' });
            setTimeout(() => {
              if (get().presetSaveStatus === 'saved') {
                set({ presetSaveStatus: 'idle' });
              }
            }, 1500);
          }
        }, 1500);
      },

      // NEW: Action để tải cài đặt từ main process khi app được mở
      initializeSettings: async () => {
        try {
          const appearance = await window.electronAPI.getSetting<{ theme: 'light' | 'dark' }>('appearance');
          if (appearance && appearance.theme) {
            set({ theme: appearance.theme });
          }
          // Có thể tải các cài đặt khác ở đây trong tương lai
        } catch (error) {
          console.error("Could not load app settings:", error);
        }
      },
      
      initializePresets: async () => {
        try {
          // MODIFIED: Tải presets qua hệ thống settings chung
          let loadedPresets = await window.electronAPI.getSetting<Record<string, Preset>>('presets');

          if (!loadedPresets || Object.keys(loadedPresets).length === 0) {
            const defaultId = `preset-default-${Date.now()}`;
            loadedPresets = {
              [defaultId]: {
                id: defaultId,
                name: 'Default',
                styles: JSON.parse(JSON.stringify(initialFrameStyles)),
                aspectRatio: '16:9',
              }
            };
            // MODIFIED: Lưu presets mặc định qua hệ thống settings chung
            window.electronAPI.setSetting('presets', loadedPresets);
          }

          const lastUsedId = localStorage.getItem(LAST_PRESET_ID_KEY);
          set(state => {
            state.presets = loadedPresets;
            if (lastUsedId && loadedPresets[lastUsedId]) {
              state.activePresetId = lastUsedId;
              state.frameStyles = JSON.parse(JSON.stringify(loadedPresets[lastUsedId].styles));
              state.aspectRatio = loadedPresets[lastUsedId].aspectRatio;
            }
          });

        } catch (error) {
          console.error("Could not initialize presets:", error);
        }
      },

      applyPreset: (id) => {
        const preset = get().presets[id];
        if (preset) {
          set(state => {
            state.frameStyles = JSON.parse(JSON.stringify(preset.styles));
            state.aspectRatio = preset.aspectRatio;
            state.activePresetId = id;
          });
          localStorage.setItem(LAST_PRESET_ID_KEY, id);
        }
      },

      saveCurrentStyleAsPreset: (name) => {
        const id = `preset-${Date.now()}`;
        const newPreset: Preset = {
          id,
          name,
          styles: JSON.parse(JSON.stringify(get().frameStyles)),
          aspectRatio: get().aspectRatio,
        };
        set(state => {
          state.presets[id] = newPreset;
          state.activePresetId = id;
        });
        localStorage.setItem(LAST_PRESET_ID_KEY, id);
        // MODIFIED: Lưu presets qua hệ thống settings chung
        window.electronAPI.setSetting('presets', get().presets);
      },

      updateActivePreset: () => {
        // Hàm này giờ có thể được đơn giản hóa vì logic đã nằm trong _debouncedUpdatePreset
        // Tuy nhiên, giữ lại để có thể gọi thủ công nếu cần
        const { activePresetId, presets, frameStyles, aspectRatio } = get();
        if (activePresetId && presets[activePresetId]) {
          set(state => {
            state.presets[activePresetId].styles = JSON.parse(JSON.stringify(frameStyles));
            state.presets[activePresetId].aspectRatio = aspectRatio;
          });
          _persistPresets(get().presets);
        }
      },

      deletePreset: (id) => {
        set(state => {
          delete state.presets[id];
          if (state.activePresetId === id) {
            state.activePresetId = null;
            localStorage.removeItem(LAST_PRESET_ID_KEY);
          }
        });
        // MODIFIED: Lưu presets qua hệ thống settings chung
        window.electronAPI.setSetting('presets', get().presets);
      },

      reset: () => set(state => {
        // Hàm reset này sẽ reset tất cả, bao gồm cả project và app state
        Object.assign(state, initialProjectState);
        Object.assign(state, initialAppState);
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