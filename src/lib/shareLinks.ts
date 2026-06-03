import type { ShaderProject } from "./types";
import { normalizeProject } from "./projectStorage";

const shareParam = "share";

export const encodeSharePayload = (project: ShaderProject) => {
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

export const createShareUrl = (project: ShaderProject) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(shareParam, encodeSharePayload(project));
  return url.toString();
};

export const readSharedProjectFromUrl = (): ShaderProject | null => {
  const value = new URLSearchParams(window.location.search).get(shareParam);

  if (!value) {
    return null;
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));

  if (!parsed || typeof parsed.shaderSource !== "string") {
    throw new Error("Shared shader payload is invalid.");
  }

  return normalizeProject(parsed, "Shared Shader");
};
