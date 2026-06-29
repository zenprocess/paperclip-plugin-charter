# Project Charter and Environments (Paperclip plugin)

A Paperclip plugin that gives each project a declared, queryable charter plus a deploy-environment and web-surface catalog, so agents and operators can query where a project is deployed (dev/test/preprod/prod, host, deploy method) instead of reconstructing that information from tickets, chat history, or tribal knowledge.

## Concepts

- **charter** — the stable identity record for a project: goal, owner, repo URL, maturity ladder position, and archetype (e.g. api, frontend, worker, library).
- **deploy_targets** — the set of environments a project is deployed to. Each target carries a `stage` (dev, test, preprod, prod) and a `substrate`, where substrate is one of:
  - `forkd microVM` — ephemeral microVM per deploy
  - `vm-host (docker compose)` — long-running VM running Docker Compose services
  - `cloudflare-worker` — Cloudflare Workers deployment (preview=preprod, production=prod)
- **web_surfaces** — discovered frontends associated with a project: URLs, framework hints, and last-seen timestamps surfaced by the freshness-audit job.

## Surfaces

- **Agent tools**: `get` (fetch a project's charter and targets by id), `register_target` (declare or update a deploy target), `run_interview` (interactive charter-completion flow for new projects).
- **Project detail tab**: a Paperclip board tab that renders the charter, deploy targets, and web surfaces for the selected project.
- **Scoped API routes**: REST routes mounted under the plugin namespace; all reads are unauthenticated within the board, writes require operator permission.
- **Freshness-audit scheduled job**: a periodic job that pings registered web surfaces, updates last-seen timestamps, and flags stale or unreachable targets.

## Install

```sh
paperclip plugin install @standra/paperclip-plugin-charter
```

## Status

early / scaffold

## License

MIT
