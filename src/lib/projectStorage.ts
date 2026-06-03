import type { DraftProject, Preset, ShaderProject, ShaderTemplateId, UniformValues } from "./types";
import { shaderTemplates } from "../webgpu/shaders";

export const projectStorageKey = "webgpu-shader-lab-projects";
export const draftStorageKey = "webgpu-shader-lab-draft";

export const createId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};

export const getNow = () => new Date().toISOString();

export const normalizeUniforms = (value?: Partial<UniformValues>): UniformValues => ({
  scale: Number(value?.scale ?? 1),
  intensity: Number(value?.intensity ?? 1),
});

export const normalizePresets = (value: unknown): Preset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((preset) => preset && typeof preset.name === "string")
    .map((preset) => ({
      id: preset.id || createId(),
      name: preset.name || "Preset",
      uniforms: normalizeUniforms(preset.uniforms),
      createdAt: preset.createdAt || getNow(),
    }));
};

export const createProject = (title = "Untitled Shader", template: ShaderTemplateId = "rings"): ShaderProject => ({
  id: createId(),
  title,
  shaderSource: shaderTemplates[template],
  template,
  uniforms: { scale: 1, intensity: 1 },
  presets: [
    {
      id: createId(),
      name: "Default",
      uniforms: { scale: 1, intensity: 1 },
      createdAt: getNow(),
    },
  ],
  createdAt: getNow(),
  updatedAt: getNow(),
});

export const normalizeProject = (value: Partial<ShaderProject>, fallbackTitle = "Untitled Shader"): ShaderProject => ({
  ...createProject(value.title || fallbackTitle, value.template || "rings"),
  ...value,
  id: value.id || createId(),
  title: value.title || fallbackTitle,
  template: value.template || "rings",
  shaderSource: value.shaderSource || shaderTemplates[value.template || "rings"],
  uniforms: normalizeUniforms(value.uniforms),
  presets: normalizePresets(value.presets),
  createdAt: value.createdAt || getNow(),
  updatedAt: value.updatedAt || getNow(),
});

export const loadProjects = (): ShaderProject[] => {
  try {
    const storedProjects = JSON.parse(localStorage.getItem(projectStorageKey) || "[]");
    return Array.isArray(storedProjects) ? storedProjects.map((project) => normalizeProject(project)) : [];
  } catch {
    return [];
  }
};

export const persistProjects = (projects: ShaderProject[]) => {
  localStorage.setItem(projectStorageKey, JSON.stringify(projects));
};

export const loadDraft = (): DraftProject | null => {
  try {
    const draft = JSON.parse(localStorage.getItem(draftStorageKey) || "null");
    return draft && typeof draft.shaderSource === "string" ? (normalizeProject(draft, "Recovered Draft") as DraftProject) : null;
  } catch {
    return null;
  }
};

export const persistDraft = (draft: DraftProject) => {
  localStorage.setItem(draftStorageKey, JSON.stringify(draft));
};

export const clearDraft = () => {
  localStorage.removeItem(draftStorageKey);
};
