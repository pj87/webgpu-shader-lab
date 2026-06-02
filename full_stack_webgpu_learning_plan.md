# Full-Stack Web Development Learning Plan with WebGPU

## Audience and Context

This plan is intended for a C/C++ programmer with experience in Vulkan and some DirectX who needs to learn web development quickly while still using WebGPU as a meaningful part of the learning path.

The goal is not to learn generic web development in isolation. The goal is to become productive in full-stack web development by building a real application whose core feature is WebGPU.

The recommended flagship project is:

```text
Full-Stack WebGPU Shader Lab
```

The strategic framing is:

```text
WebGPU is the product.
Full-stack is the infrastructure around the product.
```

---

## Core Strategy

Do not learn full-stack and WebGPU as two unrelated tracks.

Avoid this:

```text
full-stack separately
WebGPU separately
```

Use this instead:

```text
full-stack through a WebGPU application
```

Build a product where a user can:

```text
log in
→ create a shader/demo project
→ edit WGSL code
→ run a WebGPU preview in a canvas
→ save shader source and presets to a database
→ publish a public share link
→ allow others to view the demo
```

This teaches practical web development while taking advantage of your graphics background.

---

## Recommended Stack

Use one pragmatic stack and avoid switching tools mid-project.

```text
TypeScript
React
Next.js
PostgreSQL
Prisma or Drizzle
Tailwind CSS
CodeMirror
Cookie-based sessions
Vercel / Render / Railway / Neon / Supabase
```

Recommended for speed:

```text
Next.js
PostgreSQL
Prisma
Tailwind CSS
CodeMirror
Cookie-based auth
```

Recommended for a more explicit, system-level style:

```text
Next.js
PostgreSQL
Drizzle
Tailwind CSS
CodeMirror
Custom cookie sessions
```

---

## Why This Project Works

| Full-Stack Skill | How It Appears in the Project |
|---|---|
| HTML/CSS | Editor layout, panels, forms, responsive UI |
| TypeScript | Shared frontend, backend, and WebGPU code |
| React | Editor UI, dashboard, preview panels |
| Next.js | Routing, server/client split, API routes |
| Backend | CRUD for projects, shaders, and presets |
| PostgreSQL | Users, projects, shader source, presets |
| Authentication | Private dashboards and project ownership |
| Authorization | Public/private projects and edit permissions |
| Validation | Project names, shader data, preset data |
| Deployment | Public demo hosted online |
| Testing | Auth, CRUD, public viewer, API behavior |
| WebGPU | Live rendering or compute preview |
| Portfolio | A distinctive technical product |

This is more useful than another generic task manager because it demonstrates both web competence and GPU specialization.

---

## Product MVP

The MVP must include:

```text
- registration and login
- private dashboard
- create project
- edit WGSL fragment shader
- WebGPU preview
- save shader source to PostgreSQL
- load saved shader source
- publish public share link
- read-only public viewer
- deployment
```

The MVP does not need:

```text
- compute shader support
- mesh renderer
- asset uploads
- collaboration
- OAuth
- comments
- likes
- payments
- advanced design system
```

---

## Architecture Principle

React should not own the GPU renderer.

React owns the UI. The WebGPU renderer should be a separate TypeScript module or class.

```text
React UI
→ owns panels, forms, buttons, editor state
→ passes canvas reference and shader source

WebGPU Renderer
→ owns GPUDevice, GPUCanvasContext, buffers, pipelines
→ compiles WGSL
→ renders frames
→ reports errors back to the UI

Backend
→ owns persistence, auth, permissions, public sharing

Database
→ stores users, projects, shaders, presets
```

Recommended renderer shape:

```ts
class WebGPURenderer {
  async init(canvas: HTMLCanvasElement) {}
  resize(width: number, height: number) {}
  setShaderSource(source: string) {}
  setUniforms(uniforms: Record<string, number>) {}
  render(time: number) {}
  destroy() {}
}
```

Important rule:

```text
Do not put GPUDevice, GPURenderPipeline, GPUBuffer, or render-loop internals in React state.
```

Use React state for UI state only.

---

## Minimal Application Routes

A practical route structure:

```text
/
/login
/register
/dashboard
/projects
/projects/new
/projects/[id]
/p/[publicSlug]
```

Route responsibilities:

```text
/                  landing page
/login             login form
/register          registration form
/dashboard         private user dashboard
/projects          private project list
/projects/new      create new project
/projects/[id]     project editor
/p/[publicSlug]    public read-only project viewer
```

The WebGPU editor/viewer should be client-side because it depends on browser-only APIs:

```ts
"use client";
```

Use this for components that access:

```text
navigator.gpu
HTMLCanvasElement
requestAnimationFrame
browser events
CodeMirror
```

---

## Minimal Data Model

Start with four main entities:

```text
User
Project
Shader
Preset
```

Example schema concept:

```text
User
- id
- email
- passwordHash
- createdAt

Project
- id
- ownerId
- title
- description
- visibility
- publicSlug
- createdAt
- updatedAt

Shader
- id
- projectId
- vertexCode
- fragmentCode
- computeCode
- mode
- createdAt
- updatedAt

Preset
- id
- projectId
- name
- uniformsJson
- createdAt
```

Visibility values:

```text
private
public
unlisted
```

Shader modes:

```text
fragment
mesh
compute
```

For the MVP, only `fragment` mode is required.

---

## Minimal API Surface

Start with REST-style endpoints or equivalent server actions.

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/shader
PATCH  /api/projects/:id/shader

GET    /api/projects/:id/presets
POST   /api/projects/:id/presets
PATCH  /api/presets/:id
DELETE /api/presets/:id

POST   /api/projects/:id/publish
POST   /api/projects/:id/unpublish
GET    /api/public/:slug
```

Required permission rules:

```text
- project owner can edit the project
- project owner can delete the project
- project owner can publish or unpublish the project
- anonymous users can view only public projects
- private projects are not available through public URLs
- users cannot access another user's private projects
```

---

## WebGPU Feature Roadmap

Do not start with a full renderer or engine.

### Mode 1: Fragment Shader Playground

This should be the MVP mode.

```text
fullscreen triangle
fragment WGSL
uniforms:
- time
- resolution
- mouse
```

This is the fastest way to get a useful WebGPU product.

### Mode 2: Vertex + Fragment Mesh Demo

Add later:

```text
vertex buffer
index buffer
MVP matrix
camera
depth buffer
basic mesh presets
```

Useful scene presets:

```text
cube
sphere
plane
fullscreen quad
```

### Mode 3: Compute Demo

Add after the full-stack foundation is working:

```text
compute shader
storage buffers
particle simulation
render particles
```

This is where your Vulkan/GPU background becomes a major differentiator.

---

## 8-Week Integrated Plan

### Week 1: HTML, CSS, TypeScript, and Canvas Shell

Build:

```text
WebGPU Lab layout
- sidebar
- editor panel
- preview canvas
- inspector
- responsive layout
```

Learn:

```text
HTML
CSS or Tailwind
TypeScript
DOM basics
canvas
resize handling
events
requestAnimationFrame
```

Outcome:

```text
The application already looks like a technical tool.
```

---

### Week 2: React and WebGPU Triangle

Build:

```text
React app
PreviewCanvas component
WebGPURenderer class
WebGPU initialization
fullscreen triangle
time and resolution uniforms
```

Learn:

```text
React components
props
state
hooks
refs
effects
WebGPU basics
WGSL basics
```

Outcome:

```text
A React-controlled WebGPU preview.
```

---

### Week 3: Shader Editor

Build:

```text
WGSL editor
Compile/Run button
error output
default shader templates
fragment shader mode
```

Learn:

```text
state management
forms
controlled and uncontrolled components
error handling
shader compilation lifecycle
```

Outcome:

```text
A functional local shader playground.
```

---

### Week 4: Next.js and Routing

Build:

```text
Next.js migration or setup
/dashboard
/projects/[id]
/p/[slug]
client-only WebGPU editor
```

Learn:

```text
routing
layouts
server components
client components
URL parameters
application structure
```

Outcome:

```text
A WebGPU editor inside a real full-stack app shell.
```

---

### Week 5: PostgreSQL and Project CRUD

Build:

```text
database
projects table
shaders table
create/edit/delete project
save shader source
load shader source
```

Learn:

```text
SQL
ORM
migrations
REST endpoints or server actions
runtime validation
API contracts
```

Outcome:

```text
Shader projects persist in a real database.
```

---

### Week 6: Authentication and Permissions

Build:

```text
register
login
logout
protected routes
private projects
ownership checks
```

Learn:

```text
sessions
cookies
password hashing
authorization
protected server routes
```

Outcome:

```text
The app supports real user accounts and private projects.
```

---

### Week 7: Public Sharing and Presets

Build:

```text
publish project
public slug
read-only viewer
uniform presets
save/load presets
```

Learn:

```text
public/private access
URL design
JSON data fields
frontend/backend integration
permission boundaries
```

Outcome:

```text
Users can share public WebGPU demos.
```

---

### Week 8: Testing, Deployment, and Polish

Build:

```text
deployed app
README
screenshots
auth tests
project CRUD tests
public viewer tests
error boundaries
basic monitoring/logging
```

Learn:

```text
deployment
environment variables
production database
Playwright basics
integration testing
production debugging
```

Outcome:

```text
A public portfolio-grade full-stack WebGPU application.
```

---

## Milestone Plan

### Milestone 1: Static WebGPU Playground

Build:

```text
Vite or Next.js
React
TypeScript
canvas layout
WebGPU initialization
fullscreen triangle
hardcoded WGSL
```

No backend yet.

Deliverable:

```text
A local WebGPU app that renders a fullscreen shader.
```

---

### Milestone 2: Editable Shader

Build:

```text
textarea or CodeMirror editor
WGSL source in UI
Run/Compile button
shader compilation errors
default shader templates
fragment shader mode
```

Deliverable:

```text
A browser shader playground that can edit and recompile WGSL.
```

---

### Milestone 3: Next.js App Shell

Build:

```text
Next.js routes
landing page
dashboard placeholder
project editor route
public viewer route
client-only WebGPU editor
```

Deliverable:

```text
A real application shell around the WebGPU editor.
```

---

### Milestone 4: Database and Project CRUD

Build:

```text
PostgreSQL database
Project table
Shader table
create project
edit project
delete project
save shader source
load shader source
```

Deliverable:

```text
Users can create and save shader projects.
```

---

### Milestone 5: Authentication

Build:

```text
register
login
logout
protected dashboard
project ownership checks
private projects
```

Deliverable:

```text
Only authenticated users can manage their own projects.
```

---

### Milestone 6: Public Sharing

Build:

```text
publish project
generate public slug
public read-only viewer
shareable URL
unpublish project
```

Deliverable:

```text
A user can publish a WebGPU shader demo and share it with others.
```

---

### Milestone 7: Presets and UX

Build:

```text
uniform controls
save/load presets
auto-save
error panel
fullscreen preview
duplicate project
default templates
README
screenshots
```

Deliverable:

```text
A polished portfolio-grade application.
```

---

## Suggested File Structure

```text
src/
  app/
    page.tsx
    login/
      page.tsx
    register/
      page.tsx
    dashboard/
      page.tsx
    projects/
      new/
        page.tsx
      [id]/
        page.tsx
    p/
      [slug]/
        page.tsx
    api/
      projects/
        route.ts
      projects/
        [id]/
          route.ts

  components/
    AppShell.tsx
    Sidebar.tsx
    ShaderEditor.tsx
    PreviewCanvas.tsx
    ErrorPanel.tsx
    Toolbar.tsx
    InspectorPanel.tsx
    UniformControls.tsx

  webgpu/
    WebGPURenderer.ts
    createFullscreenPipeline.ts
    defaultShaders.ts
    uniforms.ts
    resizeCanvas.ts

  server/
    db.ts
    auth.ts
    projects.ts
    permissions.ts
    sessions.ts

  lib/
    validation.ts
    apiClient.ts
    types.ts
    constants.ts
```

---

## What to Avoid Early

Avoid starting with:

```text
- a full renderer or engine
- compute shaders before the MVP works
- mesh loading
- asset uploads
- OAuth
- GraphQL
- microservices
- Kubernetes
- WebAssembly
- collaboration features
- public gallery
- advanced design system
```

These features can come later. The first goal is a deployed, working full-stack WebGPU application.

---

## Daily Routine

If you have 3-4 hours per day:

```text
30 min — docs / focused theory
2 h    — implementation
30 min — debugging / refactor
30 min — commit + notes + README update
```

If you have a full day:

```text
1 h    — focused theory
4 h    — implementation
1 h    — tests/debugging
1 h    — refactor
30 min — commit + notes
```

Every day should produce a commit.

---

## Final Integrated Path

The fastest path that still includes WebGPU is:

```text
TypeScript
→ React
→ WebGPU canvas preview
→ WGSL shader editor
→ Next.js
→ PostgreSQL
→ authentication
→ project persistence
→ public sharing
→ deployment
```

This lets you learn full-stack development quickly while building something that matches your existing GPU background and creates a stronger portfolio than a generic CRUD app.
