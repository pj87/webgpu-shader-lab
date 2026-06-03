import type { UniformValues } from "../lib/types";
import { commonShader } from "./shaders";

type StatusTarget = "adapter" | "pipeline" | "frame";

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private onStatus: (target: StatusTarget, value: string) => void;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private format: GPUTextureFormat | null = null;
  private animationId = 0;
  private startTime = performance.now();
  private mouse = { x: 0, y: 0 };
  public isRunning = false;
  public uniforms: UniformValues = { scale: 1, intensity: 1 };

  constructor(canvas: HTMLCanvasElement, onStatus: (target: StatusTarget, value: string) => void) {
    this.canvas = canvas;
    this.onStatus = onStatus;
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
    window.addEventListener("resize", this.configureCanvas);
    this.canvas.addEventListener("pointermove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    });

    this.onStatus("adapter", "Ready");
  }

  destroy() {
    this.pause();
    window.removeEventListener("resize", this.configureCanvas);
  }

  private configureCanvas = () => {
    if (!this.device || !this.context || !this.format) {
      return;
    }

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
  };

  setUniform(name: keyof UniformValues, value: number) {
    this.uniforms[name] = value;
  }

  resetTime() {
    this.startTime = performance.now();
  }

  async setFragmentShader(fragmentShader: string) {
    if (!this.device || !this.uniformBuffer || !this.format) {
      throw new Error("WebGPU renderer has not been initialized.");
    }

    const source = `${commonShader}\n${fragmentShader}`;

    this.device.pushErrorScope("validation");
    let pipeline: GPURenderPipeline;

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
      const fallbackMessage = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
      throw new Error(scopedError?.message || fallbackMessage);
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

  private render() {
    if (!this.device || !this.context || !this.pipeline || !this.bindGroup || !this.uniformBuffer) {
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
