(async () => {
  const storageKey = "webgpu-shader-lab-projects";
  const shareParam = "share";

  const shaderTemplates = {
    rings: `@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let aspect = uniforms.resolution.x / uniforms.resolution.y;
  let p = (uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);
  let mouse = uniforms.mouse / max(uniforms.resolution, vec2<f32>(1.0));
  let cursor = vec2<f32>(mouse.x * 2.0 - 1.0, 1.0 - mouse.y * 2.0);
  let distance = length((p - cursor) * uniforms.scale);
  let rings = 0.5 + 0.5 * cos(distance * 24.0 - uniforms.time * 4.0);
  let glow = 0.018 / max(abs(distance - 0.32), 0.012);
  let intensity = uniforms.intensity;

  return vec4<f32>(
    (0.12 + rings * 0.34 + glow * 0.60) * intensity,
    (0.18 + rings * 0.18 + glow * 0.90) * intensity,
    (0.24 + rings * 0.46) * intensity,
    1.0
  );
}`,
    plasma: `@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv * uniforms.scale;
  let t = uniforms.time;
  let wave =
    sin((uv.x + t * 0.20) * 10.0) +
    sin((uv.y - t * 0.15) * 14.0) +
    sin((uv.x + uv.y + t * 0.12) * 8.0);
  let c = 0.5 + 0.5 * sin(vec3<f32>(0.0, 2.1, 4.2) + wave);

  return vec4<f32>(c * uniforms.intensity, 1.0);
}`,
    gradient: `@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let mouse = uniforms.mouse / max(uniforms.resolution, vec2<f32>(1.0));
  let sweep = smoothstep(0.0, 1.0, uv.x + 0.18 * sin(uniforms.time));
  let shade = vec3<f32>(uv.x, uv.y, 1.0 - uv.x) * uniforms.intensity;
  let cursor = 1.0 - smoothstep(0.0, 0.18, distance(uv, mouse));
  let blend = vec3<f32>(min(sweep * 0.35 + cursor, 1.0));

  return vec4<f32>(mix(shade, vec3<f32>(1.0, 0.42, 0.24), blend), 1.0);
}`,
  };

  const commonShader = `
struct Uniforms {
  time: f32,
  scale: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
  intensity: f32,
  _pad0: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2<f32>(0.5);
  return output;
}
`;

  class WebGPURenderer {
    constructor(canvas, onStatus) {
      this.canvas = canvas;
      this.onStatus = onStatus;
      this.device = null;
      this.context = null;
      this.pipeline = null;
      this.bindGroup = null;
      this.uniformBuffer = null;
      this.format = null;
      this.animationId = 0;
      this.startTime = performance.now();
      this.isRunning = false;
      this.mouse = { x: 0, y: 0 };
      this.uniforms = { scale: 1, intensity: 1 };
    }

    async init() {
      if (!navigator.gpu) {
        throw new Error("WebGPU is not available in this browser.");
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No WebGPU adapter was found.");
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext("webgpu");
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.uniformBuffer = this.device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this.configureCanvas();
      window.addEventListener("resize", () => this.configureCanvas());
      this.canvas.addEventListener("pointermove", (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
      });

      this.onStatus("adapter", "Ready");
    }

    configureCanvas() {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "opaque",
      });
    }

    setUniform(name, value) {
      this.uniforms[name] = value;
    }

    resetTime() {
      this.startTime = performance.now();
    }

    async setFragmentShader(fragmentShader) {
      const source = `${commonShader}\n${fragmentShader}`;

      this.device.pushErrorScope("validation");
      let pipeline;

      try {
        const module = this.device.createShaderModule({ code: source });
        pipeline = await this.device.createRenderPipelineAsync({
          layout: "auto",
          vertex: {
            module,
            entryPoint: "vsMain",
          },
          fragment: {
            module,
            entryPoint: "fsMain",
            targets: [{ format: this.format }],
          },
          primitive: {
            topology: "triangle-list",
          },
        });
      } catch (pipelineError) {
        const scopedError = await this.device.popErrorScope();
        throw new Error(scopedError?.message || pipelineError.message || String(pipelineError));
      }

      const error = await this.device.popErrorScope();
      if (error) {
        throw new Error(error.message);
      }

      this.pipeline = pipeline;
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });
    }

    start() {
      if (this.isRunning) {
        return;
      }

      this.isRunning = true;
      this.onStatus("frame", "Running");

      const frame = () => {
        if (!this.isRunning) {
          return;
        }

        this.render();
        this.animationId = requestAnimationFrame(frame);
      };

      this.animationId = requestAnimationFrame(frame);
    }

    pause() {
      this.isRunning = false;
      cancelAnimationFrame(this.animationId);
      this.onStatus("frame", "Paused");
    }

    render() {
      if (!this.pipeline || !this.bindGroup) {
        return;
      }

      this.configureCanvas();

      const ratio = window.devicePixelRatio || 1;
      const time = (performance.now() - this.startTime) / 1000;
      const uniforms = new Float32Array([
        time,
        this.uniforms.scale,
        this.canvas.width,
        this.canvas.height,
        this.mouse.x * ratio,
        this.mouse.y * ratio,
        this.uniforms.intensity,
        0,
      ]);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(3);
      pass.end();

      this.device.queue.submit([encoder.finish()]);
    }
  }

  const editor = document.querySelector("#shaderEditor");
  const viewerNotice = document.querySelector("#viewerNotice");
  const projectTitleInput = document.querySelector("#projectTitleInput");
  const projectSelect = document.querySelector("#projectSelect");
  const newProjectButton = document.querySelector("#newProjectButton");
  const saveProjectButton = document.querySelector("#saveProjectButton");
  const duplicateProjectButton = document.querySelector("#duplicateProjectButton");
  const deleteProjectButton = document.querySelector("#deleteProjectButton");
  const exportProjectButton = document.querySelector("#exportProjectButton");
  const importProjectButton = document.querySelector("#importProjectButton");
  const importProjectInput = document.querySelector("#importProjectInput");
  const shareProjectButton = document.querySelector("#shareProjectButton");
  const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
  const editCopyButton = document.querySelector("#editCopyButton");
  const runButton = document.querySelector("#runButton");
  const pauseButton = document.querySelector("#pauseButton");
  const resetTimeButton = document.querySelector("#resetTimeButton");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const templateSelect = document.querySelector("#templateSelect");
  const autoRunToggle = document.querySelector("#autoRunToggle");
  const errorPanel = document.querySelector("#errorPanel");
  const projectStatus = document.querySelector("#projectStatus");
  const adapterStatus = document.querySelector("#adapterStatus");
  const pipelineStatus = document.querySelector("#pipelineStatus");
  const frameStatus = document.querySelector("#frameStatus");
  const scaleInput = document.querySelector("#scaleInput");
  const scaleValue = document.querySelector("#scaleValue");
  const intensityInput = document.querySelector("#intensityInput");
  const intensityValue = document.querySelector("#intensityValue");
  const presetSelect = document.querySelector("#presetSelect");
  const presetNameInput = document.querySelector("#presetNameInput");
  const savePresetButton = document.querySelector("#savePresetButton");
  const loadPresetButton = document.querySelector("#loadPresetButton");
  const deletePresetButton = document.querySelector("#deletePresetButton");
  const canvas = document.querySelector("#previewCanvas");
  const previewPane = document.querySelector(".preview-pane");

  let compileTimer = 0;
  let projects = [];
  let activeProjectId = "";
  let activeProjectSnapshot = null;
  let isDirty = false;
  let isViewerMode = false;
  let lastShareUrl = "";

  const createId = () => {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `project-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  };

  const getNow = () => new Date().toISOString();

  const encodeSharePayload = (project) => {
    const json = JSON.stringify({
      title: project.title,
      shaderSource: project.shaderSource,
      template: project.template,
      uniforms: project.uniforms,
      presets: project.presets || [],
    });
    const bytes = new TextEncoder().encode(json);
    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const decodeSharePayload = (value) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    if (!parsed || typeof parsed.shaderSource !== "string") {
      throw new Error("Shared shader payload is invalid.");
    }

    return {
      ...createProject(parsed.title || "Shared Shader"),
      ...parsed,
      id: createId(),
      title: parsed.title || "Shared Shader",
      uniforms: {
        scale: Number(parsed.uniforms?.scale ?? 1),
        intensity: Number(parsed.uniforms?.intensity ?? 1),
      },
      presets: normalizePresets(parsed.presets),
      createdAt: getNow(),
      updatedAt: getNow(),
    };
  };

  const readSharedProjectFromUrl = () => {
    const value = new URLSearchParams(window.location.search).get(shareParam);

    if (!value) {
      return null;
    }

    return decodeSharePayload(value);
  };

  const createProject = (title = "Untitled Shader", template = "rings") => ({
    id: createId(),
    title,
    shaderSource: shaderTemplates[template],
    template,
    uniforms: {
      scale: 1,
      intensity: 1,
    },
    presets: [
      {
        id: createId(),
        name: "Default",
        uniforms: {
          scale: 1,
          intensity: 1,
        },
        createdAt: getNow(),
      },
    ],
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  const normalizePresets = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((preset) => preset && typeof preset.name === "string")
      .map((preset) => ({
        id: preset.id || createId(),
        name: preset.name || "Preset",
        uniforms: {
          scale: Number(preset.uniforms?.scale ?? 1),
          intensity: Number(preset.uniforms?.intensity ?? 1),
        },
        createdAt: preset.createdAt || getNow(),
      }));
  };

  const loadProjects = () => {
    try {
      const storedProjects = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(storedProjects) ? storedProjects : [];
    } catch {
      return [];
    }
  };

  const persistProjects = () => {
    localStorage.setItem(storageKey, JSON.stringify(projects));
  };

  const setDirty = (value) => {
    isDirty = value;
    projectStatus.textContent = isViewerMode ? "Shared" : value ? "Unsaved" : "Saved";
  };

  const setViewerMode = (value) => {
    isViewerMode = value;
    document.body.classList.toggle("viewer-mode", value);
    viewerNotice.hidden = !value;
    editCopyButton.hidden = !value;

    const disabledControls = [
      projectTitleInput,
      projectSelect,
      newProjectButton,
      saveProjectButton,
      duplicateProjectButton,
      deleteProjectButton,
      exportProjectButton,
      importProjectButton,
      shareProjectButton,
      copyShareLinkButton,
      templateSelect,
      autoRunToggle,
      runButton,
      editor,
      presetNameInput,
      savePresetButton,
      deletePresetButton,
    ];

    for (const control of disabledControls) {
      control.disabled = value;
    }

    setDirty(false);
  };

  const renderProjectList = () => {
    projectSelect.innerHTML = "";

    for (const project of projects) {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.title || "Untitled Shader";
      option.selected = project.id === activeProjectId;
      projectSelect.append(option);
    }
  };

  const renderPresetList = (presets = []) => {
    presetSelect.innerHTML = "";

    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      presetSelect.append(option);
    }

    if (presets.length > 0) {
      presetSelect.value = presets[0].id;
      presetNameInput.value = presets[0].name;
    } else {
      presetNameInput.value = "Preset 1";
    }
  };

  const getActiveStoredProject = () => projects.find((project) => project.id === activeProjectId);

  const getActiveProject = () => getActiveStoredProject() || activeProjectSnapshot;

  const readCurrentUniforms = () => ({
    scale: Number(scaleInput.value),
    intensity: Number(intensityInput.value),
  });

  const readCurrentProject = () => ({
    id: activeProjectId || createId(),
    title: projectTitleInput.value.trim() || "Untitled Shader",
    shaderSource: editor.value,
    template: templateSelect.value,
    uniforms: {
      scale: Number(scaleInput.value),
      intensity: Number(intensityInput.value),
    },
    presets: normalizePresets(getActiveProject()?.presets),
    createdAt: getActiveProject()?.createdAt || getNow(),
    updatedAt: getNow(),
  });

  const applyProject = (project, shouldCompile = true) => {
    project.presets = normalizePresets(project.presets);
    activeProjectId = project.id;
    activeProjectSnapshot = project;
    projectTitleInput.value = project.title || "Untitled Shader";
    templateSelect.value = shaderTemplates[project.template] ? project.template : "rings";
    editor.value = project.shaderSource || shaderTemplates[templateSelect.value];
    scaleInput.value = String(project.uniforms?.scale ?? 1);
    intensityInput.value = String(project.uniforms?.intensity ?? 1);
    updateUniformControl("scale", scaleInput, scaleValue);
    updateUniformControl("intensity", intensityInput, intensityValue);
    renderProjectList();
    renderPresetList(project.presets);
    setDirty(false);

    if (shouldCompile) {
      compileShader();
    }
  };

  const saveActiveProject = () => {
    if (isViewerMode) {
      return;
    }

    const project = readCurrentProject();
    const index = projects.findIndex((item) => item.id === project.id);

    if (index === -1) {
      projects.unshift(project);
    } else {
      projects[index] = project;
    }

    activeProjectId = project.id;
    activeProjectSnapshot = project;
    persistProjects();
    renderProjectList();
    renderPresetList(project.presets);
    setDirty(false);
  };

  const startNewProject = () => {
    if (isViewerMode) {
      return;
    }

    const project = createProject();
    activeProjectId = project.id;
    activeProjectSnapshot = project;
    projectTitleInput.value = project.title;
    templateSelect.value = project.template;
    editor.value = project.shaderSource;
    scaleInput.value = String(project.uniforms.scale);
    intensityInput.value = String(project.uniforms.intensity);
    updateUniformControl("scale", scaleInput, scaleValue);
    updateUniformControl("intensity", intensityInput, intensityValue);
    renderProjectList();
    renderPresetList(project.presets);
    setDirty(true);
    compileShader();
  };

  const duplicateActiveProject = () => {
    if (isViewerMode) {
      return;
    }

    const source = readCurrentProject();
    const duplicate = {
      ...source,
      id: createId(),
      title: `${source.title} Copy`,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    projects.unshift(duplicate);
    activeProjectId = duplicate.id;
    persistProjects();
    applyProject(duplicate);
  };

  const deleteActiveProject = () => {
    if (isViewerMode || !activeProjectId) {
      return;
    }

    const project = projects.find((item) => item.id === activeProjectId);
    if (project && !confirm(`Delete "${project.title}"?`)) {
      return;
    }

    projects = projects.filter((item) => item.id !== activeProjectId);
    persistProjects();

    if (projects.length > 0) {
      applyProject(projects[0]);
      return;
    }

    startNewProject();
  };

  const exportActiveProject = () => {
    const project = readCurrentProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shader"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const persistActiveProjectPresets = (presets) => {
    const project = getActiveStoredProject();
    const normalizedPresets = normalizePresets(presets);

    if (project) {
      project.presets = normalizedPresets;
      project.updatedAt = getNow();
      activeProjectSnapshot = project;
      persistProjects();
      renderPresetList(project.presets);
      return;
    }

    if (activeProjectSnapshot) {
      activeProjectSnapshot.presets = normalizedPresets;
      activeProjectSnapshot.updatedAt = getNow();
    }

    renderPresetList(normalizedPresets);
  };

  const savePreset = () => {
    if (isViewerMode) {
      return;
    }

    const project = getActiveProject() || readCurrentProject();
    const presets = normalizePresets(project.presets);
    const selectedId = presetSelect.value;
    const existingPreset = presets.find((item) => item.id === selectedId);
    const name = presetNameInput.value.trim() || "Preset";
    const shouldUpdateSelected = existingPreset && existingPreset.name === name;
    const preset = {
      id: shouldUpdateSelected ? selectedId : createId(),
      name,
      uniforms: readCurrentUniforms(),
      createdAt: shouldUpdateSelected ? existingPreset.createdAt : getNow(),
    };
    const index = presets.findIndex((item) => item.id === preset.id);

    if (index === -1) {
      presets.unshift(preset);
    } else {
      presets[index] = preset;
    }

    persistActiveProjectPresets(presets);
    presetSelect.value = preset.id;
    presetNameInput.value = preset.name;
    setDirty(false);
    setError("Preset saved.");
  };

  const loadPreset = () => {
    const project = getActiveProject() || readCurrentProject();
    const preset = normalizePresets(project.presets).find((item) => item.id === presetSelect.value);

    if (!preset) {
      return;
    }

    scaleInput.value = String(preset.uniforms.scale);
    intensityInput.value = String(preset.uniforms.intensity);
    updateUniformControl("scale", scaleInput, scaleValue);
    updateUniformControl("intensity", intensityInput, intensityValue);
    presetNameInput.value = preset.name;
    setDirty(!isViewerMode);
  };

  const deletePreset = () => {
    if (isViewerMode) {
      return;
    }

    const project = getActiveProject();

    if (!project || !presetSelect.value) {
      return;
    }

    const presets = normalizePresets(project.presets).filter((preset) => preset.id !== presetSelect.value);
    persistActiveProjectPresets(presets);
    setDirty(false);
    setError("Preset deleted.");
  };

  const createShareUrl = () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set(shareParam, encodeSharePayload(readCurrentProject()));
    lastShareUrl = url.toString();
    return lastShareUrl;
  };

  const copyShareUrl = async () => {
    const url = lastShareUrl || createShareUrl();

    try {
      await navigator.clipboard.writeText(url);
      setError("Share link copied.");
    } catch {
      window.prompt("Copy share link", url);
      setError("Share link generated.");
    }
  };

  const openShareUrl = () => {
    const url = createShareUrl();
    copyShareUrl();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const editSharedCopy = () => {
    const project = {
      ...readCurrentProject(),
      id: createId(),
      title: `${projectTitleInput.value.trim() || "Shared Shader"} Copy`,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    projects = loadProjects();
    projects.unshift(project);
    persistProjects();

    const url = new URL(window.location.href);
    url.searchParams.delete(shareParam);
    window.history.replaceState({}, "", url);

    setViewerMode(false);
    applyProject(project);
  };

  const importProjectFile = async (file) => {
    try {
      const imported = JSON.parse(await file.text());

      if (!imported || typeof imported.shaderSource !== "string") {
        throw new Error("Imported file is not a shader project.");
      }

      const project = {
        ...createProject(imported.title || "Imported Shader"),
        ...imported,
        id: createId(),
        title: imported.title || "Imported Shader",
        uniforms: {
          scale: Number(imported.uniforms?.scale ?? 1),
          intensity: Number(imported.uniforms?.intensity ?? 1),
        },
        presets: normalizePresets(imported.presets),
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      projects.unshift(project);
      persistProjects();
      applyProject(project);
    } catch (error) {
      setError(error.message || String(error), true);
    } finally {
      importProjectInput.value = "";
    }
  };

  const setError = (message, isError = false) => {
    errorPanel.textContent = message;
    errorPanel.classList.toggle("has-error", isError);
  };

  const setStatus = (target, value) => {
    if (target === "adapter") {
      adapterStatus.textContent = value;
    }

    if (target === "pipeline") {
      pipelineStatus.textContent = value;
    }

    if (target === "frame") {
      frameStatus.textContent = value;
      pauseButton.textContent = value === "Running" ? "Pause" : "Resume";
    }
  };

  const renderer = new WebGPURenderer(canvas, setStatus);

  const compileShader = async () => {
    runButton.disabled = true;
    setStatus("pipeline", "Compiling");

    try {
      await renderer.setFragmentShader(editor.value);
      renderer.start();
      setStatus("pipeline", "Running");
      setError("Shader compiled successfully.");
    } catch (error) {
      setStatus("pipeline", "Error");
      setError(error.message || String(error), true);
    } finally {
      runButton.disabled = isViewerMode;
    }
  };

  const queueCompile = () => {
    if (!autoRunToggle.checked) {
      return;
    }

    clearTimeout(compileTimer);
    compileTimer = window.setTimeout(compileShader, 450);
  };

  const updateUniformControl = (name, input, output) => {
    const value = Number(input.value);
    output.textContent = value.toFixed(2);
    renderer.setUniform(name, value);
  };

  runButton.addEventListener("click", compileShader);
  saveProjectButton.addEventListener("click", saveActiveProject);
  newProjectButton.addEventListener("click", startNewProject);
  duplicateProjectButton.addEventListener("click", duplicateActiveProject);
  deleteProjectButton.addEventListener("click", deleteActiveProject);
  exportProjectButton.addEventListener("click", exportActiveProject);
  shareProjectButton.addEventListener("click", openShareUrl);
  copyShareLinkButton.addEventListener("click", copyShareUrl);
  editCopyButton.addEventListener("click", editSharedCopy);
  savePresetButton.addEventListener("click", savePreset);
  loadPresetButton.addEventListener("click", loadPreset);
  deletePresetButton.addEventListener("click", deletePreset);
  presetSelect.addEventListener("change", () => {
    const project = getActiveProject() || readCurrentProject();
    const preset = normalizePresets(project.presets).find((item) => item.id === presetSelect.value);

    if (preset) {
      presetNameInput.value = preset.name;
    }
  });
  importProjectButton.addEventListener("click", () => importProjectInput.click());
  importProjectInput.addEventListener("change", () => {
    const [file] = importProjectInput.files;

    if (file) {
      importProjectFile(file);
    }
  });
  projectSelect.addEventListener("change", () => {
    const project = projects.find((item) => item.id === projectSelect.value);

    if (project) {
      applyProject(project);
    }
  });
  projectTitleInput.addEventListener("input", () => setDirty(true));

  editor.addEventListener("input", () => {
    setDirty(true);
    queueCompile();
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = `${editor.value.slice(0, start)}  ${editor.value.slice(end)}`;
    editor.selectionStart = start + 2;
    editor.selectionEnd = start + 2;
    setDirty(true);
    queueCompile();
  });

  templateSelect.addEventListener("change", () => {
    editor.value = shaderTemplates[templateSelect.value];
    setDirty(true);
    compileShader();
  });

  pauseButton.addEventListener("click", () => {
    if (renderer.isRunning) {
      renderer.pause();
    } else {
      renderer.start();
    }
  });

  resetTimeButton.addEventListener("click", () => renderer.resetTime());

  fullscreenButton.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }

    previewPane.requestFullscreen();
  });

  scaleInput.addEventListener("input", () => {
    updateUniformControl("scale", scaleInput, scaleValue);
    setDirty(true);
  });

  intensityInput.addEventListener("input", () => {
    updateUniformControl("intensity", intensityInput, intensityValue);
    setDirty(true);
  });

  try {
    const sharedProject = readSharedProjectFromUrl();

    if (sharedProject) {
      setViewerMode(true);
      applyProject(sharedProject, false);
      await renderer.init();
      await compileShader();
      return;
    }

    projects = loadProjects();

    if (projects.length === 0) {
      const starterProject = createProject("Starter Rings", "rings");
      projects = [starterProject];
      activeProjectId = starterProject.id;
      persistProjects();
    }

    applyProject(projects[0], false);
    await renderer.init();
    await compileShader();
  } catch (error) {
    setStatus("adapter", "Unavailable");
    setStatus("pipeline", "Stopped");
    setStatus("frame", "Paused");
    setError(error.message || String(error), true);
  }
})();
