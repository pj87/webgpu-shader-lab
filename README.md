# WebGPU Shader Lab

Milestone 7 of the full-stack WebGPU learning plan.

This version is a Vite + React + TypeScript app. It provides:

- a technical tool layout
- a WebGPU canvas preview
- an editable WGSL fragment shader
- a compile/run button
- shader templates
- optional auto-run after edits
- validation error output
- time, resolution, and mouse uniforms
- scale and intensity uniforms
- pause, reset-time, and fullscreen preview controls
- local project CRUD using browser storage
- JSON export/import for shader projects
- read-only share URLs
- edit-copy flow for shared shaders
- per-project uniform presets
- debounced autosave with draft recovery

## Run

Install dependencies:

```powershell
npm install
```

Run the dev server:

```powershell
npm run dev
```

Chrome or Edge are the safest choices for WebGPU.

## Next Step

Split the React app into smaller components, then prepare the Next.js/PostgreSQL backend milestone.

## Handoff

See `HANDOFF.md` for the current implementation summary, known constraints, and recommended next steps.
