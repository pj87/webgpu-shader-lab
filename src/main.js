(async () => {
  const defaultFragmentShader = `@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let p = (uv * 2.0 - 1.0) * vec2<f32>(uniforms.resolution.x / uniforms.resolution.y, 1.0);
  let mouse = uniforms.mouse / max(uniforms.resolution, vec2<f32>(1.0));
  let pulse = 0.5 + 0.5 * sin(uniforms.time * 2.0);
  let glow = 0.025 / abs(length(p - vec2<f32>(mouse.x * 2.0 - 1.0, 1.0 - mouse.y * 2.0)) - 0.35);
  let bands = 0.5 + 0.5 * cos(12.0 * length(p) - uniforms.time * 3.0);

  return vec4<f32>(
    0.10 + bands * 0.28 + glow * 0.55,
    0.18 + pulse * 0.25 + glow * 0.75,
    0.24 + bands * 0.42,
    1.0
  );
}`;

  const commonShader = `
struct Uniforms {
  time: f32,
  _pad0: f32,
  resolution: vec2<f32>,
  mouse: vec2<f32>,
  _pad1: vec2<f32>,
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
      this.mouse = { x: 0, y: 0 };
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
    const frame = () => {
      this.render();
      this.animationId = requestAnimationFrame(frame);
    };

    cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(frame);
  }

  render() {
    if (!this.pipeline || !this.bindGroup) {
      return;
    }

    this.configureCanvas();

    const time = (performance.now() - this.startTime) / 1000;
    const uniforms = new Float32Array([
      time,
      0,
      this.canvas.width,
      this.canvas.height,
      this.mouse.x * (window.devicePixelRatio || 1),
      this.mouse.y * (window.devicePixelRatio || 1),
      0,
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
  const errorPanel = document.querySelector("#errorPanel");
  const adapterStatus = document.querySelector("#adapterStatus");
  const pipelineStatus = document.querySelector("#pipelineStatus");
  const canvas = document.querySelector("#previewCanvas");

  editor.value = defaultFragmentShader;

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

  runButton.addEventListener("click", compileShader);

  try {
    await renderer.init();
    await compileShader();
  } catch (error) {
    setStatus("adapter", "Unavailable");
    setStatus("pipeline", "Stopped");
    setError(error.message || String(error), true);
  }
})();
