# Project Handoff

This repo contains a static prototype for the Full-Stack WebGPU Shader Lab learning project.

## Current State

The app began as a dependency-free static prototype and has now been migrated to Vite + React + TypeScript.

Current files:

- `index.html` - Vite root
- `styles.css` - full UI styling
- `src/App.tsx` - React application state and UI
- `src/main.tsx` - React entry point
- `src/webgpu/WebGPURenderer.ts` - WebGPU renderer
- `src/webgpu/shaders.ts` - WGSL shader templates and shared WGSL
- `src/lib/` - project storage, share links, and types
- `package.json` / `vite.config.ts` / `tsconfig.json` - Vite React TypeScript setup
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
npm install
npm run dev
```

Then open:

Use Chrome or Edge with WebGPU enabled.

## Known Constraints

- No automated browser/WebGPU interaction tests have been run from this environment.
- The app stores projects and drafts in browser `localStorage`; this data is not committed to Git.
- Share URLs embed the project payload in the query string. This is fine for the static prototype but should become backend public slugs later.
- `src/App.tsx` is still large and should be split into focused components next.
- Production build currently passes with `npm run build`.

## Recommended Next Step

Split `src/App.tsx` into focused React components while preserving current behavior.

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
