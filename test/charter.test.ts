import { describe, it, expect } from "vitest";
import { validateTarget } from "../src/types.js";

describe("validateTarget", () => {
  it("accepts a valid forkd target", () => {
    const result = validateTarget({
      stage: "dev",
      substrate: {
        provider: "forkd",
        host: "forkd.example.com",
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts a valid vm-host target", () => {
    const result = validateTarget({
      stage: "prod",
      substrate: {
        provider: "vm-host",
        host: "vm.example.com",
        deploy_method: "ssh",
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("accepts a valid cloudflare-worker (preview) target", () => {
    const result = validateTarget({
      stage: "preprod",
      substrate: {
        provider: "cloudflare-worker",
        worker_name: "my-worker",
        deployment: "preview",
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects an invalid stage ('qa')", () => {
    const result = validateTarget({
      stage: "qa",
      substrate: {
        provider: "forkd",
        host: "forkd.example.com",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid stage/);
    }
  });

  it("rejects an unknown provider", () => {
    const result = validateTarget({
      stage: "dev",
      substrate: {
        provider: "heroku",
        host: "app.heroku.com",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/substrate/);
    }
  });

  it("rejects a cloudflare-worker missing deployment", () => {
    const result = validateTarget({
      stage: "dev",
      substrate: {
        provider: "cloudflare-worker",
        worker_name: "my-worker",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/substrate/);
    }
  });
});
