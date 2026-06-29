import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { Charter, DeployTarget, Stage, WebSurface } from "./types.js";

const VALID_STAGES = new Set<Stage>(["dev", "test", "preprod", "prod"]);
const VALID_PROVIDERS = new Set<string>(["forkd", "vm-host", "cloudflare-worker"]);

function isValidStage(s: unknown): s is Stage {
  return typeof s === "string" && VALID_STAGES.has(s as Stage);
}

function isValidProvider(s: unknown): boolean {
  return typeof s === "string" && VALID_PROVIDERS.has(s);
}

const plugin = definePlugin({
  async setup(ctx) {
    const ns = ctx.db.namespace;

    /**
     * Validate and upsert a single deploy_target row keyed by (project_id, stage).
     * Throws on invalid input; callers convert to {error} as needed.
     */
    async function upsertTarget(
      projectId: string,
      target: Record<string, unknown>,
    ): Promise<DeployTarget> {
      if (!isValidStage(target.stage)) {
        throw new Error(`invalid stage: ${String(target.stage)}`);
      }
      const sub = target.substrate as Record<string, unknown> | undefined;
      if (!sub || !isValidProvider(sub.provider)) {
        throw new Error(
          `invalid substrate.provider: ${String(sub?.provider)}`,
        );
      }

      const name = typeof target.name === "string" ? target.name : String(target.stage);
      const url = typeof target.url === "string" ? target.url : null;
      const branch = typeof target.branch === "string" ? target.branch : null;
      const substrateJson = JSON.stringify(sub);

      const existing = await ctx.db.query<DeployTarget>(
        `SELECT * FROM ${ns}.deploy_targets WHERE project_id = $1 AND stage = $2`,
        [projectId, target.stage],
      );

      if (existing.length > 0) {
        await ctx.db.execute(
          `UPDATE ${ns}.deploy_targets
             SET name = $3,
                 substrate = $4::jsonb,
                 url = $5,
                 branch = $6,
                 status = 'declared',
                 updated_at = now()
           WHERE project_id = $1 AND stage = $2`,
          [projectId, target.stage, name, substrateJson, url, branch],
        );
      } else {
        await ctx.db.execute(
          `INSERT INTO ${ns}.deploy_targets
             (id, project_id, name, stage, substrate, url, branch, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, $6, 'declared')`,
          [projectId, name, target.stage, substrateJson, url, branch],
        );
      }

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
          data: {
            charter: charterRows[0] ?? null,
            deploy_targets: targetRows,
            web_surfaces: surfaceRows,
          },
        };
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
            deploy_archetype?: string;
            env_ladder?: unknown[];
            deploy_targets?: Record<string, unknown>[];
          };
        };

        const envLadderJson = JSON.stringify(answers.env_ladder ?? []);

        await ctx.db.execute(
          `INSERT INTO ${ns}.charter
             (project_id, goal, owner, repo_url, deploy_archetype, env_ladder)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT (project_id) DO UPDATE SET
             goal             = EXCLUDED.goal,
             owner            = EXCLUDED.owner,
             repo_url         = EXCLUDED.repo_url,
             deploy_archetype = EXCLUDED.deploy_archetype,
             env_ladder       = EXCLUDED.env_ladder,
             updated_at       = now()`,
          [
            projectId,
            answers.goal ?? null,
            answers.owner ?? null,
            answers.repo_url ?? null,
            answers.deploy_archetype ?? null,
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
});

export default plugin;
runWorker(plugin, import.meta.url);
