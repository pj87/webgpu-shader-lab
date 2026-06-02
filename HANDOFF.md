# Project Handoff

This repo contains a static prototype for the Full-Stack WebGPU Shader Lab learning project.

## Current State

The app is intentionally dependency-free because Node.js/npm were not installed on the machine when the project was started. It runs as plain HTML/CSS/JavaScript served by Python.

Current files:

- `index.html` - app shell and controls
- `styles.css` - full UI styling
- `src/main.js` - WebGPU renderer, editor behavior, storage, sharing, presets, autosave
- `README.md` - run instructions
- `full_stack_webgpu_learning_plan.md` - original project plan

## Completed

- Static app shell with sidebar, shader editor, preview canvas, inspector, and status rows.
- WebGPU fullscreen triangle renderer.
- Editable WGSL fragment shader source.
- Shader compile/run flow with validation error output.
- Shader templates: Rings, Plasma, Gradient.
- Auto-run debounce after editor changes.
- Tab insertion in the shader editor.
- Pause/resume, reset-time, and fullscreen preview controls.
- Uniforms exposed to WGSL:
  - `time`
  - `resolution`
  - `mouse`
  - `scale`
  - `intensity`
- Slider controls for `scale` and `intensity`.
- Local project CRUD using browser `localStorage`:
  - new
  - save
  - duplicate
  - delete
  - load from project list
- JSON project export/import.
- Read-only share URLs using a `?share=` query payload.
- Viewer mode for shared URLs with editing controls disabled.
- Edit-copy flow to save a shared shader as a local project.
- Per-project uniform presets:
  - save
  - load
  - delete
  - included in export/import/share payloads
- Debounced draft autosave for unsaved edits.
- Draft recovery panel with restore/discard controls.
- Pushed to GitHub:
  - `https://github.com/pj87/webgpu-shader-lab`

## Recent Commits

```text
251ac00 Add draft autosave recovery
4f9955f Add per-project uniform presets
3e2a72a Add read-only shader share links
37c2038 Add local shader project storage
f57c87b Expand shader editor controls
d528481 Create WebGPU shader lab milestone
```

## Run Locally

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Use Chrome or Edge with WebGPU enabled.

## Known Constraints

- Node.js/npm are not installed locally, so this has not yet been migrated to Vite, React, or TypeScript.
- No automated browser/WebGPU interaction tests have been run from this environment.
- The app stores projects and drafts in browser `localStorage`; this data is not committed to Git.
- Share URLs embed the project payload in the query string. This is fine for the static prototype but should become backend public slugs later.
- The current code is a single `src/main.js` file. It should be split into modules during the TypeScript migration.

## Recommended Next Step

Install Node.js, then migrate the static prototype into a Vite + React + TypeScript app while preserving current behavior.

Suggested structure:

```text
src/
  components/
    Sidebar.tsx
    ProjectPanel.tsx
    ShaderEditor.tsx
    PreviewCanvas.tsx
    InspectorPanel.tsx
    RecoveryPanel.tsx
    ErrorPanel.tsx

  webgpu/
    WebGPURenderer.ts
    shaders.ts

  lib/
    projectStorage.ts
    shareLinks.ts
    autosave.ts
    presets.ts
    types.ts
```

Suggested commands after Node.js is installed:

```powershell
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

After migration, the next major product milestone should be a Next.js/PostgreSQL backend with real project persistence, auth, and public slugs.

## Important Implementation Notes

- React should not own WebGPU internals. Keep `GPUDevice`, `GPUCanvasContext`, pipelines, buffers, and render-loop state inside a renderer class/module.
- React should own UI state only: selected project, editor text, uniforms, preset selection, statuses.
- Preserve current data concepts because they map to the future database model:
  - `Project`
  - `Shader`
  - `Preset`
  - public shared project/viewer
- Current storage keys:
  - `webgpu-shader-lab-projects`
  - `webgpu-shader-lab-draft`
