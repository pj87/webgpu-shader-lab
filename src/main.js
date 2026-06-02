(async () => {
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
  const runButton = document.querySelector("#runButton");
  const pauseButton = document.querySelector("#pauseButton");
  const resetTimeButton = document.querySelector("#resetTimeButton");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const templateSelect = document.querySelector("#templateSelect");
  const autoRunToggle = document.querySelector("#autoRunToggle");
  const errorPanel = document.querySelector("#errorPanel");
  const adapterStatus = document.querySelector("#adapterStatus");
  const pipelineStatus = document.querySelector("#pipelineStatus");
  const frameStatus = document.querySelector("#frameStatus");
  const scaleInput = document.querySelector("#scaleInput");
  const scaleValue = document.querySelector("#scaleValue");
  const intensityInput = document.querySelector("#intensityInput");
  const intensityValue = document.querySelector("#intensityValue");
  const canvas = document.querySelector("#previewCanvas");
  const previewPane = document.querySelector(".preview-pane");

  let compileTimer = 0;

  editor.value = shaderTemplates.rings;

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
      runButton.disabled = false;
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

  editor.addEventListener("input", queueCompile);
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
    queueCompile();
  });

  templateSelect.addEventListener("change", () => {
    editor.value = shaderTemplates[templateSelect.value];
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
  });

  intensityInput.addEventListener("input", () => {
    updateUniformControl("intensity", intensityInput, intensityValue);
  });

  try {
    await renderer.init();
    updateUniformControl("scale", scaleInput, scaleValue);
    updateUniformControl("intensity", intensityInput, intensityValue);
    await compileShader();
  } catch (error) {
    setStatus("adapter", "Unavailable");
    setStatus("pipeline", "Stopped");
    setStatus("frame", "Paused");
    setError(error.message || String(error), true);
  }
})();
