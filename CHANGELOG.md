# Changelog

## 1.7.0

Stability and maintenance release. No changes to the comment syntax or configuration — existing image comments keep working.

### Fixed

- Crash when hovering with `imageComments.pathMode: relativeToWorkspace` and no workspace folder open. The extension now falls back to file-relative resolution.
- Multi-line comment detection for languages with symmetric delimiters (e.g. CoffeeScript `###`).
- Pasting an image could fail when the system temp directory and the workspace are on different volumes (cross-device rename). The extension now falls back to copy + delete.
- Pasting an image could replace the wrong text if the document was edited while the clipboard was being read. The placeholder is now located by content before being replaced.
- Clipboard detection now runs `osascript`/`powershell.exe` without a shell (no string interpolation into a shell command).
- Hover tooltips no longer trust arbitrary commands; only the extension's own commands are enabled in hover markdown.
- The output channel is now disposed when the extension is deactivated.

### Changed

- Command id renamed from `imageComment.pasteImage` to `imageComments.pasteImage` for consistency with the settings namespace. The old id remains registered, so existing keybindings keep working.
- Internal hover commands renamed from `extension.openImage`/`extension.resizeImage` to `imageComments.openImage`/`imageComments.resizeImage` to avoid collisions with other extensions.
- Codebase split into modules under `src/` with unit tests (`npm test`).
- Minimum VS Code version raised to 1.78.

## 1.6.0

- Paste Image from Clipboard (macOS & Windows)
