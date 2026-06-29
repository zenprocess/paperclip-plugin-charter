import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const TOOL_NOT_IMPLEMENTED = "not implemented";

const plugin = definePlugin({
  async setup(ctx) {
    // Scheduled job handler
    ctx.jobs.register("freshness-audit", async (_job) => {
      ctx.logger.info("freshness-audit: starting run", { runId: _job.runId });
    });

    // Agent tool handlers — one registration per declared tool
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
      async (_params, _runCtx) => {
        return { error: TOOL_NOT_IMPLEMENTED };
      },
    );

    ctx.tools.register(
      "register_target",
      {
        displayName: "Register Deploy Target",
        description: "Register a deploy target for a project.",
        parametersSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            name: { type: "string" },
            url: { type: "string" },
            environment: { type: "string" },
          },
          required: ["projectId", "name", "url", "environment"],
        },
      },
      async (_params, _runCtx) => {
        return { error: TOOL_NOT_IMPLEMENTED };
      },
    );

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
          },
          required: ["projectId"],
        },
      },
      async (_params, _runCtx) => {
        return { error: TOOL_NOT_IMPLEMENTED };
      },
    );
  },

  async onHealth() {
    return { status: "ok" as const };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
