# ScreenAwesome - Technology Stack

This document outlines the primary technologies chosen for the development of ScreenAwesome. The stack is selected to facilitate rapid development, ensure cross-platform compatibility, and leverage the modern JavaScript/TypeScript ecosystem.

## Core Framework

*   **[Electron](https://www.electronjs.org/):** The foundation of our desktop application. It allows us to build a cross-platform app (Linux, Windows, macOS) using web technologies.
*   **[Vite](https://vitejs.dev/):** A next-generation frontend tooling that provides an extremely fast development server and optimized build process. We will use it with a template for Electron and TypeScript.

## Language & UI

*   **[TypeScript](https://www.typescriptlang.org/):** Superset of JavaScript that adds static types. This is crucial for building a large, maintainable application by catching errors early and improving developer experience.
*   **[React](https://reactjs.org/) / [SolidJS](https://www.solidjs.com/):** (Decision to be finalized) A declarative UI library for building the user interface. React is the industry standard, while SolidJS offers superior performance.
*   **[TailwindCSS](https://tailwindcss.com/):** A utility-first CSS framework for rapidly building custom user interfaces without leaving the HTML/JSX. It's perfect for creating the clean, modern look of the editor.

## State Management

*   **[Zustand](https://github.com/pmndrs/zustand):** A small, fast, and scalable state-management solution. Its minimal boilerplate and simple hook-based API are ideal for managing the complex state of the editor (timeline position, selected clips, editor settings, etc.).

## Backend & System Interaction

*   **[Node.js](https://nodejs.org/):** The runtime for Electron's main process. Used for all system-level operations like file access, process management, and video processing orchestration.
*   **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg):** A Node.js wrapper for the powerful FFmpeg tool. It will handle all video processing tasks: screen recording, applying zoom/pan effects, compositing the final video with its background, and exporting to various formats.
*   **[Python](https://www.python.org/) with `pynput`:**
    *   **Reasoning:** Robust and well-maintained libraries for low-level mouse and keyboard event listening in Node.js are scarce. `pynput` is a proven, reliable solution for this task across platforms.
    *   **Implementation:** A small Python script will run as a child process during the recording phase. It will monitor mouse movements and clicks, writing the event data (position, timestamp, event type) to `stdout`. The Electron main process will listen to this stream and store the data alongside the video recording.

## Build & Packaging

*   **[Electron Builder](https://www.electron.build/):** A complete solution to package and build a ready-for-distribution Electron app with auto-update support.