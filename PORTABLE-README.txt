FROSTMARK 0.1.0 — PORTABLE WINDOWS MARKDOWN READER
================================================

GET STARTED
1. Extract the entire ZIP into a writable folder.
2. Run Frostmark.exe. No installer or administrator rights are required.
3. Click Open file, press Ctrl+O, or drag Markdown files into the window.

REQUIREMENTS
Windows 10/11 x64 with Microsoft Edge WebView2 Runtime installed.
This distribution does NOT bundle or install WebView2. An offline computer
without it must have the runtime supplied separately.

PORTABLE DATA
The app saves frostmark-settings.json and the Frostmark.WebView2 browser
cache folder beside Frostmark.exe. Keep this folder writable. Close the
app before moving the whole folder or removing a USB drive. Recent-file
paths may need reopening when a USB drive letter or document location changes.
No document content is stored in settings. Browser/runtime temporary data
may exist in the WebView2 folder; portable does not mean forensically traceless.
To reset, close the app and delete the settings and WebView2 folder.

KEYBOARD
Ctrl+O          Open documents
Ctrl+W          Close current tab
Ctrl+F          Find in document
Ctrl+R          Reload document from disk
Ctrl+P          Print / choose Microsoft Print to PDF
Ctrl+Plus       Increase text size
Ctrl+Minus      Decrease text size
Ctrl+0          Reset text size
Escape          Close search and preferences

FILES & FORMATTING
Reads .md, .markdown, .mdown, .mkd and .txt, up to 20 MB.
Supports UTF-8 and BOM-marked UTF-16; GitHub-style Markdown, tables,
task lists, fenced code highlighting, images, links and heading outlines.
Raw HTML is displayed as text, not executed. Mermaid and math are not
rendered in this version. Reload is manual (Ctrl+R), not live watching.
Local raster images must be within the document folder or its subfolders,
and below 30 MB. SVG and images outside that folder are blocked for safety.
Remote images are blocked by default; they can be enabled in preferences.
Web/email links open the system default application. Local document links
open in the reader. Other link schemes and non-document file links are blocked.

OPEN WITH
No registry changes or default-file takeover are performed. To associate
.md files yourself: Windows Settings > Apps > Default apps, or right-click
a .md file > Open with > Choose another app > Choose an app on your PC.
Select Frostmark.exe. Windows may not offer association for every portable app.
Do not move the executable afterward if you set it as the default handler.

UNSIGNED BUILD
This build is unsigned. Windows SmartScreen may warn about
an unrecognized app. Only run builds you trust. A SHA256SUMS.txt accompanies
the ZIP to verify download integrity; a checksum is not a publisher signature.

PRIVACY
No analytics, accounts, remote fonts, automatic updates or document uploads.
Remote links and opt-in remote images contact third-party services.
Windows and the installed WebView2 runtime have their own system behavior.

LICENSE & SOURCE
Frostmark is free and open-source software under the MIT License.
See LICENSE.txt for the license and warranty disclaimer.
Third-party software retains its own licenses; see THIRD-PARTY-NOTICES.txt.
Source: https://github.com/Shun-LUMA/frostmark
