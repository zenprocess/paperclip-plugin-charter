import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type {
  PluginApiRequestInput,
  PluginApiResponse,
  PluginContext,
} from "@paperclipai/plugin-sdk";
import type { Charter, DeployTarget, WebSurface } from "./types.js";
import { validateTarget } from "./types.js";

// Captured once during setup; onApiRequest is always called after setup resolves.
let _ctx: PluginContext | null = null;

async function fetchCharterData(
  ctx: PluginContext,
  projectId: string,
): Promise<{
  charter: Charter | null;
  deploy_targets: DeployTarget[];
  web_surfaces: WebSurface[];
}> {
  const ns = ctx.db.namespace;
  const [charterRows, targetRows, surfaceRows] = await Promise.all([
    ctx.db.query<Charter>(
      `SELECT * FROM ${ns}.charter WHERE project_id = $1`,
      [projectId],
    ),
    ctx.db.query<DeployTarget>(
      `SELECT * FROM ${ns}.deploy_targets WHERE project_id = $1`,
      [projectId],
    ),
    ctx.db.query<WebSurface>(
      `SELECT * FROM ${ns}.web_surfaces WHERE project_id = $1`,
      [projectId],
    ),
  ]);
  return {
    charter: charterRows[0] ?? null,
    deploy_targets: targetRows,
    web_surfaces: surfaceRows,
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    _ctx = ctx;
    const ns = ctx.db.namespace;

    /**
     * Validate and atomically upsert a single deploy_target row keyed by
     * (project_id, stage). Throws on invalid input; callers convert to
     * {error} as needed.
     */
    async function upsertTarget(
      projectId: string,
      target: Record<string, unknown>,
    ): Promise<DeployTarget> {
      const validation = validateTarget(target);
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      const name =
        typeof target.name === "string" ? target.name : String(target.stage);
      const url = typeof target.url === "string" ? target.url : null;
      const branch = typeof target.branch === "string" ? target.branch : null;
      const substrateJson = JSON.stringify(target.substrate);

      await ctx.db.execute(
        `INSERT INTO ${ns}.deploy_targets
           (id, project_id, name, stage, substrate, url, branch, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, $6, 'declared')
         ON CONFLICT (project_id, stage) DO UPDATE SET
           name       = EXCLUDED.name,
           substrate  = EXCLUDED.substrate,
           url        = EXCLUDED.url,
           branch     = EXCLUDED.branch,
           status     = 'declared',
           updated_at = now()`,
        [projectId, name, target.stage, substrateJson, url, branch],
      );

      const [saved] = await ctx.db.query<DeployTarget>(
        `SELECT * FROM ${ns}.deploy_targets WHERE project_id = $1 AND stage = $2`,
        [projectId, target.stage],
      );
      return saved;
    }

    // Scheduled job handler
    ctx.jobs.register("freshness-audit", async (_job) => {
      ctx.logger.info("freshness-audit: starting run", { runId: _job.runId });
    });

    // ─── data handlers ───────────────────────────────────────────────────────
    ctx.data.register("get-charter", async (params) => {
      const projectId =
        typeof params.projectId === "string" ? params.projectId : "";
      return fetchCharterData(ctx, projectId);
    });

    ctx.data.register("get-deploy-targets", async (params) => {
      const projectId =
        typeof params.projectId === "string" ? params.projectId : "";
      const { deploy_targets } = await fetchCharterData(ctx, projectId);
      return { deploy_targets };
    });

    // ─── get ──────────────────────────────────────────────────────────────────
    ctx.tools.register(
      "get",
      {
        displayName: "Get Charter",
        description: "Retrieve the project charter for a given project.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
      },
      async (params, _runCtx) => {
        const { projectId } = params as { projectId: string };
        return { data: await fetchCharterData(ctx, projectId) };
      },
    );

    // ─── register_target ─────────────────────────────────────────────────────
    ctx.tools.register(
      "register_target",
      {
        displayName: "Register Deploy Target",
        description: "Register a deploy target for a project.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            target: {
              type: "object",
              properties: {
                name: { type: "string" },
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
      async (params, _runCtx) => {
        const { projectId, target } = params as {
          projectId: string;
          target: Record<string, unknown>;
        };

        const validation = validateTarget(target);
        if (!validation.ok) {
          return { error: validation.error };
        }

        try {
          const saved = await upsertTarget(projectId, target);
          return { data: saved };
        } catch (err) {
          return { error: (err as Error).message };
        }
      },
    );

    // ─── run_interview ────────────────────────────────────────────────────────
    ctx.tools.register(
      "run_interview",
      {
        displayName: "Run Charter Interview",
        description:
          "Run a structured interview to populate or update the project charter.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
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
      async (params, _runCtx) => {
        const { projectId, answers } = params as {
          projectId: string;
          answers: {
            goal?: string;
            owner?: string;
            repo_url?: string;
            workspace_url?: string;
            deploy_archetype?: string;
            execution_provider?: string;
            execution_ref?: string;
            execution_env?: string;
            env_ladder?: unknown[];
            deploy_targets?: Record<string, unknown>[];
          };
        };

        const envLadderJson = JSON.stringify(answers.env_ladder ?? []);

        await ctx.db.execute(
          `INSERT INTO ${ns}.charter
             (project_id, goal, owner, repo_url, deploy_archetype, workspace_url, execution_provider, execution_ref, execution_env, env_ladder)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
           ON CONFLICT (project_id) DO UPDATE SET
             goal               = EXCLUDED.goal,
             owner              = EXCLUDED.owner,
             repo_url           = EXCLUDED.repo_url,
             deploy_archetype   = EXCLUDED.deploy_archetype,
             workspace_url      = EXCLUDED.workspace_url,
             execution_provider = EXCLUDED.execution_provider,
             execution_ref      = EXCLUDED.execution_ref,
             execution_env      = EXCLUDED.execution_env,
             env_ladder         = EXCLUDED.env_ladder,
             updated_at         = now()`,
          [
            projectId,
            answers.goal ?? null,
            answers.owner ?? null,
            answers.repo_url ?? null,
            answers.deploy_archetype ?? null,
            answers.workspace_url ?? null,
            answers.execution_provider ?? null,
            answers.execution_ref ?? null,
            answers.execution_env ?? null,
            envLadderJson,
          ],
        );

        if (answers.deploy_targets) {
          for (const target of answers.deploy_targets) {
            try {
              await upsertTarget(projectId, target);
            } catch (err) {
              ctx.logger.warn("run_interview: skipping invalid deploy_target", {
                error: (err as Error).message,
                target: JSON.stringify(target),
              });
            }
          }
        }

        const [charter] = await ctx.db.query<Charter>(
          `SELECT * FROM ${ns}.charter WHERE project_id = $1`,
          [projectId],
        );

        return { data: charter ?? null };
      },
    );
  },

  async onHealth() {
    return { status: "ok" as const };
  },

  async onApiRequest(
    input: PluginApiRequestInput,
  ): Promise<PluginApiResponse> {
    if (_ctx === null) {
      return { status: 503, body: { error: "plugin not initialized" } };
    }
    const ctx = _ctx;

    const rawProjectId = input.query["projectId"];
    const projectId = Array.isArray(rawProjectId)
      ? rawProjectId[0]
      : rawProjectId;
    if (typeof projectId !== "string" || projectId === "") {
      return {
        status: 400,
        body: { error: "projectId query parameter is required" },
      };
    }

    const { routeKey } = input;
    if (
      routeKey === "get-charter" ||
      routeKey === "get-deploy-targets"
    ) {
      const data = await fetchCharterData(ctx, projectId);
      return { status: 200, body: { data } };
    }

    return { status: 404, body: { error: "route not found" } };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
