import {
  usePluginData,
  Spinner,
  StatusBadge,
  DataTable,
  KeyValueList,
} from "@paperclipai/plugin-sdk/ui";
import type {
  PluginDetailTabProps,
  DataTableColumn,
  KeyValuePair,
  StatusBadgeVariant,
} from "@paperclipai/plugin-sdk/ui";
import type { Charter, DeployTarget, Substrate } from "../types.js";

interface CharterApiResponse {
  charter: Charter | null;
  deploy_targets: DeployTarget[];
  web_surfaces: unknown[];
}

function substrateDisplay(substrate: Substrate): {
  provider: string;
  hostOrWorker: string;
} {
  if (substrate.provider === "cloudflare-worker") {
    return { provider: substrate.provider, hostOrWorker: substrate.worker_name };
  }
  return { provider: substrate.provider, hostOrWorker: substrate.host };
}

function statusVariant(status: string): StatusBadgeVariant {
  if (status === "declared") return "ok";
  if (status === "pending") return "pending";
  return "warning";
}

const columns: DataTableColumn<Record<string, unknown>>[] = [
  { key: "stage", header: "Stage" },
  { key: "provider", header: "Provider" },
  { key: "hostOrWorker", header: "Host / Worker" },
  {
    key: "web",
    header: "Web",
    render: (value) =>
      value && value !== "" ? (
        <a href={String(value)} target="_blank" rel="noreferrer">
          {String(value)}
        </a>
      ) : (
        <span>None</span>
      ),
  },
  {
    key: "ssh",
    header: "SSH",
    render: (value) =>
      value && value !== "" ? (
        <span>{String(value)}</span>
      ) : (
        <span>None</span>
      ),
  },
  {
    key: "consul",
    header: "Consul",
    render: (value) =>
      value && value !== "" ? (
        <span>{String(value)}</span>
      ) : (
        <span>None</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (value) => (
      <StatusBadge
        label={String(value)}
        status={statusVariant(String(value))}
      />
    ),
  },
  {
    key: "url",
    header: "URL",
    render: (value) =>
      value && value !== "" ? (
        <a href={String(value)} target="_blank" rel="noreferrer">
          {String(value)}
        </a>
      ) : (
        <span>None</span>
      ),
  },
];

export function CharterTab({ context }: PluginDetailTabProps) {
  const { projectId } = context;

  const params = { projectId: projectId ?? "" };

  const charterResult = usePluginData<CharterApiResponse>("get-charter", params);
  const targetsResult = usePluginData<CharterApiResponse>(
    "get-deploy-targets",
    params,
  );

  if (!projectId) {
    return (
      <section>
        <p role="alert">No project in context.</p>
      </section>
    );
  }

  const loading = charterResult.loading || targetsResult.loading;
  const error = charterResult.error ?? targetsResult.error;

  if (loading) {
    return <Spinner label="Loading charter..." />;
  }

  if (error) {
    return (
      <section>
        <p role="alert">Failed to load charter data: {error.message}</p>
      </section>
    );
  }

  const charter: Charter | null = charterResult.data?.charter ?? null;
  const targets: DeployTarget[] = targetsResult.data?.deploy_targets ?? [];

  const pairs: KeyValuePair[] = charter
    ? [
        { label: "Goal", value: charter.goal ?? "Not set" },
        { label: "Owner", value: charter.owner ?? "Not set" },
        {
          label: "Repo",
          value: charter.repo_url ? (
            <a href={charter.repo_url} target="_blank" rel="noreferrer">
              {charter.repo_url}
            </a>
          ) : (
            "Not set"
          ),
        },
        {
          label: "Workspace",
          value: charter.workspace_url ? (
            <a href={charter.workspace_url} target="_blank" rel="noreferrer">
              {charter.workspace_url}
            </a>
          ) : (
            "Not set"
          ),
        },
        {
          label: "Archetype",
          value: charter.deploy_archetype ?? "Not set",
        },
        {
          label: "Ladder",
          value:
            Array.isArray(charter.env_ladder) && charter.env_ladder.length > 0
              ? charter.env_ladder.map(String).join(" > ")
              : "Not set",
        },
      ]
    : [];

  const rows: Record<string, unknown>[] = targets.map((t) => {
    const { provider, hostOrWorker } = substrateDisplay(t.substrate);
    return {
      id: t.id,
      stage: t.stage,
      provider,
      hostOrWorker,
      web: t.substrate.web ?? "",
      ssh: t.substrate.ssh ?? "",
      consul: t.substrate.consul_service ?? "",
      status: t.status,
      url: t.url ?? "",
    };
  });

  return (
    <article>
      <section aria-labelledby="charter-summary-heading">
        <h2 id="charter-summary-heading">Charter</h2>
        {charter ? (
          <KeyValueList pairs={pairs} />
        ) : (
          <p>No charter data found for this project.</p>
        )}
      </section>
      <section aria-labelledby="deploy-targets-heading">
        <h2 id="deploy-targets-heading">Deploy Targets</h2>
        <DataTable
          columns={columns}
          rows={rows}
          emptyMessage="No deploy targets declared."
        />
      </section>
      {charter && (
        <section aria-labelledby="execution-runtime-heading">
          <h2 id="execution-runtime-heading">Execution runtime</h2>
          <p>References the board execution workspace as the source of truth.</p>
          <KeyValueList
            pairs={[
              {
                label: "Provider",
                value: charter.execution_provider ?? "None",
              },
              {
                label: "Environment",
                value: charter.execution_env ?? "None",
              },
              {
                label: "Runtime ref",
                value: charter.execution_ref
                  ? charter.execution_ref.startsWith("http")
                    ? (
                      <a
                        href={charter.execution_ref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {charter.execution_ref}
                      </a>
                    )
                    : charter.execution_ref
                  : "None",
              },
            ]}
          />
        </section>
      )}
    </article>
  );
}
