import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const manifest: PaperclipPluginManifestV1 = {
  id: "charter",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Project Charter and Environments",
  description:
    "Per-project charter with declared deploy-environment and web-surface catalog for every project.",
  author: "standra.ai",
  categories: ["workspace"],
  capabilities: [
    "database.namespace.read",
    "database.namespace.migrate",
    "database.namespace.write",
    "agent.tools.register",
    "api.routes.register",
    "jobs.schedule",
    "ui.detailTab.register",
  ],
  database: {
    namespaceSlug: "charter",
    migrationsDir: "./migrations",
    coreReadTables: ["projects"],
  },
  tools: [
    {
      name: "get",
      displayName: "Get Charter",
      description: "Retrieve the project charter for a given project.",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project." },
        },
        required: ["projectId"],
      },
    },
    {
      name: "register_target",
      displayName: "Register Deploy Target",
      description: "Register a deploy target (environment + URL) for a project.",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project." },
          target: {
            type: "object",
            properties: {
              stage: {
                type: "string",
                enum: ["dev", "test", "preprod", "prod"],
              },
              substrate: { type: "object" },
              url: { type: "string" },
              branch: { type: "string" },
            },
            required: ["stage", "substrate"],
          },
        },
        required: ["projectId", "target"],
      },
    },
    {
      name: "run_interview",
      displayName: "Run Charter Interview",
      description:
        "Run a structured interview to populate or update the project charter fields.",
      parametersSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project." },
          answers: {
            type: "object",
            properties: {
              goal: { type: "string" },
              owner: { type: "string" },
              repo_url: { type: "string" },
              deploy_archetype: { type: "string" },
              env_ladder: { type: "array" },
              deploy_targets: { type: "array" },
            },
          },
        },
        required: ["projectId", "answers"],
      },
    },
  ],
  apiRoutes: [
    {
      routeKey: "get-charter",
      method: "GET",
      path: "/charter",
      auth: "board-or-agent",
      capability: "api.routes.register",
    },
    {
      routeKey: "get-deploy-targets",
      method: "GET",
      path: "/deploy-targets",
      auth: "board-or-agent",
      capability: "api.routes.register",
    },
  ],
  jobs: [
    {
      jobKey: "freshness-audit",
      schedule: "0 * * * *",
      displayName: "Freshness audit",
    },
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui/",
  },
  ui: {
    slots: [
      {
        type: "detailTab",
        entityTypes: ["project"],
        id: "charter",
        displayName: "Charter",
        exportName: "CharterTab",
      },
    ],
  },
};

export default manifest;
