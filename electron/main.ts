// electron/main.ts

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

const schema = {
	windowBounds: {
		type: 'object',
		properties: {
			width: { type: 'number' },
			height: { type: 'number' },
			x: { type: 'number' },
			y: { type: 'number' },
		},
		default: { width: 1280, height: 800 } // Giá trị mặc định khi chưa có cài đặt
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

// NEW: Khởi tạo store với schema đã định nghĩa
const store = new Store({ schema });

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
type ResolutionKey = '720p' | '1080p' | '2k';

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

let pythonTracker: ChildProcessWithoutNullStreams | null = null
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null
let metadataStream: fsSync.WriteStream | null = null

let pythonDataBuffer = ''
let firstChunkWritten = true

async function handleLoadPresets() {
  log.info('[Main] Loading presets from electron-store.');
  const presets = store.get('presets');
  log.info('[Main] Presets loaded successfully.');
  return presets;
}

// MODIFIED: Thay thế logic ghi file cũ bằng electron-store
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
  // Đảm bảo chiều rộng là số chẵn để tương thích với nhiều codec video
  const finalWidth = width % 2 === 0 ? width : width + 1;

  return { width: finalWidth, height: baseHeight };
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
function createEditorWindow(videoPath: string, metadataPath: string) {
  const { x, y, width, height } = store.get('windowBounds') as { x?: number; y?: number; width: number; height: number; };

  editorWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    autoHideMenuBar: true,
    // MODIFIED: Sử dụng kích thước và vị trí đã lưu
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

  // NEW: Logic lưu vị trí và kích thước cửa sổ khi thay đổi hoặc đóng
  let resizeTimeout: NodeJS.Timeout;
  const saveBounds = () => {
    if (editorWin && !editorWin.isDestroyed()) {
      const bounds = editorWin.getBounds();
      log.info(`[Main] Saving window bounds:`, bounds);
      store.set('windowBounds', bounds);
    }
  };

  // Sử dụng debounce để tránh ghi file liên tục khi thay đổi kích thước
  const debouncedSaveBounds = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(saveBounds, 500);
  };

  editorWin.on('resize', debouncedSaveBounds);
  editorWin.on('move', debouncedSaveBounds);
  editorWin.on('close', saveBounds); // Lưu ngay lập tức khi đóng

  // Maximize the window and show it when it's ready
  // editorWin.maximize() // REMOVED: Không maximize mặc định nữa để nhớ vị trí
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
    editorWin?.webContents.send('project:open', { videoPath, metadataPath });
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
    // 1. Stop Python tracker and close metadata stream
    if (pythonTracker) {
      if (pythonDataBuffer.trim() && metadataStream) {
        if (!firstChunkWritten) {
          metadataStream.write(',\n')
        }
        metadataStream.write(pythonDataBuffer.trim())
        firstChunkWritten = false
        pythonDataBuffer = '' // Clear buffer
      }
      pythonTracker.kill()
      pythonTracker = null
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

async function startActualRecording(ffmpegArgs: string[]) {
  const recordingDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.screenawesome');
  await ensureDirectoryExists(recordingDir);
  const baseName = `ScreenAwesome-recording-${Date.now()}`
  const videoPath = path.join(recordingDir, `${baseName}.mp4`);
  const metadataPath = path.join(recordingDir, `${baseName}.json`);

  recorderWin?.hide()

  createCountdownWindow()

  // Python setup (no changes needed here)
  let pythonExecutable: string;
  let scriptArgs: string[] = [];
  if (app.isPackaged) {
    const executableName = process.platform === 'win32' ? 'tracker.exe' : 'tracker';
    pythonExecutable = path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'dist', 'tracker', executableName);
  } else {
    pythonExecutable = path.join(process.env.APP_ROOT, 'venv/bin/python');
    const scriptPath = path.join(process.env.APP_ROOT, 'python/tracker.py');
    scriptArgs = [scriptPath];
  }

  setTimeout(() => {
    countdownWin?.close()

    // 1. Reset state
    pythonDataBuffer = ''
    firstChunkWritten = true

    // 2. Start Python tracker
    try {
      pythonTracker = spawn(pythonExecutable, scriptArgs);
    } catch (error) {
      log.error('Failed to spawn Python process:', error);
      return;
    }

    // 3. Create metadata stream
    metadataStream = fsSync.createWriteStream(metadataPath)
    metadataStream.write('[\n')

    pythonTracker.stdout.on('data', (data) => {
      // ... (logic xử lý data của python không đổi)
      pythonDataBuffer += data.toString('utf-8')
      const lines = pythonDataBuffer.split('\n')
      const completeLines = lines.slice(0, -1)
      pythonDataBuffer = lines[lines.length - 1]
      if (completeLines.length > 0 && metadataStream) {
        completeLines.forEach((line) => {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            if (!firstChunkWritten) {
              metadataStream?.write(',\n')
            }
            metadataStream?.write(trimmedLine)
            firstChunkWritten = false
          }
        })
      }
    })

    pythonTracker.stderr.on('data', (data) => {
      console.error(`Python Tracker Error: ${data}`)
    })

    // 4. Start FFmpeg with the provided arguments
    const finalArgs = [...ffmpegArgs, videoPath]; // Add output path
    log.info(`FFmpeg path: ${FFMPEG_PATH}`)
    log.info(`Starting FFmpeg with args: ${finalArgs.join(' ')}`)
    ffmpegProcess = spawn(FFMPEG_PATH, finalArgs)
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
          await handleStopRecording(videoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: false, filePath: videoPath });
        },
      },
      {
        label: 'Cancel Recording',
        click: async () => {
          await handleCancelRecording(videoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: true, filePath: undefined });
        },
      },
    ])
    tray.setToolTip('ScreenAwesome is recording...')
    tray.setContextMenu(contextMenu)

  }, 3800) // Countdown delay

  return { canceled: false, filePath: videoPath }
}

async function checkLinuxTools(): Promise<{ [key: string]: boolean }> {
  log.info('Checking Linux tools...');
  if (process.platform !== 'linux') {
    log.info(`Linux tools check skipped for platform ${process.platform}`);
    return { wmctrl: true, xwininfo: true, import: true }; // Mặc định là true cho các OS khác
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
      // Dùng -lG để lấy ID, geometry và title cùng lúc
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

            // Lọc các cửa sổ không phù hợp (VD: panels, docks, chính app)
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

              // Thêm -resize 320x180! vào lệnh. 
              // Dấu '!' buộc resize chính xác kích thước, không giữ tỷ lệ gốc,
              // phù hợp cho thumbnail.
              const command = `import -window ${id} -resize 320x180! png:-`;

              console.log(`window ${id} ${name} command: ${command}`);

              exec(command, { encoding: 'binary', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                let thumbnailUrl = GRAY_PLACEHOLDER_URL; // Mặc định là ảnh placeholder

                if (err) {
                  log.warn(`Failed to capture thumbnail for window ${id} (${name}), using placeholder. Error:`, err.message);
                  // Không return null nữa, vẫn resolve để cửa sổ hiện ra
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
          // Không cần lọc null nữa vì chúng ta luôn resolve một object
          resolve(sources);
        });
      });
    });
  }

  // Logic cũ cho Windows/macOS không đổi
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
  geometry?: { x: number, y: number, width: number, height: number }; // Thêm geometry
  windowTitle?: string;
}) {
  const { source, geometry, windowTitle } = options;
  const display = process.env.DISPLAY || ':0.0';

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
        const ffmpegArgs = [
          '-f', 'x11grab',
          '-video_size', `${safeWidth}x${safeHeight}`,
          '-i', `${display}+${intX},${intY}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
        ];
        log.info(`Starting WINDOW recording for geometry: ${safeWidth}x${safeHeight}+${intX},${intY}`);
        return startActualRecording(ffmpegArgs);
      } else if (process.platform === 'win32') {
        if (!windowTitle) {
          log.error('Window recording started without a window title.');
          dialog.showErrorBox('Recording Error', 'No window was selected for recording.');
          return { canceled: true, filePath: undefined };
        }
        const ffmpegArgs = [
          '-f', 'gdigrab',
          '-i', `title=${windowTitle}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
        ];
        log.info(`Starting WINDOW recording for title: "${windowTitle}"`);
        return startActualRecording(ffmpegArgs);
      } else if (process.platform === 'darwin') {
        const ffmpegArgs = [
          '-f', 'avfoundation',
          '-i', '1',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
        ];
        log.info('Starting SCREEN recording on macOS');
        return startActualRecording(ffmpegArgs);
      } else {
        log.error('Window recording is not yet supported on this platform.');
        dialog.showErrorBox('Feature Not Supported', 'Window recording is not yet implemented for this OS.');
        return { canceled: true, filePath: undefined };
      }
    }
  }

  if (source === 'area') {
    // Hide the recorder and open selection window
    recorderWin?.hide();
    createSelectionWindow();

    // Await for selection to be made
    return new Promise((resolve) => {
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
          resolve({ canceled: true, filePath: undefined });
          return;
        }

        log.info(`Received selection geometry: ${JSON.stringify(geometry)}. Adjusted to: ${safeWidth}x${safeHeight}`);

        const ffmpegArgs = [
          '-f', 'x11grab',
          // Use the adjusted safe dimensions
          '-video_size', `${safeWidth}x${safeHeight}`,
          '-i', `${display}+${geometry.x},${geometry.y}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
        ];
        resolve(startActualRecording(ffmpegArgs));
      });

      ipcMain.once('selection:cancel', () => {
        log.info('Selection was cancelled.');
        selectionWin?.close();
        recorderWin?.show(); // Show recorder again
        resolve({ canceled: true, filePath: undefined });
      });
    });

  } else { // Default to fullscreen
    const ffmpegArgs = [
      '-f', 'x11grab',
      '-i', display,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
    ];
    return startActualRecording(ffmpegArgs);
  }
}

async function handleStopRecording(videoPath: string, metadataPath: string) {
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
    createEditorWindow(videoPath, metadataPath);
  } else {
    editorWin.webContents.send('project:open', { videoPath, metadataPath });
    editorWin.focus();
  }
  // Close recorder window
  recorderWin?.close();
}

async function handleCancelRecording(videoPath: string, metadataPath: string) {
  log.info('Cancelling recording and deleting files...');

  // Stop processes without waiting for saving
  if (pythonTracker) {
    pythonTracker.kill();
    pythonTracker = null;
  }
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
      if (fsSync.existsSync(videoPath)) await fs.unlink(videoPath);
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
  recorderWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    width: 800,
    height: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    // --- VIBRANCY SETTINGS ---
    // For macOS, uncomment the line below for a native blur effect
    // vibrancy: 'under-window',
    // For Windows and Linux, 'transparent: true' is key.
    // The blur effect is then handled by CSS in the renderer process.
    // We must ensure no background color is set here if transparent is true.
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
  if (pythonTracker || ffmpegProcess) {
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
    projectState.aspectRatio // Lấy aspectRatio từ state của project
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

  // CHÚ THÍCH: Định nghĩa hàm xử lý việc hủy export.
  const cancellationHandler = () => {
    log.warn('[Main] Received "export:cancel" event. Terminating export.');

    // Giết tiến trình FFmpeg ngay lập tức
    if (!ffmpegClosed && ffmpeg) {
      ffmpeg.kill('SIGKILL');
      ffmpegClosed = true;
    }

    // Đóng cửa sổ render worker
    if (renderWorker) {
      renderWorker.close();
      renderWorker = null;
    }

    // Xóa file output đang được tạo dở
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
  // CHÚ THÍCH: Sử dụng .once() để lắng nghe sự kiện hủy. Listener sẽ tự động bị gỡ bỏ sau khi được gọi.
  ipcMain.once('export:cancel', cancellationHandler);


  // 7. Handle when FFmpeg process ends
  ffmpeg.on('close', (code) => {
    ffmpegClosed = true;
    log.info(`[Main] FFmpeg process exited with code ${code}.`);
    renderWorker?.close(); // Close worker window
    renderWorker = null;

    // CHÚ THÍCH: Sửa đổi logic để xử lý trường hợp bị hủy.
    // Nếu `code` là null, nghĩa là tiến trình đã bị giết bởi `cancellationHandler`.
    if (code === null) {
      log.info(`[Main] Export was cancelled. Sending 'export:complete' to editor.`);
      window.webContents.send('export:complete', { success: false, error: 'Export cancelled by user.' });
    } else {
      // Logic cũ cho trường hợp thành công hoặc thất bại thông thường.
      if (code === 0) {
        log.info(`[Main] Export successful. Sending 'export:complete' to editor.`);
        window.webContents.send('export:complete', { success: true, outputPath });
      } else {
        log.error(`[Main] Export failed. Sending 'export:complete' to editor with error.`);
        window.webContents.send('export:complete', { success: false, error: `FFmpeg exited with code ${code}` });
      }
    }

    // Important: Remove listeners to avoid memory leaks for subsequent exports
    ipcMain.removeListener('export:frame-data', frameListener);
    ipcMain.removeListener('export:render-finished', finishListener);
    // CHÚ THÍCH: Gỡ bỏ listener hủy để tránh gọi nhầm trong lần export sau.
    // (Không cần thiết nếu dùng .once() nhưng để đây cho rõ ràng)
    ipcMain.removeListener('export:cancel', cancellationHandler);
  });

  // 8. Fix: Move data sending logic here, waiting for 'ready' signal from worker
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

    // FIX: Handle both absolute paths (for videos) and relative paths (for assets).

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

  ipcMain.handle('linux:check-tools', checkLinuxTools);
  ipcMain.handle('desktop:get-sources', handleGetDesktopSources);
  ipcMain.handle('recording:start', handleStartRecording)
  ipcMain.handle('fs:readFile', handleReadFile);
  ipcMain.handle('export:start', handleExportStart);
  ipcMain.handle('dialog:showSaveDialog', (_event, options) => {
    return dialog.showSaveDialog(options);
  });

  createRecorderWindow()
})