import log from 'electron-log/main';

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
// Automatically clean up old log files.
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
// Turn off console logging in production environment to keep the console clean.
if (process.env.NODE_ENV !== 'development') {
  log.transports.console.level = false;
}

process.on('uncaughtException', (error) => {
  log.error('Unhandled Exception:', error);
  // In production environment, you might want to notify the user and safely quit the app.
  // app.quit();
});

// Handle unhandled Promise rejections
// Explanation: Similar to above, but for errors occurring in async functions without .catch().
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import {
  app, BrowserWindow, ipcMain, Tray, Menu,
  nativeImage, protocol, IpcMainInvokeEvent, dialog, desktopCapturer, screen, shell
} from 'electron'
import { fileURLToPath, format as formatUrl } from 'node:url'
import path from 'node:path'
import { spawn, ChildProcessWithoutNullStreams, exec } from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import Store from 'electron-store';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const MOUSE_RECORDING_FPS = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let X11Module: any;
if (process.platform === 'linux') {
  try {
    X11Module = require('x11');
    log.info('[Main] Successfully loaded x11 module for Linux.');
  } catch (e) {
    log.error('[Main] Failed to load x11 module. Mouse tracking on Linux will be disabled.', e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GlobalMouseEvents: any;
if (process.platform === 'win32') {
  try {
    GlobalMouseEvents = require('global-mouse-events');
    log.info('[Main] Successfully loaded global-mouse-events for Windows.');
  } catch (e) {
    log.error('[Main] Failed to load global-mouse-events. Mouse tracking on Windows will be disabled.', e);
  }
}


// Interface chung để dễ quản lý
interface IMouseTracker extends EventEmitter {
  start(): void;
  stop(): void;
}

// Lớp tracker cho Linux sử dụng node-x11
class LinuxMouseTracker extends EventEmitter implements IMouseTracker {
  private intervalId: NodeJS.Timeout | null = null; // THÊM DÒNG NÀY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private X: any | null = null;

  async start() {
    // Kiểm tra module trước khi bắt đầu
    if (!X11Module) {
      log.error("[MouseTracker-Linux] Cannot start because the x11 module was not loaded.");
      return;
    }
    try {
      const display = await this.createClient();
      this.X = display.client;
      const root = display.screen[0].root;

      // Yêu cầu X server gửi các sự kiện chuột
      const queryPointer = () => {
        // KIỂM TRA THÊM ĐỂ AN TOÀN HƠN
        if (!this.X) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.X.QueryPointer(root, (err: any, pointer: any) => {
          if (err) {
            log.error('[MouseTracker-Linux] Error querying pointer:', err);
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const timestamp = Date.now();
          switch (pointer.keyMask) {
            case 0:
              this.emit('data', {
                timestamp,
                x: pointer.rootX,
                y: pointer.rootY,
                type: 'move',
              });
              break;
            // left click, middle click, right click
            case 256:
            case 512:
            case 1024:
              this.emit('data', {
                timestamp,
                x: pointer.rootX,
                y: pointer.rootY,
                type: 'click',
                button: this.mapButton(pointer.keyMask),
                pressed: true,
              });
              break;
          }

        });
      }

      // Lưu lại ID của interval
      this.intervalId = setInterval(queryPointer, 1000 / MOUSE_RECORDING_FPS);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.X.on('error', (err: any) => {
        log.error('[MouseTracker-Linux] X11 client error:', err);
      });

    } catch (err) {
      log.error('[MouseTracker-Linux] Failed to start:', err);
      // Có thể thông báo cho người dùng ở đây
    }
  }

  stop() {
    // Hủy interval trước khi đóng kết nối
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.X?.close(); // Dùng optional chaining
    this.X = null;
    log.info('[MouseTracker-Linux] Stopped listening for mouse events.');
  }

  // Helper để tạo client bất đồng bộ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createClient(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!X11Module) {
        return reject(new Error("x11 module is not available."));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      X11Module.createClient((err: Error, display: any) => {
        if (err) {
          return reject(err);
        }
        resolve(display);
      });
    });
  }

  // Map mã nút của X11 sang tên dễ hiểu
  private mapButton(buttonCode: number): string {
    switch (buttonCode) {
      case 256: return 'left';
      case 512: return 'middle';
      case 1024: return 'right';
      default: return 'unknown';
    }
  }
}

// Lớp tracker cho Windows sử dụng global-mouse-events
class WindowsMouseTracker extends EventEmitter implements IMouseTracker {
  private mouseEvents = new GlobalMouseEvents();

  start() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseEvents.on('mousemove', (event: any) => {
      this.emit('data', {
        timestamp: Date.now(),
        x: event.x,
        y: event.y,
        type: 'move',
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseEvents.on('mousedown', (event: any) => {
      this.emit('data', {
        timestamp: Date.now(),
        x: event.x,
        y: event.y,
        type: 'click',
        button: this.mapButton(event.button),
        pressed: true,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.mouseEvents.on('mouseup', (event: any) => {
      this.emit('data', {
        timestamp: Date.now(),
        x: event.x,
        y: event.y,
        type: 'click',
        button: this.mapButton(event.button),
        pressed: false,
      });
    });

    log.info('[MouseTracker-Windows] Started listening for mouse events.');
  }

  stop() {
    // Thư viện này không có phương thức stop,
    // nhưng việc gỡ bỏ listeners sẽ ngăn chặn việc phát sự kiện thêm.
    this.mouseEvents.removeAllListeners();
    log.info('[MouseTracker-Windows] Stopped listening for mouse events.');
  }

  // Map mã nút của thư viện sang tên dễ hiểu
  private mapButton(buttonCode: number): string {
    switch (buttonCode) {
      case 1: return 'left';
      case 2: return 'right'; // Lưu ý: thư viện này map nút phải là 2
      case 3: return 'middle';
      default: return 'unknown';
    }
  }
}

// Factory function để tạo tracker phù hợp
function createMouseTracker(): IMouseTracker | null {
  switch (process.platform) {
    case 'linux':
      if (!X11Module) {
        log.error('[Main] x11 module is not available. Cannot track mouse on Linux.');
        dialog.showErrorBox('Dependency Missing', 'Could not load the required module for mouse tracking on Linux. Recording will continue without mouse data.');
        return null;
      }
      return new LinuxMouseTracker();
    case 'win32':
      if (!GlobalMouseEvents) {
        log.error('[Main] global-mouse-events module is not available. Cannot track mouse on Windows.');
        dialog.showErrorBox('Dependency Missing', 'Could not load the required module for mouse tracking on Windows. Recording will continue without mouse data.');
        return null;
      }
      return new WindowsMouseTracker();
    default:
      log.warn(`Mouse tracking not supported on platform: ${process.platform}`);
      // Không cần hiển thị dialog ở đây nữa vì startRecording sẽ không có tracker
      return null;
  }
}

const schema = {
  windowBounds: {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      x: { type: 'number' },
      y: { type: 'number' },
    },
    default: { width: 1280, height: 800 } // Default values when no settings exist
  },
  appearance: {
    type: 'object',
    properties: {
      theme: { type: 'string', enum: ['light', 'dark'], default: 'light' }
    },
    default: {}
  },
  presets: {
    type: 'object',
    default: {}
  }
};

const store = new Store({ schema });

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
type ResolutionKey = '720p' | '1080p' | '2k';
type DisplayInfo = {
  id: number;
  name: string;
  bounds: Electron.Rectangle;
  isPrimary: boolean;
}

const RESOLUTIONS: Record<ResolutionKey, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let recorderWin: BrowserWindow | null
let editorWin: BrowserWindow | null
let countdownWin: BrowserWindow | null = null;
let renderWorker: BrowserWindow | null = null;
let savingWin: BrowserWindow | null = null;
let selectionWin: BrowserWindow | null = null;
let tray: Tray | null = null

let mouseTracker: IMouseTracker | null = null;
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null
let metadataStream: fsSync.WriteStream | null = null

let firstChunkWritten = true
let recordingStartTime: number = 0;

let framesSentCount = 0; // Counter for frames actually sent during export


async function handleLoadPresets() {
  log.info('[Main] Loading presets from electron-store.');
  const presets = store.get('presets');
  log.info('[Main] Presets loaded successfully.');
  return presets;
}

async function handleSavePresets(_event: IpcMainInvokeEvent, presets: unknown) {
  log.info('[Main] Saving presets to electron-store.');
  store.set('presets', presets);
  log.info('[Main] Presets saved successfully.');
  return { success: true };
}

function calculateExportDimensions(resolutionKey: ResolutionKey, aspectRatio: string): { width: number; height: number } {
  const baseHeight = RESOLUTIONS[resolutionKey].height; // e.g., 1080 for '1080p'
  const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
  const aspectRatioValue = ratioW / ratioH;

  const width = Math.round(baseHeight * aspectRatioValue);
  // Ensure width is even for better compatibility with many video codecs
  const finalWidth = width % 2 === 0 ? width : width + 1;

  return { width: finalWidth, height: baseHeight };
}

async function handleGetDisplays(): Promise<DisplayInfo[]> {
  log.info('[Main] Getting all displays...');
  const primaryDisplay = screen.getPrimaryDisplay();
  const allDisplays = screen.getAllDisplays();

  const displays = allDisplays.map((display, index) => ({
    id: display.id,
    name: `Display ${index + 1} (${display.bounds.width}x${display.bounds.height})`,
    bounds: display.bounds,
    isPrimary: display.id === primaryDisplay.id,
  }));

  log.info('[Main] Found displays:', displays);
  return displays;
}

async function handleGetVideoFrame(_event: IpcMainInvokeEvent, { videoPath, time }: { videoPath: string, time: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    log.info(`[Main] Extracting frame from "${videoPath}" at ${time}s`);

    const command = `"${FFMPEG_PATH}" -ss ${time} -i "${videoPath}" -vframes 1 -f image2pipe -c:v png -`;

    exec(command, { encoding: 'binary', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        log.error(`[Main] FFmpeg frame extraction error: ${stderr}`);
        return reject(error);
      }

      const buffer = Buffer.from(stdout, 'binary');
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
      log.info(`[Main] Frame extracted successfully.`);
      resolve(base64Image);
    });
  });
}

function getFFmpegPath(): string {
  // path to ffmpeg in production
  if (app.isPackaged) {
    const platform = process.platform;
    let executableName = 'ffmpeg';
    if (platform === 'win32') {
      executableName += '.exe';
    }

    // path to ffmpeg in production
    const ffmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'binaries', platform, executableName);
    log.info(`[Production] Using bundled FFmpeg at: ${ffmpegPath}`);
    return ffmpegPath;
  }

  // path to ffmpeg in development
  else {
    const platform = process.platform === 'win32' ? 'win' : 'linux';
    const executableName = platform === 'win' ? 'ffmpeg.exe' : 'ffmpeg';

    // path to ffmpeg in development
    const ffmpegPath = path.join(process.env.APP_ROOT, 'binaries', platform, executableName);
    log.info(`[Development] Using local FFmpeg at: ${ffmpegPath}`);
    return ffmpegPath;
  }
}

const FFMPEG_PATH = getFFmpegPath();

// --- Saving Window Creation ---
function createSavingWindow() {
  savingWin = new BrowserWindow({
    width: 350,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  const savingUrl = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public/saving/index.html')
    : path.join(RENDERER_DIST, 'saving/index.html');

  savingWin.loadFile(savingUrl);

  savingWin.on('closed', () => {
    savingWin = null;
  });
}

// --- Editor Window Creation ---
function createEditorWindow(videoPath: string, metadataPath: string, webcamVideoPath: string | undefined) {
  const { x, y, width, height } = store.get('windowBounds') as { x?: number; y?: number; width: number; height: number; };

  editorWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    autoHideMenuBar: true,
    x,
    y,
    width,
    height,
    minWidth: 1024,
    minHeight: 768,
    frame: false, // Frameless on Win/Linux
    titleBarStyle: 'hidden', // Keep traffic lights on macOS
    show: false, // Don't show the window until it's ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: VITE_DEV_SERVER_URL ? false : true,
    },
  })

  // Logic to save window position and size when changed or closed
  let resizeTimeout: NodeJS.Timeout;
  const saveBounds = () => {
    if (editorWin && !editorWin.isDestroyed()) {
      const bounds = editorWin.getBounds();
      log.info(`[Main] Saving window bounds:`, bounds);
      store.set('windowBounds', bounds);
    }
  };

  // Use debounce to avoid continuous file writing when resizing
  const debouncedSaveBounds = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(saveBounds, 500);
  };

  editorWin.on('resize', debouncedSaveBounds);
  editorWin.on('move', debouncedSaveBounds);
  editorWin.on('close', saveBounds); // Save immediately when closing

  // Maximize the window and show it when it's ready
  editorWin.show()

  let editorUrl: string;
  if (VITE_DEV_SERVER_URL) {
    // Development: Use the dev server URL
    editorUrl = `${VITE_DEV_SERVER_URL}#editor`;
  } else {
    // Production: Create a valid file:// URL
    editorUrl = formatUrl({
      pathname: path.join(RENDERER_DIST, 'index.html'),
      protocol: 'file:',
      slashes: true,
      hash: 'editor'
    });
  }

  log.info(`[Main] Loading editor URL: ${editorUrl}`);
  editorWin.loadURL(editorUrl);

  // Send project files to the editor window once it's ready
  editorWin.webContents.on('did-finish-load', () => {
    log.info(`[Main] Editor window finished loading. Sending project data...`);
    editorWin?.webContents.send('project:open', { videoPath, metadataPath, webcamVideoPath });
  });

  // if (process.env.NODE_ENV === 'development') {
  //   editorWin.webContents.openDevTools();
  // }

  editorWin.on('closed', () => {
    editorWin = null;
  });
}

function cleanupAndSave(): Promise<void> {
  return new Promise((resolve) => {
    // 1. Stop Mouse tracker and close metadata stream (LOGIC MỚI)
    if (mouseTracker) {
      mouseTracker.stop(); // Dừng tracker
      mouseTracker = null;
    }

    if (metadataStream) {
      if (!metadataStream.writableEnded) {
        metadataStream.write('\n]');
        metadataStream.end();
      }
      metadataStream = null;
    }

    // 2. Handle FFmpeg and wait for it to finish
    if (ffmpegProcess) {
      const ffmpeg = ffmpegProcess;
      ffmpegProcess = null; // Assign null immediately to avoid calling again

      // Listen for 'close' event to know when ffmpeg has finished
      ffmpeg.on('close', (code) => {
        log.info(`FFmpeg process exited with code ${code}`);
        resolve(); // Complete Promise when ffmpeg has closed
      });

      // Send 'q' to ffmpeg to end it safely
      ffmpeg.stdin.write('q');
      ffmpeg.stdin.end();

    } else {
      // If there's no ffmpeg process, resolve immediately
      resolve();
    }
  });
}

function createCountdownWindow() {
  countdownWin = new BrowserWindow({
    width: 380,
    height: 380,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })

  const countdownUrl = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public/countdown/index.html')
    : path.join(RENDERER_DIST, 'countdown/index.html')

  countdownWin.loadFile(countdownUrl)

  countdownWin.on('closed', () => {
    countdownWin = null
  })
}

function createSelectionWindow() {
  selectionWin = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true, // Required for renderer.js to use require('electron')
      contextIsolation: false,
    }
  });

  const selectionUrl = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public/selection/index.html')
    : path.join(RENDERER_DIST, 'selection/index.html');

  selectionWin.loadFile(selectionUrl);

  selectionWin.on('closed', () => {
    selectionWin = null;
  });
}


async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
}

async function startActualRecording(inputArgs: string[], hasWebcam: boolean) {
  const recordingDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.screenawesome');
  await ensureDirectoryExists(recordingDir);
  const baseName = `ScreenAwesome-recording-${Date.now()}`;

  // Create separate paths for screen and webcam
  const screenVideoPath = path.join(recordingDir, `${baseName}-screen.mp4`);
  const webcamVideoPath = hasWebcam ? path.join(recordingDir, `${baseName}-webcam.mp4`) : undefined;
  const metadataPath = path.join(recordingDir, `${baseName}.json`);

  recorderWin?.hide()

  createCountdownWindow()

  setTimeout(() => {
    countdownWin?.close()

    // 1. Reset state
    firstChunkWritten = true
    recordingStartTime = Date.now(); // LƯU THỜI ĐIỂM BẮT ĐẦU

    // 2. Start Mouse Tracker (LOGIC MỚI)
    mouseTracker = createMouseTracker();

    // 3. Create metadata stream
    metadataStream = fsSync.createWriteStream(metadataPath)
    metadataStream.write('[\n')

    // 4. Listen for data from the tracker
    if (mouseTracker) {
      mouseTracker.on('data', (data) => {
        const relativeTimestampData = {
          ...data,
          timestamp: data.timestamp - recordingStartTime,
        };
        const jsonLine = JSON.stringify(relativeTimestampData);
        if (metadataStream?.writable) {
          if (!firstChunkWritten) {
            metadataStream.write(',\n');
          }
          metadataStream.write(jsonLine);
          firstChunkWritten = false;
        }
      });
      mouseTracker.start();
    }

    // 4. Start FFmpeg with the provided arguments
    const finalArgs = [...inputArgs];
    if (hasWebcam) {
      // Input 0 is webcam, Input 1 is screen.
      // We want the main (first) file to be the screen recording.
      finalArgs.push(
        '-map', '1:v', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', screenVideoPath,
        '-map', '0:v', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', webcamVideoPath!
      );
    } else {
      // Only one input (screen)
      finalArgs.push(
        '-map', '0:v', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', screenVideoPath
      );
    }
    log.info(`FFmpeg path: ${FFMPEG_PATH}`)
    log.info(`Starting FFmpeg with args: ${finalArgs.join(' ')}`)
    ffmpegProcess = spawn(FFMPEG_PATH, finalArgs);
    ffmpegProcess.stderr.on('data', (data) => {
      log.info(`FFmpeg: ${data}`)
    })

    // 5. Create Tray Icon
    const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon-tray.png'))
    tray = new Tray(icon)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Stop Recording',
        click: async () => {
          await handleStopRecording(screenVideoPath, webcamVideoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: false, screenVideoPath, webcamVideoPath });
        },
      },
      {
        label: 'Cancel Recording',
        click: async () => {
          await handleCancelRecording(screenVideoPath, webcamVideoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: true });
        },
      },
    ])
    tray.setToolTip('ScreenAwesome is recording...')
    tray.setContextMenu(contextMenu)

  }, 3800) // Countdown delay

  return { canceled: false, screenVideoPath, webcamVideoPath };
}

async function checkLinuxTools(): Promise<{ [key: string]: boolean }> {
  log.info('Checking Linux tools...');
  if (process.platform !== 'linux') {
    log.info(`Linux tools check skipped for platform ${process.platform}`);
    return { wmctrl: true, xwininfo: true, import: true }; // Default to true for other OS
  }
  log.info(`Checking Linux tools: ${['wmctrl', 'xwininfo', 'import'].join(', ')}`);
  const tools = ['wmctrl', 'xwininfo', 'import'];
  const results: { [key: string]: boolean } = {};
  for (const tool of tools) {
    results[tool] = await new Promise((resolve) => {
      exec(`command -v ${tool}`, (error) => {
        if (error) {
          log.warn(`Linux tool not found: ${tool}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  log.info('Linux tools check results:', results);
  return results;
}

const GRAY_PLACEHOLDER_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mN88A8AAsUB4/Yo4OQAAAAASUVORK5CYII=';
const EXCLUDED_WINDOW_NAMES = ['Screen Awesome'];

async function handleGetDesktopSources() {
  if (process.platform === 'linux') {
    return new Promise((resolve, reject) => {
      // Use -lG to get ID, geometry and title at the same time
      log.info('Executing wmctrl -lG');
      exec('wmctrl -lG', (error, stdout) => {
        if (error) {
          log.error('Failed to execute wmctrl:', error);
          return reject(error);
        }

        const lines = stdout.trim().split('\n');
        log.info('wmctrl -lG output:', lines);

        const sourcesPromises = lines
          .map(line => {
            const match = line.match(/^(0x[0-9a-f]+)\s+[\d-]+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+[\w-]+\s+(.*)$/);
            if (!match) return null;

            const [, id, x, y, width, height, name] = match;

            // Filter out windows that are not suitable (e.g. panels, docks, main app)
            if (!name || EXCLUDED_WINDOW_NAMES.some(excludedName => name.includes(excludedName)) ||
              parseInt(width) < 50 || parseInt(height) < 50) {
              return null;
            }

            return new Promise(resolveSource => {
              const geometry = {
                x: parseInt(x),
                y: parseInt(y),
                width: parseInt(width),
                height: parseInt(height)
              };

              // Add -resize 320x180! to the command. 
              // The '!' forces the resize to be exact, not maintaining the original aspect ratio,
              // suitable for thumbnails.
              const command = `import -window ${id} -resize 320x180! png:-`;

              console.log(`window ${id} ${name} command: ${command}`);

              exec(command, { encoding: 'binary', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                let thumbnailUrl = GRAY_PLACEHOLDER_URL; // Default to placeholder image

                if (err) {
                  log.warn(`Failed to capture thumbnail for window ${id} (${name}), using placeholder. Error:`, err.message);
                  // Do not return null, still resolve to show the window
                } else {
                  const buffer = Buffer.from(stdout, 'binary');
                  thumbnailUrl = `data:image/png;base64,${buffer.toString('base64')}`;
                  log.info(`Captured thumbnail for window ${id} (${name})`);
                }

                resolveSource({
                  id,
                  name,
                  thumbnailUrl,
                  geometry,
                });
              });
            });
          })
          .filter(p => p !== null);

        Promise.all(sourcesPromises).then(sources => {
          // No need to filter null anymore since we always resolve an object
          resolve(sources);
        });
      });
    });
  }

  // Logic for Windows/macOS
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 320, height: 180 }
  });

  return sources
    .filter(source => source.name && source.name !== 'ScreenAwesome')
    .map(source => ({
      id: source.id,
      name: source.name,
      thumbnailUrl: source.thumbnail.toDataURL(),
    }));
}

async function handleStartRecording(_event: IpcMainInvokeEvent, options: {
  source: 'fullscreen' | 'area' | 'window',
  geometry?: { x: number, y: number, width: number, height: number };
  windowTitle?: string;
  displayId?: number;
  webcam?: { deviceId: string; deviceLabel: string; index: number };
}) {
  const { source, geometry, windowTitle, displayId, webcam } = options;
  const display = process.env.DISPLAY || ':0.0';
  const baseFfmpegArgs: string[] = [];
  let webcamInputAdded = false;

  // --- Webcam Input ---
  // This is the core fix. Use the correct identifier for each platform.
  if (webcam) {
    log.info('[Main] Adding webcam input:', webcam.deviceLabel);
    switch (process.platform) {
      case 'linux':
        // On Linux, we need the device path, which we construct from the index.
        // The first camera found is almost always /dev/video0, the second /dev/video1, etc.
        baseFfmpegArgs.push('-f', 'v4l2', '-i', `/dev/video${webcam.index}`);
        break;
      case 'win32':
        // On Windows, dshow uses the human-readable device name (the label).
        baseFfmpegArgs.push('-f', 'dshow', '-i', `video=${webcam.deviceLabel}`);
        break;
      case 'darwin':
        // On macOS, avfoundation uses the device index.
        baseFfmpegArgs.push('-f', 'avfoundation', '-i', `${webcam.index}:none`);
        break;
    }
    webcamInputAdded = true;
  }

  if (source === 'window') {
    if (process.platform === 'linux') {
      if (!geometry) {
        log.error('Window recording on Linux started without geometry.');
        dialog.showErrorBox('Recording Error', 'No window geometry was provided for recording.');
        return { canceled: true, filePath: undefined };
      }

      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.size;

      // Ensure all geometry values are integers
      const intX = Math.round(geometry.x);
      const intY = Math.round(geometry.y);
      let finalWidth = Math.round(geometry.width);
      let finalHeight = Math.round(geometry.height);

      // Clamp dimensions to ensure the capture area is within screen bounds
      if (intX + finalWidth > screenWidth) {
        finalWidth = screenWidth - intX;
      }
      if (intY + finalHeight > screenHeight) {
        finalHeight = screenHeight - intY;
      }

      // Ensure width/height are even numbers for libx264 compatibility
      const safeWidth = Math.floor(finalWidth / 2) * 2;
      const safeHeight = Math.floor(finalHeight / 2) * 2;

      if (safeWidth < 10 || safeHeight < 10) {
        log.error('Selected window is too small to record.');
        dialog.showErrorBox('Recording Error', 'The selected window is too small to record.');
        return { canceled: true, filePath: undefined };
      }

      if (process.platform === 'linux') {
        log.info(`Starting WINDOW recording for geometry: ${safeWidth}x${safeHeight}+${intX},${intY}`);
        const { x, y, width, height } = geometry;
        baseFfmpegArgs.push('-f', 'x11grab', '-video_size', `${width}x${height}`, '-i', `${display}+${x},${y}`);
      } else if (process.platform === 'win32') {
        if (!windowTitle) {
          log.error('Window recording started without a window title.');
          dialog.showErrorBox('Recording Error', 'No window was selected for recording.');
          return { canceled: true, filePath: undefined };
        }
        log.info(`Starting WINDOW recording for title: "${windowTitle}"`);
        baseFfmpegArgs.push('-f', 'gdigrab', '-i', `title=${windowTitle}`);
      } else if (process.platform === 'darwin') {
        // const ffmpegArgs = [
        //   '-f', 'avfoundation',
        //   '-i', '1',
        //   '-c:v', 'libx264',
        //   '-preset', 'ultrafast',
        //   '-pix_fmt', 'yuv420p',
        // ];
        // log.info('Starting SCREEN recording on macOS');
      } else {
        log.error('Window recording is not yet supported on this platform.');
        dialog.showErrorBox('Feature Not Supported', 'Window recording is not yet implemented for this OS.');
        return { canceled: true, filePath: undefined };
      }
    }
  } else if (source === 'area') {
    // Hide the recorder and open selection window
    recorderWin?.hide();
    createSelectionWindow();

    // Await for selection to be made
    const selectedGeometry = await new Promise<{ x: number; y: number; width: number; height: number } | undefined>((resolve) => {
      ipcMain.once('selection:complete', (_event, geometry: { x: number; y: number; width: number; height: number }) => {
        selectionWin?.close();

        // Ensure width and height are even numbers for libx264 compatibility
        const safeWidth = Math.floor(geometry.width / 2) * 2;
        const safeHeight = Math.floor(geometry.height / 2) * 2;

        // Check if the resulting size is too small to record
        if (safeWidth < 10 || safeHeight < 10) {
          log.error('Selected area is too small to record after adjustment.');
          recorderWin?.show(); // Show recorder again
          dialog.showErrorBox('Recording Error', 'The selected area is too small to record. Please select a larger area.');
          // resolve({ canceled: true, filePath: undefined });
          resolve(undefined);
          return;
        }

        log.info(`Received selection geometry: ${JSON.stringify(geometry)}. Adjusted to: ${safeWidth}x${safeHeight}`);

        resolve(geometry);
      });

      ipcMain.once('selection:cancel', () => {
        log.info('Selection was cancelled.');
        selectionWin?.close();
        recorderWin?.show(); // Show recorder again
        resolve(undefined);
      });
    });

    if (!selectedGeometry) {
      return { canceled: true, filePath: undefined };
    }

    baseFfmpegArgs.push(
      '-f', 'x11grab',
      '-video_size', `${selectedGeometry.width}x${selectedGeometry.height}`,
      '-i', `${display}+${selectedGeometry.x},${selectedGeometry.y}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
    );

    return startActualRecording(baseFfmpegArgs, webcamInputAdded);
  } else {
    const allDisplays = screen.getAllDisplays();
    const targetDisplay = allDisplays.find(d => d.id === displayId) || screen.getPrimaryDisplay();
    const { x, y, width, height } = targetDisplay.bounds;
    const safeWidth = Math.floor(width / 2) * 2;
    const safeHeight = Math.floor(height / 2) * 2;

    // Add arguments to `baseFfmpegArgs`
    switch (process.platform) {
      case 'linux':
        baseFfmpegArgs.push('-f', 'x11grab', '-video_size', `${safeWidth}x${safeHeight}`, '-i', `${display}+${x},${y}`);
        break;
      case 'win32':
        baseFfmpegArgs.push('-f', 'gdigrab', '-offset_x', x.toString(), '-offset_y', y.toString(), '-video_size', `${safeWidth}x${safeHeight}`, '-i', 'desktop');
        break;
      case 'darwin': {
        const displayIndex = allDisplays.findIndex(d => d.id === targetDisplay!.id);
        baseFfmpegArgs.push('-f', 'avfoundation', '-i', `${displayIndex >= 0 ? displayIndex : 0}:none`);
        break;
      }
    }
  }

  return startActualRecording(baseFfmpegArgs, webcamInputAdded);
}

async function handleStopRecording(screenVideoPath: string, webcamVideoPath: string | undefined, metadataPath: string) {
  log.info('Stopping recording, preparing to save...');

  // 1. Destroy tray icon so user cannot click it
  tray?.destroy();
  tray = null;

  // 2. Show saving window
  createSavingWindow();

  // 3. Call cleanup and most importantly await it
  await cleanupAndSave();

  log.info('Files saved successfully.');

  // 4. Close saving window
  savingWin?.close();

  // 5. Open editor window
  if (!editorWin) {
    createEditorWindow(screenVideoPath, metadataPath, webcamVideoPath);
  } else {
    editorWin.webContents.send('project:open', {
      videoPath: screenVideoPath,
      webcamVideoPath,
      metadataPath
    });
    editorWin.focus();
  }
  // Close recorder window
  recorderWin?.close();
}

async function handleCancelRecording(screenVideoPath: string, webcamVideoPath: string | undefined, metadataPath: string) {
  log.info('Cancelling recording and deleting files...');

  if (ffmpegProcess) {
    // Kill process without waiting for saving
    ffmpegProcess.kill('SIGKILL');
    ffmpegProcess = null;
  }
  if (metadataStream) {
    metadataStream.end();
    metadataStream = null;
  }

  // Delete files
  try {
    // Wait a bit for the system to release file lock
    setTimeout(async () => {
      if (fsSync.existsSync(screenVideoPath)) await fs.unlink(screenVideoPath);
      if (webcamVideoPath && fsSync.existsSync(webcamVideoPath)) await fs.unlink(webcamVideoPath);
      if (fsSync.existsSync(metadataPath)) await fs.unlink(metadataPath);
      log.info('Temporary files deleted.');
    }, 100);
  } catch (error) {
    log.error('Could not delete temporary files:', error);
  }

  recorderWin?.show();
  tray?.destroy();
  tray = null;
}

function createRecorderWindow() {
  // Get primary display to calculate position
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = 800;
  const windowHeight = 800;

  // Calculate position: Center horizontally, 1/4 from top
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.max(0, Math.round(screenHeight / 4));

  log.info(`[Main] Creating recorder window at ${x}, ${y} with fixed size ${windowWidth}x${windowHeight}`);

  recorderWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (recorderWin?.webContents) {
    recorderWin.webContents.on('did-finish-load', () => {
      recorderWin?.webContents?.send('main-process-message', (new Date).toLocaleString())
    });
  }

  if (VITE_DEV_SERVER_URL) {
    recorderWin.loadURL(VITE_DEV_SERVER_URL)

    // Open devtools when in development in detached mode
    // recorderWin.webContents.openDevTools(
    //   { mode: 'detach' }
    // );
  } else {
    recorderWin.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  recorderWin.on('closed', () => {
    recorderWin = null;
  });
}

async function handleReadFile(_event: IpcMainInvokeEvent, filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error);
    throw error; // Propagate error back to renderer
  }
}

app.on('window-all-closed', () => {
  renderWorker?.close();
  if (ffmpegProcess) {
    cleanupAndSave();
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createRecorderWindow()
  }
})

async function handleExportStart(
  _event: IpcMainInvokeEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { projectState, exportSettings, outputPath }: { projectState: any, exportSettings: any, outputPath: string }
) {
  log.info('[Main] Received "export:start" event. Starting export process...');

  // Get reference to the main editor window to send progress updates
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (!window) return;

  // --- Start new strategy: Use Render Worker ---

  // Reset framesSentCount for each new export
  framesSentCount = 0;

  // 1. Clean up old worker if exists (to handle previous export errors)
  if (renderWorker) {
    renderWorker.close();
  }

  // 2. Create a hidden window to act as worker
  renderWorker = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Important: allow rendering without showing on screen
      offscreen: true,
    },
  });

  // 3. Load interface but with a special hash ('#renderer')
  // so App.tsx knows it needs to render the RendererPage component
  const renderUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#renderer`
    : path.join(RENDERER_DIST, 'index.html#renderer')
  renderWorker.loadURL(renderUrl);
  log.info(`[Main] Loading render worker URL: ${renderUrl}`);


  // 4. Prepare arguments for FFmpeg
  const { resolution, fps, format } = exportSettings;
  const { width: outputWidth, height: outputHeight } = calculateExportDimensions(
    resolution as ResolutionKey,
    projectState.aspectRatio
  );
  log.info(`[Main] Calculated export dimensions for ${resolution} ${projectState.aspectRatio}: ${outputWidth}x${outputHeight}`);

  const ffmpegArgs = [
    '-y', // Override output file if it exists
    '-f', 'rawvideo', // Input format is raw video
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'rgba', // Pixel format created by Canvas/Electron
    '-s', `${outputWidth}x${outputHeight}`, // Frame size
    '-r', fps.toString(), // Frame rate
    '-i', '-', // Read data from stdin (standard input)
  ];

  // Add encoding options for output format
  if (format === 'mp4') {
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-pix_fmt', 'yuv420p' // Standard pixel format for web video
    );
  } else { // GIF
    // Use ffmpeg filters to create palette, making GIFs of better quality
    ffmpegArgs.push(
      '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
    );
  }

  ffmpegArgs.push(outputPath); // Output file path

  // 5. Spawn FFmpeg process
  log.info('[Main] Spawning FFmpeg with args:', ffmpegArgs.join(' '));
  const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
  let ffmpegClosed = false;

  // Listen to FFmpeg error logs for debugging
  ffmpeg.stderr.on('data', (data) => {
    log.info(`[FFmpeg stderr]: ${data.toString()}`);
  });

  // Define cancellation handler
  const cancellationHandler = () => {
    log.warn('[Main] Received "export:cancel" event. Terminating export.');

    // Close FFmpeg process immediately
    if (!ffmpegClosed && ffmpeg) {
      ffmpeg.kill('SIGKILL');
      ffmpegClosed = true;
    }

    // Close render worker
    if (renderWorker) {
      renderWorker.close();
      renderWorker = null;
    }

    // Delete partial export file
    if (fsSync.existsSync(outputPath)) {
      fs.unlink(outputPath).then(() => log.info(`[Main] Deleted partial export file: ${outputPath}`));
    }
  };

  // 6. Listen to events from Worker through IPC
  // Listener receives frame data (Buffer) from worker
  const frameListener = (_event: IpcMainInvokeEvent, { frame, progress }: { frame: Buffer, progress: number }) => {
    // Write buffer of frame to FFmpeg stdin for processing
    if (!ffmpegClosed && ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(frame);
      framesSentCount++;
    }
    // Send progress to main editor window to update UI
    window.webContents.send('export:progress', { progress, stage: 'Rendering...' });
  };

  // Listener receives signal when worker has rendered all frames
  const finishListener = () => {
    log.info('[Main] Received "export:render-finished". Closing FFmpeg stdin.');
    if (!ffmpegClosed) {
      ffmpeg.stdin.end(); // Close stdin to signal FFmpeg to finish
    }
  };

  ipcMain.on('export:frame-data', frameListener);
  ipcMain.on('export:render-finished', finishListener);
  ipcMain.on('export:cancel', cancellationHandler);

  // 7. Handle when FFmpeg process ends
  ffmpeg.on('close', (code) => {
    ffmpegClosed = true;
    log.info(`[Main] FFmpeg process exited with code ${code}. Sent ${framesSentCount} frames.`);
    renderWorker?.close();
    renderWorker = null;

    // Handle cancellation
    if (code === null) {
      log.info(`[Main] Export was cancelled. Sending 'export:complete' to editor.`);
      window.webContents.send('export:complete', { success: false, error: 'Export cancelled by user.' });
    } else if (code === 0 && framesSentCount === 0) {
      log.error(`[Main] Export failed: Output file is empty (FFmpeg exited with code 0 but no frames were rendered).`);
      // Delete empty output file here to avoid leaving it behind.
      if (fsSync.existsSync(outputPath)) {
        fs.unlink(outputPath).then(() => log.info(`[Main] Deleted empty output file: ${outputPath}`));
      }
      window.webContents.send('export:complete', { success: false, error: 'No video frames were rendered. Ensure no "cut" regions cover the entire video.' });
    } else {
      // Logic for successful or failed exports
      if (code === 0) {
        log.info(`[Main] Export successful. Sending 'export:complete' to editor.`);
        window.webContents.send('export:complete', { success: true, outputPath });
      } else {
        log.error(`[Main] Export failed. Sending 'export:complete' to editor with error.`);
        window.webContents.send('export:complete', { success: false, error: `FFmpeg exited with code ${code}` });
      }
    }

    ipcMain.removeListener('export:frame-data', frameListener);
    ipcMain.removeListener('export:render-finished', finishListener);
    ipcMain.removeListener('export:cancel', cancellationHandler);
  });

  // 8. Move data sending logic here, waiting for 'ready' signal from worker
  ipcMain.once('render:ready', () => {
    log.info('[Main] Received "render:ready" from worker. Sending project state...');
    renderWorker?.webContents.send('render:start', {
      projectState,
      exportSettings
    });
  });
}

app.whenReady().then(() => {
  // Custom protocol to serve media files securely ---
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    const decodedUrl = decodeURIComponent(url);

    // Handle both absolute paths (for videos) and relative paths (for assets).

    // 1. Check if the decoded path is absolute and exists.
    // This handles the video file path like /home/user/.screenawesome/recording.mp4
    if (path.isAbsolute(decodedUrl) && fsSync.existsSync(decodedUrl)) {
      return callback(decodedUrl);
    }

    // 2. If not absolute, assume it's a resource relative to the public/dist folder.
    // This handles wallpapers like 'wallpapers/images/wallpaper-0001.jpg'.
    // process.env.VITE_PUBLIC correctly points to the 'public' folder in dev
    // and the app's root ('dist' folder) in production.
    const resourcePath = path.join(process.env.VITE_PUBLIC, decodedUrl);

    if (fsSync.existsSync(resourcePath)) {
      return callback(resourcePath);
    }

    // 3. If neither path is found, log an error and fail.
    log.error(`[media protocol] Could not find file at absolute path "${decodedUrl}" or resource path "${resourcePath}"`);
    return callback({ error: -6 }); // FILE_NOT_FOUND
  });

  // --- IPC Handlers for Recorder Window ---
  // MODIFIED: Removed the `center` parameter and logic. The window will now resize from its current position.
  ipcMain.on('recorder:set-size', (_event, { width, height }: { width: number, height: number }) => {
    if (recorderWin) {
      log.info(`Resizing recorder window to ${width}x${height}`);
      // Set size with animation, but DO NOT re-center.
      recorderWin.setSize(width, height, true);
    }
  });

  // --- IPC Handlers for Window Controls ---
  ipcMain.on('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });
  ipcMain.on('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });
  ipcMain.on('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });
  ipcMain.on('shell:showItemInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  // --- IPC Handlers for Presets ---
  ipcMain.handle('presets:load', handleLoadPresets);
  ipcMain.handle('presets:save', handleSavePresets);
  ipcMain.handle('settings:get', (_event, key: string) => {
    const value = store.get(key);
    log.info(`[Main] IPC settings:get - key: ${key}, value found:`, !!value);
    return value;
  });
  ipcMain.on('settings:set', (_event, key: string, value: unknown) => {
    log.info(`[Main] IPC settings:set - key: ${key}`);
    store.set(key, value);
  });

  ipcMain.handle('desktop:get-displays', handleGetDisplays);
  ipcMain.handle('linux:check-tools', checkLinuxTools);
  ipcMain.handle('desktop:get-sources', handleGetDesktopSources);
  ipcMain.handle('recording:start', handleStartRecording)
  ipcMain.handle('fs:readFile', handleReadFile);
  ipcMain.handle('export:start', handleExportStart);
  ipcMain.handle('dialog:showSaveDialog', (_event, options) => {
    return dialog.showSaveDialog(options);
  });
  ipcMain.handle('video:get-frame', handleGetVideoFrame);

  createRecorderWindow()
})