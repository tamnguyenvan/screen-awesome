# ScreenAwesome - Development Plan

This plan breaks down the development of ScreenAwesome into manageable phases, prioritizing the delivery of core functionality first. The descriptions reflect the current implementation.

## Phase 1: Core Recording Engine & MVP

**Goal:** Establish a functional recording application that can capture the screen and mouse/click metadata.

*   **Tasks:**
    1.  **Project Setup:** Initialize Electron project with Vite, TypeScript, React, and TailwindCSS.
    2.  **Recording UI:** Create the initial control bar UI (`RecorderPage`) for initiating a full-screen recording.
    3.  **Screen Capture:** Implement basic screen recording by spawning `ffmpeg` as a child process. On Linux, this uses `x11grab` to capture the entire display. The output is a raw video file (e.g., `.mp4`).
    4.  **Mouse/Click Tracking:**
        *   Integrate the `pynput` Python script (`tracker.py`).
        *   Create the logic in the Electron main process to spawn the script as a child process when recording starts.
        *   Capture the streamed JSON data from the script's `stdout` and save it to a separate metadata file (e.g., `recording.json`) synchronized with the video.
    5.  **System Tray Controls:** Implement the system tray icon with "Stop Recording" and "Cancel Recording" options.

*   **Outcome:** A user can record their screen, producing two files: a video file and a JSON file containing a timeline of mouse positions and click events.

## Phase 2: The Editing Studio Foundation

**Goal:** Build the editor's UI and enable basic video playback with frame customization.

*   **Tasks:**
    1.  **Editor Layout:** Construct the main editor window layout: Preview area, side panel, and timeline area.
    2.  **Project Loading:** Implement logic to open a project, which consists of loading the video into a `<video>` element and parsing its associated metadata file.
    3.  **Video Playback:** Use the native HTML5 `<video>` element for decoding and display in the preview area. Implement a timeline with a playhead, play/pause controls, and scrubbing functionality.
    4.  **Frame Customization Panel:** Build the UI components in the side panel for controlling:
        *   Background (color, gradient, image upload, built-in wallpapers).
        *   Padding.
        *   Border Radius, Shadow, and Border styles.
    5.  **Live Preview:** Ensure that changes made in the side panel are immediately reflected in the preview area. The video is rendered inside this "parent frame."

*   **Outcome:** A user can open a recording and customize its presentation frame in real-time.

## Phase 3: Implementing Auto-Zoom and Timeline Editing

**Goal:** Bring the "magic" to life by implementing the automatic zoom and manual timeline controls.

*   **Tasks:**
    1.  **Auto-Zoom Generation:** Upon loading a project, parse the click events from the metadata file. For each click or cluster of clicks, automatically generate a "zoom region" object in the state.
    2.  **Zoom Logic Implementation:** During video playback, check if the current timestamp falls within a zoom region. If so, calculate the necessary pan and zoom CSS transformations and apply them to the video container in the preview. Implement smooth easing functions for these transitions.
    3.  **Timeline Visualization:**
        *   Render the base video as a static track.
        *   Render the zoom and cut regions as interactive rounded rectangles on a separate track.
    4.  **Manual Region Editing:**
        *   Implement functionality to add new zoom/cut regions manually via toolbar buttons.
        *   Allow users to drag regions to change their start time.
        *   Allow users to resize regions to change their duration.
        *   Allow users to delete regions.
    5.  **Contextual Side Panel:** When a user selects a region on the timeline, the side panel switches to show settings specific to that region (e.g., zoom level, easing type).
    6.  **Timeline Zoom:** Implement the slider to zoom in/out of the timeline view itself.

*   **Outcome:** The editor automatically generates cinematic zoom effects, and the user has full control to fine-tune, add, or remove them.

## Phase 4: Export & Polish

**Goal:** Allow users to export their final creation and ensure the application is stable.

*   **Tasks:**
    1.  **Export UI:** Create the export modal with options for format (MP4, GIF), resolution, FPS, and quality.
    2.  **Rendering Engine:** Develop the core export logic using a "Canvas-to-FFmpeg-Stream" architecture:
        *   Create a hidden, offscreen `BrowserWindow` to act as a render worker.
        *   The worker loads the project state and a special renderer page (`RendererPage.tsx`).
        *   It iterates through every frame time of the source video, skipping frames within "cut" regions.
        *   For each frame to be rendered, it:
            a. Seeks the source `<video>` element to the correct time.
            b. Draws the background, padding, and the transformed video frame onto a `<canvas>` element at the target export resolution.
            c. Extracts the raw RGBA pixel data from the canvas.
        *   The pixel buffer for each frame is sent to the main process via IPC.
        *   The main process pipes this stream of raw video frames into the `stdin` of a spawned `ffmpeg` process, which encodes the final output video/GIF.
    3.  **Export Progress:** Provide feedback to the user via IPC from the render worker to the main UI, updating a progress bar.
    4.  **Testing & Optimization:** Thoroughly test all features, fix bugs, and optimize performance, especially for video playback and export.
    5.  **Build & Package:** Configure `electron-builder` to create distributable installers for Linux (`.deb`, `.AppImage`).

*   **Outcome:** A fully functional, polished V1 of ScreenAwesome, ready for its first release.
