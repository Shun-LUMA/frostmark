# Frostmark

A free, MIT-licensed, portable, read-only Markdown viewer for Windows 10/11 x64, built with Tauri 2, React and the installed Microsoft Edge WebView2 runtime.

## Portable use

Download the `Frostmark-windows-x64-portable` artifact from a successful [Windows portable Actions run](https://github.com/Shun-LUMA/frostmark/actions/workflows/windows-portable.yml) (GitHub sign-in required), extract the **inner** ZIP to a writable folder and run `Frostmark.exe`. No installation, elevation, registry modification or default-app takeover. WebView2 must already be installed. Preferences and WebView2 profile/cache stay beside the executable. Move the whole folder while closed.

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

The elevated hosted runner uses a separate `desktop-test` feature build for CDP automation because WebView2 may ignore debugger environment overrides when elevated. This feature explicitly enables port 9222 **only in the test binary**. The untouched production binary is preserved before instrumentation and is the only executable packaged. Ordinary local builds do not enable this feature; never distribute a `desktop-test` build.

The Windows portable workflow builds on `windows-latest`, runs browser and Rust tests, verifies the x64 GUI executable's direct runtime imports, runs an actual WebView2 desktop smoke test, and uploads a portable ZIP plus SHA-256 checksum. The Visual C++ runtime is statically linked; WebView2 is supplied by the system. Dependency license notices are included in the ZIP. It runs on pushes to main and can be dispatched manually. It does **not** create a release or install anything on the user's machine. Artifacts expire after 30 days; keep a local copy.

```sh
gh workflow run windows-portable.yml
gh run list --workflow windows-portable.yml
gh run download RUN_ID -n Frostmark-windows-x64-portable
```

Lockfiles are committed. Current builds are unsigned and have not undergone an external security audit. Open-source availability does not itself provide code signing or guarantee Windows SmartScreen reputation.

## Contributing

Issues and pull requests are welcome. For frontend changes, run `npm run build` and `npx playwright test` (the browser tests use installed Microsoft Edge). For native changes, also run `cargo test --manifest-path src-tauri/Cargo.toml --locked --release --features custom-protocol` on Windows with the build prerequisites above. Do not commit personal documents, credentials, signing keys, or generated browser profiles. The npm package's `private: true` setting only prevents accidental npm publication; the source repository is public.

## License

Copyright (c) 2026 Shun-LUMA and Frostmark contributors. Frostmark's original source code is licensed under the [MIT License](LICENSE). Third-party dependencies retain their respective licenses; portable builds include `THIRD-PARTY-NOTICES.txt`. Microsoft Edge WebView2 is a separately installed system runtime and is not covered by Frostmark's MIT license.
