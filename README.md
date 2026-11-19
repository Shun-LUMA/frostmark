# Frostmark

A portable, read-only Markdown viewer for Windows 10/11 x64, built with Tauri 2, React and the installed Microsoft Edge WebView2 runtime.

## Portable use

Download the Windows artifact, extract the **inner** ZIP to a writable folder and run `Frostmark.exe`. No installation, elevation, registry modification or default-app takeover. WebView2 must already be installed. Preferences and WebView2 profile/cache stay beside the executable. Move the whole folder while closed.

See [portable instructions](PORTABLE-README.txt) for shortcuts, requirements, safety restrictions, file handling and unsigned-build warnings.

## Features

- Read-only Markdown with GitHub-style tables, task lists, code highlighting and copy buttons
- Native multi-file chooser, drag-and-drop, tabs, recent files, heading outline
- Local raster images, safe local document links, system-browser web links
- Light/dark/system theme, text size, reading width, find and print
- UTF-8 and BOM-marked UTF-16, document cap 20 MB
- No analytics, cloud sync, updater or remote fonts; remote images blocked by default

Raw HTML is not executed. SVG, arbitrary file links, images outside the document directory, math and Mermaid are intentionally unsupported in v0.1. Reload is manual. `.txt` is displayed using the Markdown renderer.

## Development

Node.js 22+, npm, Rust stable and Visual Studio C++ build tools/Windows SDK are needed for native local builds. The frontend preview only needs Node:

```sh
npm ci
npm run dev
npm run build
```

Browser preview uses a file picker and localStorage instead of native APIs. It is not the distributable app.

```sh
npm run tauri dev
npm run tauri:build -- --no-bundle
```

## GitHub Actions

The Windows portable workflow builds on `windows-latest`, runs Rust tests and an actual WebView2 desktop smoke test, and uploads a portable ZIP plus SHA-256 checksum. It runs on pushes to main and can be dispatched manually. It does **not** create a release or install anything on the user's machine. Artifacts expire after 30 days; keep a local copy.

```sh
gh workflow run windows-portable.yml
gh run list --workflow windows-portable.yml
gh run download RUN_ID -n Frostmark-windows-x64-portable
```

Lockfiles are committed. This is an unsigned personal-use build, not a signed or externally audited commercial release.
