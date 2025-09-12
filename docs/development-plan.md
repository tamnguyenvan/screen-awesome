# ScreenAwesome - Development Plan

This plan breaks down the development of ScreenAwesome into manageable phases, prioritizing the delivery of core functionality first.

## Phase 1: Core Recording Engine & MVP

**Goal:** Establish a functional recording application that can capture the screen and mouse/click metadata.

*   **Tasks:**
    1.  **Project Setup:** Initialize Electron project with Vite, TypeScript, React, and TailwindCSS.
    2.  **Recording UI:** Create the initial control bar UI (select area/window/full, record button, audio/webcam toggles).
    3.  **Screen Capture:** Implement basic screen recording using `fluent-ffmpeg`. The output should be a raw video file (e.g., `.mp4`).
    4.  **Mouse/Click Tracking:**
        *   Integrate the `pynput` Python script.
        *   Create the logic in the Electron main process to spawn the script as a child process when recording starts.
        *   Capture the streamed data from the script and save it to a separate metadata file (e.g., `recording.json`) synchronized with the video.
    5.  **System Tray Controls:** Implement the system tray icon for starting/stopping the recording.

*   **Outcome:** A user can record their screen and the application will produce two files: a video file and a JSON file containing a timeline of mouse positions and click events.

## Phase 2: The Editing Studio Foundation

**Goal:** Build the editor's UI and enable basic video playback with frame customization.

*   **Tasks:**
    1.  **Editor Layout:** Construct the main editor window layout: Preview area, side panel, and timeline area.
    2.  **Project Loading:** Implement logic to open a project, which consists of loading the video and its associated metadata file.
    3.  **Video Playback:** Use `fluent-ffmpeg` to decode and display the video in the preview area. Implement a basic timeline with a playhead, play/pause controls, and scrubbing functionality.
    4.  **Frame Customization Panel:** Build the UI components in the side panel for controlling:
        *   Background (color, gradient, image upload).
        *   Padding.
        *   Border Radius, Shadow, Border Style.
    5.  **Live Preview:** Ensure that changes made in the side panel are immediately reflected in the preview area. The video should be rendered inside this "parent frame."

*   **Outcome:** A user can open a recording and customize its presentation frame in real-time.

## Phase 3: Implementing Auto-Zoom and Timeline Editing

**Goal:** Bring the "magic" to life by implementing the automatic zoom and manual timeline controls.

*   **Tasks:**
    1.  **Auto-Zoom Generation:** Upon loading a project, parse the click events from the metadata file. For each click, automatically generate a "zoom region" object in the state.
    2.  **Zoom Logic Implementation:** During video playback, check if the current timestamp falls within a zoom region. If so, calculate the necessary pan and zoom transformations and apply them to the parent frame in the preview. Implement smooth easing functions for these transitions.
    3.  **Timeline Visualization:**
        *   Render the original video as a base track.
        *   Render the zoom and cut regions as interactive rounded rectangles on a second track.
    4.  **Manual Region Editing:**
        *   Implement functionality to add new zoom/cut regions manually via toolbar buttons.
        *   Allow users to drag regions to change their start time.
        *   Allow users to resize regions to change their duration.
        *   Allow users to delete regions.
    5.  **Contextual Side Panel:** When a user selects a zoom region on the timeline, the side panel should switch to show settings specific to that zoom (e.g., zoom level, easing type).
    6.  **Timeline Zoom:** Implement the slider to zoom in/out of the timeline view itself.

*   **Outcome:** The editor will automatically generate cinematic zoom effects, and the user will have full control to fine-tune, add, or remove them.

## Phase 4: Export & Polish

**Goal:** Allow users to export their final creation and ensure the application is stable.

*   **Tasks:**
    1.  **Export UI:** Create the export modal with options for format (MP4, GIF), resolution, FPS, and quality.
    2.  **Rendering Engine:** Develop the core export logic. This will be an intensive background process that:
        *   Iterates through every frame of the source video.
        *   Applies all transformations for that specific frame (framing, padding, background, active pan/zoom).
        *   Skips frames that are within a "cut" region.
        *   Encodes the final processed frame into the output video file using `fluent-ffmpeg`.
    3.  **Export Progress:** Provide feedback to the user during the export process (e.g., a progress bar).
    4.  **Testing & Optimization:** Thoroughly test all features, fix bugs, and optimize performance, especially for video playback and export.
    5.  **Build & Package:** Configure `electron-builder` to create distributable installers for Linux (`.deb`, `.AppImage`).

*   **Outcome:** A fully functional, polished V1 of ScreenAwesome, ready for its first release.