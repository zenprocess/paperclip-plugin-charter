export type Stage = "dev" | "test" | "preprod" | "prod";

export interface ForkdSubstrate {
  provider: "forkd";
  host: string;
  pool?: "shared" | "dedicated";
}

export interface VmHostSubstrate {
  provider: "vm-host";
  host: string;
  deploy_method: string;
}

export interface CloudflareWorkerSubstrate {
  provider: "cloudflare-worker";
  worker_name: string;
  deployment: "preview" | "production";
}

export type Substrate =
  | ForkdSubstrate
  | VmHostSubstrate
  | CloudflareWorkerSubstrate;

export interface Charter {
  project_id: string;
  goal: string | null;
  designation: string | null;
  owner: string | null;
  company_key: string | null;
  secrets_path: string | null;
  repo_url: string | null;
  deploy_archetype: string | null;
  env_ladder: unknown[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeployTarget {
  id: string;
  project_id: string;
  name: string;
  stage: Stage;
  substrate: Substrate;
  url: string | null;
  branch: string | null;
  status: "declared" | "pending" | "undeclared";
  last_verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Pure runtime validators
// ---------------------------------------------------------------------------

const VALID_STAGES = ["dev", "test", "preprod", "prod"] as const;

export function isStage(x: unknown): x is Stage {
  return typeof x === "string" && (VALID_STAGES as readonly string[]).includes(x);
}

export function isSubstrate(x: unknown): x is Substrate {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  const provider = obj["provider"];
  if (provider === "forkd") {
    return typeof obj["host"] === "string";
  }
  if (provider === "vm-host") {
    return (
      typeof obj["host"] === "string" &&
      typeof obj["deploy_method"] === "string"
    );
  }
  if (provider === "cloudflare-worker") {
    return (
      typeof obj["worker_name"] === "string" &&
      (obj["deployment"] === "preview" || obj["deployment"] === "production")
    );
  }
  return false;
}

export function validateTarget(
  t: unknown
): { ok: true } | { ok: false; error: string } {
  if (typeof t !== "object" || t === null) {
    return { ok: false, error: "target must be an object" };
  }
  const obj = t as Record<string, unknown>;
  if (!isStage(obj["stage"])) {
    return { ok: false, error: `invalid stage: ${String(obj["stage"])}` };
  }
  if (!isSubstrate(obj["substrate"])) {
    return { ok: false, error: "invalid or missing substrate" };
  }
  return { ok: true };
}

export interface WebSurface {
  id: string;
  project_id: string;
  repo: string | null;
  subdir: string | null;
  framework: string | null;
  kind: string | null;
  output_dir: string | null;
  url: string | null;
  worker: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
