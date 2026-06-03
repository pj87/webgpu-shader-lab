import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DraftProject, Preset, RuntimeStatus, ShaderProject, ShaderTemplateId, UniformValues } from "./lib/types";
import {
  clearDraft,
  createId,
  createProject,
  getNow,
  loadDraft,
  loadProjects,
  normalizePresets,
  normalizeProject,
  persistDraft,
  persistProjects,
} from "./lib/projectStorage";
import { createShareUrl, readSharedProjectFromUrl } from "./lib/shareLinks";
import { WebGPURenderer } from "./webgpu/WebGPURenderer";
import { shaderTemplates } from "./webgpu/shaders";

const templateOptions: Array<{ id: ShaderTemplateId; label: string }> = [
  { id: "rings", label: "Rings" },
  { id: "plasma", label: "Plasma" },
  { id: "gradient", label: "Gradient" },
];

const formatDraftTime = (draft: DraftProject) =>
  `Saved ${new Date(draft.savedAt || draft.updatedAt || getNow()).toLocaleString()}`;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const compileTimerRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const [projects, setProjects] = useState<ShaderProject[]>([]);
  const [activeProject, setActiveProject] = useState<ShaderProject>(() => createProject("Starter Rings", "rings"));
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("Preset 1");
  const [isDirty, setIsDirty] = useState(false);
  const [isViewerMode, setIsViewerMode] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    adapter: "Checking",
    pipeline: "Idle",
    frame: "Paused",
  });
  const [errorMessage, setErrorMessage] = useState("Ready.");
  const [hasError, setHasError] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Idle");
  const [pendingDraft, setPendingDraft] = useState<DraftProject | null>(null);

  const activeStoredProject = useMemo(
    () => projects.find((project) => project.id === activeProject.id),
    [activeProject.id, projects],
  );

  const setError = useCallback((message: string, isError = false) => {
    setErrorMessage(message);
    setHasError(isError);
  }, []);

  const updateProject = useCallback((updates: Partial<ShaderProject>) => {
    setActiveProject((current) => ({
      ...current,
      ...updates,
      uniforms: updates.uniforms ? { ...current.uniforms, ...updates.uniforms } : current.uniforms,
      presets: updates.presets ? normalizePresets(updates.presets) : current.presets,
      updatedAt: getNow(),
    }));
    setIsDirty(true);
  }, []);

  const readCurrentProject = useCallback(
    (): ShaderProject => ({
      ...activeProject,
      presets: normalizePresets(activeStoredProject?.presets || activeProject.presets),
      updatedAt: getNow(),
    }),
    [activeProject, activeStoredProject],
  );

  const applyProject = useCallback((project: ShaderProject) => {
    const normalized = normalizeProject(project);
    setActiveProject(normalized);
    setSelectedProjectId(normalized.id);
    setSelectedPresetId(normalized.presets[0]?.id || "");
    setPresetName(normalized.presets[0]?.name || "Preset 1");
    setIsDirty(false);
  }, []);

  const writeProjects = useCallback((nextProjects: ShaderProject[]) => {
    setProjects(nextProjects);
    persistProjects(nextProjects);
  }, []);

  const clearAutosavedDraft = useCallback(() => {
    clearDraft();
    setPendingDraft(null);
    setAutosaveStatus("Idle");
  }, []);

  const saveActiveProject = useCallback(() => {
    if (isViewerMode) {
      return readCurrentProject();
    }

    const project = readCurrentProject();
    const index = projects.findIndex((item) => item.id === project.id);
    const nextProjects = index === -1 ? [project, ...projects] : projects.map((item) => (item.id === project.id ? project : item));

    writeProjects(nextProjects);
    setSelectedProjectId(project.id);
    setActiveProject(project);
    setIsDirty(false);
    clearAutosavedDraft();
    return project;
  }, [clearAutosavedDraft, isViewerMode, projects, readCurrentProject, writeProjects]);

  const compileShader = useCallback(async (sourceOverride?: string) => {
    const renderer = rendererRef.current;

    if (!renderer) {
      return;
    }

    setRuntimeStatus((current) => ({ ...current, pipeline: "Compiling" }));

    try {
      await renderer.setFragmentShader(sourceOverride ?? activeProject.shaderSource);
      renderer.start();
      setRuntimeStatus((current) => ({ ...current, pipeline: "Running" }));
      setError("Shader compiled successfully.");
    } catch (error) {
      setRuntimeStatus((current) => ({ ...current, pipeline: "Error" }));
      setError(error instanceof Error ? error.message : String(error), true);
    }
  }, [activeProject.shaderSource, setError]);

  const queueCompile = useCallback((sourceOverride?: string) => {
    if (!autoRun) {
      return;
    }

    if (compileTimerRef.current) {
      window.clearTimeout(compileTimerRef.current);
    }

    compileTimerRef.current = window.setTimeout(() => compileShader(sourceOverride), 450);
  }, [autoRun, compileShader]);

  const queueAutosave = useCallback(() => {
    if (isViewerMode || !isDirty) {
      return;
    }

    setAutosaveStatus("Pending");

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const draft: DraftProject = {
        ...readCurrentProject(),
        savedAt: getNow(),
      };

      persistDraft(draft);
      setPendingDraft(draft);
      setAutosaveStatus("Saved");
    }, 700);
  }, [isDirty, isViewerMode, readCurrentProject]);

  useEffect(() => {
    queueAutosave();
  }, [activeProject, isDirty, queueAutosave]);

  useEffect(() => {
    const sharedProject = readSharedProjectFromUrl();

    if (sharedProject) {
      setIsViewerMode(true);
      applyProject(sharedProject);
      return;
    }

    const storedProjects = loadProjects();
    const initialProjects = storedProjects.length > 0 ? storedProjects : [createProject("Starter Rings", "rings")];
    writeProjects(initialProjects);
    applyProject(initialProjects[0]);

    const draft = loadDraft();
    if (draft) {
      setPendingDraft(draft);
      setAutosaveStatus("Draft");
    }
  }, [applyProject, writeProjects]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || rendererRef.current) {
      return;
    }

    const renderer = new WebGPURenderer(canvas, (target, value) => {
      setRuntimeStatus((current) => ({ ...current, [target]: value }));
    });
    rendererRef.current = renderer;

    renderer
      .init()
      .then(() => compileShader())
      .catch((error) => {
        setRuntimeStatus({ adapter: "Unavailable", pipeline: "Stopped", frame: "Paused" });
        setError(error instanceof Error ? error.message : String(error), true);
      });

    return () => renderer.destroy();
  }, [compileShader, setError]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer) {
      return;
    }

    renderer.setUniform("scale", activeProject.uniforms.scale);
    renderer.setUniform("intensity", activeProject.uniforms.intensity);
  }, [activeProject.uniforms]);

  useEffect(() => {
    const flushDraft = () => {
      if (!isViewerMode && isDirty) {
        persistDraft({ ...readCurrentProject(), savedAt: getNow() });
      }
    };

    window.addEventListener("beforeunload", flushDraft);
    return () => window.removeEventListener("beforeunload", flushDraft);
  }, [isDirty, isViewerMode, readCurrentProject]);

  const createNewProject = () => {
    if (isViewerMode) {
      return;
    }

    applyProject(createProject());
    setIsDirty(true);
  };

  const duplicateProject = () => {
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

    const nextProjects = [duplicate, ...projects];
    writeProjects(nextProjects);
    clearAutosavedDraft();
    applyProject(duplicate);
  };

  const deleteProject = () => {
    if (isViewerMode || !activeProject.id) {
      return;
    }

    if (!window.confirm(`Delete "${activeProject.title}"?`)) {
      return;
    }

    const nextProjects = projects.filter((project) => project.id !== activeProject.id);
    writeProjects(nextProjects);
    clearAutosavedDraft();

    if (nextProjects.length > 0) {
      applyProject(nextProjects[0]);
      return;
    }

    createNewProject();
  };

  const exportProject = () => {
    const project = readCurrentProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "shader"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File) => {
    try {
      const imported = JSON.parse(await file.text());

      if (!imported || typeof imported.shaderSource !== "string") {
        throw new Error("Imported file is not a shader project.");
      }

      const project = normalizeProject(imported, "Imported Shader");
      writeProjects([project, ...projects]);
      clearAutosavedDraft();
      applyProject(project);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error), true);
    }
  };

  const copyShareLink = async (open = false) => {
    const project = saveActiveProject();
    const url = createShareUrl(project || readCurrentProject());

    try {
      await navigator.clipboard.writeText(url);
      setError("Share link copied.");
    } catch {
      window.prompt("Copy share link", url);
      setError("Share link generated.");
    }

    if (open) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const editSharedCopy = () => {
    const project = {
      ...readCurrentProject(),
      id: createId(),
      title: `${activeProject.title || "Shared Shader"} Copy`,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    const nextProjects = [project, ...loadProjects()];
    writeProjects(nextProjects);

    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    window.history.replaceState({}, "", url);

    setIsViewerMode(false);
    clearAutosavedDraft();
    applyProject(project);
  };

  const restoreDraft = () => {
    if (!pendingDraft) {
      return;
    }

    applyProject(normalizeProject(pendingDraft, "Recovered Draft"));
    setIsDirty(true);
    setAutosaveStatus("Restored");
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearAutosavedDraft();
    setError("Draft discarded.");
  };

  const savePreset = () => {
    if (isViewerMode) {
      return;
    }

    const presets = normalizePresets(activeProject.presets);
    const existingPreset = presets.find((preset) => preset.id === selectedPresetId);
    const name = presetName.trim() || "Preset";
    const shouldUpdateSelected = existingPreset && existingPreset.name === name;
    const preset: Preset = {
      id: shouldUpdateSelected ? selectedPresetId : createId(),
      name,
      uniforms: activeProject.uniforms,
      createdAt: shouldUpdateSelected ? existingPreset.createdAt : getNow(),
    };
    const nextPresets = presets.some((item) => item.id === preset.id)
      ? presets.map((item) => (item.id === preset.id ? preset : item))
      : [preset, ...presets];

    updateProject({ presets: nextPresets });
    setSelectedPresetId(preset.id);
    setPresetName(preset.name);
    setError("Preset saved.");
  };

  const loadPreset = () => {
    const preset = activeProject.presets.find((item) => item.id === selectedPresetId);

    if (!preset) {
      return;
    }

    updateProject({ uniforms: preset.uniforms });
    setPresetName(preset.name);
  };

  const deletePreset = () => {
    if (isViewerMode) {
      return;
    }

    const nextPresets = activeProject.presets.filter((preset) => preset.id !== selectedPresetId);
    updateProject({ presets: nextPresets });
    setSelectedPresetId(nextPresets[0]?.id || "");
    setPresetName(nextPresets[0]?.name || "Preset 1");
    setError("Preset deleted.");
  };

  const updateUniform = (name: keyof UniformValues, value: number) => {
    updateProject({
      uniforms: {
        ...activeProject.uniforms,
        [name]: value,
      },
    });
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Milestone 7</p>
          <h1>WebGPU Shader Lab</h1>
        </div>

        {isViewerMode && (
          <div className="viewer-notice">
            <strong>Public Viewer</strong>
            <span>Read-only shader link</span>
          </div>
        )}

        <section className="project-panel" aria-label="Projects">
          <div>
            <p className="eyebrow">Project</p>
            <input
              aria-label="Project title"
              disabled={isViewerMode}
              type="text"
              value={activeProject.title}
              onChange={(event) => updateProject({ title: event.target.value })}
            />
          </div>
          <div className="project-actions">
            <button disabled={isViewerMode} type="button" onClick={createNewProject}>New</button>
            <button disabled={isViewerMode} type="button" onClick={saveActiveProject}>Save</button>
            <button disabled={isViewerMode} type="button" onClick={duplicateProject}>Copy</button>
            <button disabled={isViewerMode} type="button" onClick={deleteProject}>Delete</button>
          </div>
          <select
            aria-label="Saved projects"
            disabled={isViewerMode}
            size={5}
            value={selectedProjectId}
            onChange={(event) => {
              const project = projects.find((item) => item.id === event.target.value);

              if (project) {
                applyProject(project);
              }
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.title}</option>
            ))}
          </select>
          <div className="project-actions">
            <button type="button" onClick={exportProject}>Export</button>
            <label className="file-button">
              Import
              <input
                accept="application/json"
                hidden
                type="file"
                onChange={(event) => {
                  const [file] = Array.from(event.target.files || []);

                  if (file) {
                    importProject(file);
                  }

                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <div className="project-actions">
            <button disabled={isViewerMode} type="button" onClick={() => copyShareLink(true)}>Share</button>
            <button disabled={isViewerMode} type="button" onClick={() => copyShareLink()}>Copy Link</button>
          </div>
          {isViewerMode && <button className="wide-button" type="button" onClick={editSharedCopy}>Edit Copy</button>}
        </section>

        {pendingDraft && !isViewerMode && (
          <section className="recovery-panel" aria-label="Recovery">
            <div>
              <strong>Autosave Found</strong>
              <span>{formatDraftTime(pendingDraft)}</span>
            </div>
            <div className="project-actions">
              <button type="button" onClick={restoreDraft}>Restore</button>
              <button type="button" onClick={discardDraft}>Discard</button>
            </div>
          </section>
        )}

        <div className="status-group">
          <div className="status-row">
            <span>Project</span>
            <strong>{isViewerMode ? "Shared" : isDirty ? "Unsaved" : "Saved"}</strong>
          </div>
          <div className="status-row">
            <span>Autosave</span>
            <strong>{autosaveStatus}</strong>
          </div>
          <div className="status-row">
            <span>Adapter</span>
            <strong>{runtimeStatus.adapter}</strong>
          </div>
          <div className="status-row">
            <span>Pipeline</span>
            <strong>{runtimeStatus.pipeline}</strong>
          </div>
          <div className="status-row">
            <span>Frame</span>
            <strong>{runtimeStatus.frame}</strong>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <div className="editor-pane">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Fragment WGSL</p>
              <h2>Shader Editor</h2>
            </div>
            <div className="toolbar-actions">
              <select
                aria-label="Shader template"
                disabled={isViewerMode}
                value={activeProject.template}
                onChange={(event) => {
                  const template = event.target.value as ShaderTemplateId;
                  updateProject({ template, shaderSource: shaderTemplates[template] });
                  window.setTimeout(() => compileShader(shaderTemplates[template]), 0);
                }}
              >
                {templateOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <label className="toggle-control">
                <input checked={autoRun} disabled={isViewerMode} type="checkbox" onChange={(event) => setAutoRun(event.target.checked)} />
                <span>Auto</span>
              </label>
              <button disabled={isViewerMode} type="button" onClick={() => compileShader()}>Run</button>
            </div>
          </div>
          <textarea
            disabled={isViewerMode}
            spellCheck={false}
            value={activeProject.shaderSource}
            onChange={(event) => {
              updateProject({ shaderSource: event.target.value });
              queueCompile(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") {
                return;
              }

              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const nextSource = `${activeProject.shaderSource.slice(0, start)}  ${activeProject.shaderSource.slice(end)}`;
              updateProject({ shaderSource: nextSource });
              requestAnimationFrame(() => {
                target.selectionStart = start + 2;
                target.selectionEnd = start + 2;
              });
              queueCompile(nextSource);
            }}
          />
          <pre className={`error-panel${hasError ? " has-error" : ""}`}>{errorMessage}</pre>
        </div>

        <div ref={previewPaneRef} className="preview-pane">
          <div className="preview-toolbar">
            <button
              type="button"
              onClick={() => {
                const renderer = rendererRef.current;

                if (!renderer) {
                  return;
                }

                if (renderer.isRunning) {
                  renderer.pause();
                } else {
                  renderer.start();
                }
              }}
            >
              {runtimeStatus.frame === "Running" ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => rendererRef.current?.resetTime()}>Reset</button>
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                  return;
                }

                previewPaneRef.current?.requestFullscreen();
              }}
            >
              Full
            </button>
          </div>
          <canvas ref={canvasRef} />
          <div className="inspector">
            <label>
              <span>Scale</span>
              <input
                max="4"
                min="0.25"
                step="0.01"
                type="range"
                value={activeProject.uniforms.scale}
                onChange={(event) => updateUniform("scale", Number(event.target.value))}
              />
              <strong>{activeProject.uniforms.scale.toFixed(2)}</strong>
            </label>
            <label>
              <span>Intensity</span>
              <input
                max="2"
                min="0"
                step="0.01"
                type="range"
                value={activeProject.uniforms.intensity}
                onChange={(event) => updateUniform("intensity", Number(event.target.value))}
              />
              <strong>{activeProject.uniforms.intensity.toFixed(2)}</strong>
            </label>
            <div className="preset-panel">
              <div className="preset-title">
                <span>Presets</span>
                <select
                  aria-label="Uniform presets"
                  value={selectedPresetId}
                  onChange={(event) => {
                    const preset = activeProject.presets.find((item) => item.id === event.target.value);
                    setSelectedPresetId(event.target.value);
                    setPresetName(preset?.name || "Preset 1");
                  }}
                >
                  {activeProject.presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>
              <input
                aria-label="Preset name"
                disabled={isViewerMode}
                type="text"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
              />
              <div className="preset-actions">
                <button disabled={isViewerMode} type="button" onClick={savePreset}>Save</button>
                <button type="button" onClick={loadPreset}>Load</button>
                <button disabled={isViewerMode} type="button" onClick={deletePreset}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
