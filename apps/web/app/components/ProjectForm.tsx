"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  emptyProject,
  lifecycles,
  lifecycleLabels,
  type Project,
  type Resource,
  type Deployment,
  type Collector,
} from "@repo/registry";
import { api } from "../../lib/api";
import { ErrorNotice, Field, Panel } from "./ui";

const deploymentProviders = [
  "Vercel",
  "Cloudflare",
  "Netlify",
  "AWS",
  "Google Cloud",
  "Microsoft Azure",
  "Render",
  "Railway",
  "Fly.io",
  "DigitalOcean",
  "Docker",
  "VPS",
  "Local",
];

export default function ProjectForm({
  initial,
  collectors,
  onClose,
  onSaved,
}: {
  initial?: Partial<Project>;
  collectors: Collector[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState({ ...emptyProject(), ...initial });
  const [stackText, setStackText] = useState(
    [...new Set(draft.stack.map((s) => s.name))].join(", "),
  );
  const [tagsText, setTagsText] = useState(draft.tags.join(", "));
  const [tab, setTab] = useState("essentials");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const resource = (id: string, key: string, value: unknown) =>
    update(
      "resources",
      draft.resources.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  const deployment = (id: string, key: string, value: unknown) =>
    update(
      "deployments",
      draft.deployments.map((d) => (d.id === id ? { ...d, [key]: value } : d)),
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api<{ id?: string }>(
        draft.id ? `/projects/${draft.id}` : "/projects",
        {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify({
            ...draft,
            tags: tagsText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            stack: stackText
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .filter((name, index, names) => names.indexOf(name) === index)
              .flatMap((name) => {
                const evidence = draft.stack.filter((s) => s.name === name);
                return evidence.length
                  ? evidence
                  : [{ name, category: "technology", source: "manual" }];
              }),
          }),
        },
      );
      onSaved(draft.id || response.id!);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel
      title={initial?.id ? "Edit project" : "Add a project"}
      subtitle="Save the details your future self will need."
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="sheet-form">
        <div className="tabs">
          {[
            ["essentials", "Essentials"],
            ["resources", "Resources & hosting"],
            ["context", "Working context"],
          ].map(([id, name]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id!)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="sheet-body">
          <ErrorNotice message={error} />
          {tab === "essentials" && (
            <div className="form-grid">
              <Field label="Project name" wide>
                <input
                  autoFocus
                  required
                  maxLength={300}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="What are you building?"
                />
              </Field>
              <Field label="Purpose" wide>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="What does it do, and who is it for?"
                />
              </Field>
              <Field label="Lifecycle">
                <select
                  value={draft.lifecycle}
                  onChange={(e) => update("lifecycle", e.target.value)}
                >
                  {lifecycles.map((s) => (
                    <option key={s} value={s}>
                      {lifecycleLabels[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Organisation">
                <input
                  value={draft.organisation}
                  onChange={(e) => update("organisation", e.target.value)}
                  placeholder="Personal"
                />
              </Field>
              <Field label="Owner">
                <input
                  value={draft.owner}
                  onChange={(e) => update("owner", e.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Tags" hint="Separate tags with commas.">
                <input
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="Side project, Client work"
                />
              </Field>
              <Field
                label="Technology stack"
                hint="Separate technologies with commas. GitHub imports include detected versions and source files."
                wide
              >
                <input
                  value={stackText}
                  onChange={(e) => setStackText(e.target.value)}
                  placeholder="Next.js, TypeScript, PostgreSQL, Docker"
                />
              </Field>
              <Field label="Next action" wide>
                <textarea
                  rows={2}
                  value={draft.nextAction}
                  onChange={(e) => update("nextAction", e.target.value)}
                  placeholder="The one thing to start with next time."
                />
              </Field>
            </div>
          )}
          {tab === "resources" && (
            <>
              <div className="section-heading">
                <div>
                  <h3>Useful links</h3>
                  <p>
                    Source code, provider dashboards, databases, and
                    documentation.
                  </p>
                </div>
                <button
                  type="button"
                  className="button small"
                  onClick={() =>
                    update("resources", [
                      ...draft.resources,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        kind: "repository",
                        url: "",
                        environment: "",
                        provider: "",
                        note: "",
                      } as Resource,
                    ])
                  }
                >
                  <Plus size={15} />
                  Add link
                </button>
              </div>
              {draft.resources.map((r) => (
                <div className="edit-row" key={r.id}>
                  <div className="form-grid">
                    <Field label="Label">
                      <input
                        required
                        value={r.name}
                        onChange={(e) => resource(r.id, "name", e.target.value)}
                        placeholder="Source repository"
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={r.kind}
                        onChange={(e) => resource(r.id, "kind", e.target.value)}
                      >
                        {[
                          "repository",
                          "hosting",
                          "database",
                          "domain",
                          "documentation",
                          "service",
                        ].map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="URL" wide>
                      <input
                        type="url"
                        value={r.url}
                        onChange={(e) => resource(r.id, "url", e.target.value)}
                        placeholder="https://"
                      />
                    </Field>
                    <Field label="Provider / account">
                      <input
                        value={r.provider}
                        onChange={(e) =>
                          resource(r.id, "provider", e.target.value)
                        }
                        placeholder="Provider and account name"
                      />
                    </Field>
                    <Field label="Environment">
                      <input
                        value={r.environment}
                        onChange={(e) =>
                          resource(r.id, "environment", e.target.value)
                        }
                        placeholder="production"
                      />
                    </Field>
                    <Field label="Notes" wide>
                      <input
                        value={r.note}
                        onChange={(e) => resource(r.id, "note", e.target.value)}
                        placeholder="Secret reference or useful context; no passwords."
                      />
                    </Field>
                  </div>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() =>
                      update(
                        "resources",
                        draft.resources.filter((x) => x.id !== r.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                    Remove link
                  </button>
                </div>
              ))}
              <div className="section-heading spaced">
                <div>
                  <h3>Deployments</h3>
                  <p>One record for each component and environment.</p>
                </div>
                <button
                  type="button"
                  className="button small"
                  onClick={() =>
                    update("deployments", [
                      ...draft.deployments,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        environment: "production",
                        provider: "",
                        url: "",
                        dashboardUrl: "",
                        machineId: "",
                        localPath: "",
                        expectedRunning: true,
                      } as Deployment,
                    ])
                  }
                >
                  <Plus size={15} />
                  Add deployment
                </button>
              </div>
              {draft.deployments.map((d) => (
                <div key={d.id} className="edit-row">
                  <div className="form-grid">
                    <Field label="Component / deployment">
                      <input
                        required
                        value={d.name}
                        onChange={(e) =>
                          deployment(d.id, "name", e.target.value)
                        }
                        placeholder="Web application"
                      />
                    </Field>
                    <Field label="Environment">
                      <select
                        value={d.environment}
                        onChange={(e) =>
                          deployment(d.id, "environment", e.target.value)
                        }
                      >
                        {["local", "development", "staging", "production"].map(
                          (v) => (
                            <option key={v}>{v}</option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field
                      label="Hosting provider"
                      hint="Where this deployment is hosted. You can type a provider that is not listed."
                    >
                      <input
                        list="deployment-provider-options"
                        value={d.provider}
                        onChange={(e) =>
                          deployment(d.id, "provider", e.target.value)
                        }
                        placeholder="Vercel, Cloudflare, Docker, a VPS…"
                      />
                    </Field>
                    <Field
                      label="Local machine"
                      hint="Leave unassigned for Vercel and other hosted services."
                    >
                      <select
                        value={d.machineId}
                        onChange={(e) =>
                          deployment(d.id, "machineId", e.target.value)
                        }
                      >
                        <option value="">Hosted service / not assigned</option>
                        {collectors
                          .filter((c) => !c.revokedAt)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Application URL" wide>
                      <input
                        type="url"
                        value={d.url}
                        onChange={(e) =>
                          deployment(d.id, "url", e.target.value)
                        }
                        placeholder="https:// or http://localhost:3000"
                      />
                    </Field>
                    <Field label="Provider dashboard" wide>
                      <input
                        type="url"
                        value={d.dashboardUrl}
                        onChange={(e) =>
                          deployment(d.id, "dashboardUrl", e.target.value)
                        }
                        placeholder="https://"
                      />
                    </Field>
                    <Field label="Local project path" wide>
                      <input
                        value={d.localPath}
                        onChange={(e) =>
                          deployment(d.id, "localPath", e.target.value)
                        }
                        placeholder="/Users/you/Projects/app or C:\Projects\app"
                      />
                    </Field>
                    <label className="checkbox-field span-2">
                      <input
                        type="checkbox"
                        checked={d.expectedRunning}
                        onChange={(e) =>
                          deployment(d.id, "expectedRunning", e.target.checked)
                        }
                      />
                      Expected to be running{" "}
                      <small>
                        Turn off to suspend this deployment’s checks.
                      </small>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      update(
                        "deployments",
                        draft.deployments.filter((x) => x.id !== d.id),
                      )
                    }
                  >
                    <Trash2 size={14} />
                    Remove deployment
                  </button>
                </div>
              ))}
              <datalist id="deployment-provider-options">
                {deploymentProviders.map((provider) => (
                  <option key={provider} value={provider} />
                ))}
              </datalist>
            </>
          )}
          {tab === "context" && (
            <div className="form-grid">
              <Field label="Current blockers" wide>
                <textarea
                  rows={3}
                  value={draft.blockers}
                  onChange={(e) => update("blockers", e.target.value)}
                  placeholder="Known issues, open questions, things that are waiting."
                />
              </Field>
              {(["setup", "dev", "test", "deploy"] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      setup: "Setup command",
                      dev: "Start development",
                      test: "Run tests",
                      deploy: "Deploy",
                    }[key]
                  }
                  wide
                >
                  <textarea
                    className="mono"
                    rows={2}
                    value={draft.commands[key]}
                    onChange={(e) =>
                      update("commands", {
                        ...draft.commands,
                        [key]: e.target.value,
                      })
                    }
                    placeholder={key === "dev" ? "npm run dev" : ""}
                  />
                </Field>
              ))}
              <Field
                label="Architecture & working notes"
                hint="Commands are documentation. OpsGlass does not execute them."
                wide
              >
                <textarea
                  rows={7}
                  value={draft.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="How the pieces fit together, important decisions, deployment and recovery instructions."
                />
              </Field>
            </div>
          )}
        </div>
        <div className="sheet-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={saving || !draft.name.trim()}
          >
            {saving
              ? "Saving…"
              : initial?.id
                ? "Save changes"
                : "Create project"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
