import type { ShaderTemplateId } from "../lib/types";

export const shaderTemplates: Record<ShaderTemplateId, string> = {
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

export const commonShader = `
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
