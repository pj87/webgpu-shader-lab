# WebGPU Shader Lab

Milestone 3 of the full-stack WebGPU learning plan.

This version is dependency-free because Node.js/npm are not currently available on the machine. It provides:

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

## Run

Serve the folder locally:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Chrome or Edge are the safest choices. If the browser blocks WebGPU for local files, serve the folder with any local static server after Node.js or another runtime is installed.

## Next Step

Install Node.js, then move this into a Vite + React + TypeScript structure for Milestone 2.
