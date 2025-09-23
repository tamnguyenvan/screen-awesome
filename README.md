# ScreenAwesome - Cinematic Screen Recording & Editing Studio

![ScreenAwesome Banner](https://raw.githubusercontent.com/tamnguyenvan/screen-awesome/main/docs/assets/banner-screencapture.png?raw=true)

<div align="center">
  <img src="https://img.shields.io/github/v/release/tamnguyenvan/screen-awesome?style=for-the-badge" alt="Latest Release" />
  <img src="https://img.shields.io/github/license/tamnguyenvan/screen-awesome?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/github/downloads/tamnguyenvan/screen-awesome/total?style=for-the-badge&color=green" alt="Total Downloads" />
</div>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-how-to-use">How To Use</a> •
  <a href="#-technologies-used">Tech Stack</a> •
  <a href="#-contributing">Contributing</a>
</p>

## ✨ Overview

ScreenAwesome is a powerful, cross-platform screen recording and editing application designed to help you create professional, engaging videos with minimal effort. It's the perfect tool for developers, educators, and content creators who need to produce high-quality tutorials, demos, and presentations.

The core philosophy of ScreenAwesome is to **automate the tedious parts of video editing**. It intelligently tracks your mouse movements and clicks, automatically creating smooth, cinematic pan-and-zoom effects that keep your audience focused on the action.

## 🚀 Key Features

*   **🎬 High-Quality Recording:**
    *   Capture your entire screen, a specific application window, or a custom-defined area.
    *   Support for multi-monitor setups.
    *   Simultaneously record your webcam as an overlay.

*   **🖱️ Cinematic Mouse Tracking:**
    *   The cornerstone feature: automatically detects mouse clicks and creates smooth pan-and-zoom animations to highlight areas of action. No manual keyframing needed!

*   **✂️ Powerful & Intuitive Editor:**
    *   **Frame Customization:** Easily change aspect ratios (16:9, 9:16, 1:1), set beautiful backgrounds (colors, gradients, or wallpapers), and adjust padding, borders, and shadows.
    *   **Preset System:** Save your favorite styles as presets and apply them instantly to new projects.
    *   **Timeline Editing:** A visual timeline to add, edit, or remove auto-generated effects. Easily "cut" mistakes or unwanted sections.

*   **📤 Flexible Export Options:**
    *   Export your final videos in standard formats like **MP4** and **GIF**.
    *   Control output settings like resolution (up to 2K) and frame rate.

## 📦 Installation

Download the latest version for your operating system from the [**Releases Page**](https://github.com/tamnguyenvan/screen-awesome/releases/latest).

### Linux

1.  Download the `.AppImage` file (e.g., `ScreenAwesome-x.x.x.AppImage`).
2.  Make the file executable:
    ```bash
    chmod +x ScreenAwesome-*.AppImage
    ```
3.  Run the application:
    ```bash
    ./ScreenAwesome-*.AppImage
    ```
    *Note: For window recording on Linux, you may need to install `wmctrl`, `x11-utils` (`xwininfo`), and `imagemagick`. The app will warn you if these are missing.*

### Windows

1.  Download the `...-Setup.exe` installer.
2.  Run the installer and follow the on-screen instructions.

### macOS

*   Coming soon! Builds for macOS are planned for a future release.

## 📖 How To Use

1.  **Record:**
    *   Launch ScreenAwesome.
    *   Choose your recording source: Full Screen, Area, or a specific Window.
    *   Select a display to record if you have multiple monitors.
    *   Optionally, enable your webcam.
    *   Click the record button. After a short countdown, the recording will begin.
    *   To stop, click the ScreenAwesome icon in your system tray and select "Stop Recording".

2.  **Edit:**
    *   The editor will automatically open with your new recording.
    *   Use the right-hand **Side Panel** to adjust the background, padding, shadows, and other frame styles.
    *   Use the **Timeline** at the bottom to review the recording. Click and drag the automatically generated "Zoom" and "Cut" regions to adjust their timing and duration.
    *   Click the **"Presets"** button to save your current style for future use.

3.  **Export:**
    *   Click the **"Export"** button in the top-right corner.
    *   Choose your desired format (MP4/GIF), resolution, and output location.
    *   Click "Start Export" and let ScreenAwesome do the rest!

## 🛠️ Technologies Used

*   **Core:** [Electron](https://www.electronjs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **UI:** [React](https://reactjs.org/), [TailwindCSS](https://tailwindcss.com/)
*   **State Management:** [Zustand](https://github.com/pmndrs/zustand)
*   **Video/System:** [Node.js](https://nodejs.org/), [FFmpeg](https://ffmpeg.org/)
*   **Packaging:** [Electron Builder](https://www.electron.build/)

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, bug fixes, or improvements, please feel free to open an issue or submit a pull request.

### Development Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/tamnguyenvan/screen-awesome.git
    cd screen-awesome
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Download and set up FFmpeg:
    ```bash
    # Create binaries directory if it doesn't exist
    mkdir -p binaries/linux
    
    # Download FFmpeg static binary (replace with the latest version URL)
    wget https://github.com/tamnguyenvan/screen-awesome-assets/releases/download/release/ffmpeg -O binaries/linux/ffmpeg
    
    # Make FFmpeg executable
    chmod +x binaries/linux/ffmpeg
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```

## 📜 License

This project is licensed under the [MIT License](LICENSE).
