export type ShaderTemplateId = "rings" | "plasma" | "gradient";

export type UniformValues = {
  scale: number;
  intensity: number;
};

export type Preset = {
  id: string;
  name: string;
  uniforms: UniformValues;
  createdAt: string;
};

export type ShaderProject = {
  id: string;
  title: string;
  shaderSource: string;
  template: ShaderTemplateId;
  uniforms: UniformValues;
  presets: Preset[];
  createdAt: string;
  updatedAt: string;
};

export type DraftProject = ShaderProject & {
  savedAt: string;
};

export type RuntimeStatus = {
  adapter: string;
  pipeline: string;
  frame: string;
};
