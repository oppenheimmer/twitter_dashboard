import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import {
  checkNodeModulesExist,
  checkNodeModulesStale,
  checkKeyPackages,
  checkNextVersionMatch,
  checkNextBuildIntegrity,
  runAllChecks,
  requiredFixes,
  type CheckResult,
} from "../preflight";

vi.mock("fs");

const mockedFs = vi.mocked(fs);

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// checkNodeModulesExist
// ---------------------------------------------------------------------------
describe("checkNodeModulesExist", () => {
  it("returns error when node_modules is missing", () => {
    mockedFs.existsSync.mockReturnValue(false);
    const r = checkNodeModulesExist();
    expect(r.status).toBe("error");
    expect(r.fix).toBe("npm-install");
  });

  it("returns ok when node_modules exists", () => {
    mockedFs.existsSync.mockReturnValue(true);
    const r = checkNodeModulesExist();
    expect(r.status).toBe("ok");
    expect(r.fix).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// checkNodeModulesStale
// ---------------------------------------------------------------------------
describe("checkNodeModulesStale", () => {
  it("returns error when node_modules/.package-lock.json is missing", () => {
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      if (String(p).endsWith(".package-lock.json")) return false;
      return true;
    });
    const r = checkNodeModulesStale();
    expect(r.status).toBe("error");
    expect(r.fix).toBe("npm-install");
  });

  it("returns warn when package.json is newer than node_modules", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockImplementation((p: fs.PathLike) => {
      const s = String(p);
      if (s.endsWith(".package-lock.json"))
        return { mtimeMs: 1000 } as fs.Stats;
      if (s.endsWith("package.json") || s.endsWith("package-lock.json"))
        return { mtimeMs: 2000 } as fs.Stats;
      return { mtimeMs: 1000 } as fs.Stats;
    });
    const r = checkNodeModulesStale();
    expect(r.status).toBe("warn");
    expect(r.fix).toBe("npm-install");
  });

  it("returns ok when node_modules is up to date", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockImplementation((p: fs.PathLike) => {
      const s = String(p);
      if (s.endsWith(".package-lock.json"))
        return { mtimeMs: 3000 } as fs.Stats;
      if (s.endsWith("package.json") || s.endsWith("package-lock.json"))
        return { mtimeMs: 1000 } as fs.Stats;
      return { mtimeMs: 1000 } as fs.Stats;
    });
    const r = checkNodeModulesStale();
    expect(r.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// checkKeyPackages
// ---------------------------------------------------------------------------
describe("checkKeyPackages", () => {
  it("returns error when a critical package is missing", () => {
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      // react-dom missing
      if (String(p).includes("react-dom")) return false;
      return true;
    });
    const r = checkKeyPackages();
    expect(r.status).toBe("error");
    expect(r.message).toContain("react-dom");
    expect(r.fix).toBe("npm-install");
  });

  it("returns ok when all critical packages exist", () => {
    mockedFs.existsSync.mockReturnValue(true);
    const r = checkKeyPackages();
    expect(r.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// checkNextVersionMatch
// ---------------------------------------------------------------------------
describe("checkNextVersionMatch", () => {
  it("returns ok when .next/package.json does not exist", () => {
    mockedFs.existsSync.mockReturnValue(false);
    const r = checkNextVersionMatch();
    expect(r.status).toBe("ok");
  });

  it("returns warn when .next version differs from installed version", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
      const s = String(p);
      if (s.includes(".next")) return JSON.stringify({ version: "14.0.0" });
      return JSON.stringify({ version: "16.1.6" });
    });
    const r = checkNextVersionMatch();
    expect(r.status).toBe("warn");
    expect(r.fix).toBe("delete-next");
    expect(r.message).toContain("14.0.0");
    expect(r.message).toContain("16.1.6");
  });

  it("returns ok when versions match", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ version: "16.1.6" }),
    );
    const r = checkNextVersionMatch();
    expect(r.status).toBe("ok");
  });

  it("returns warn when package.json is unparseable", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue("not json");
    const r = checkNextVersionMatch();
    expect(r.status).toBe("warn");
    expect(r.fix).toBe("delete-next");
  });
});

// ---------------------------------------------------------------------------
// checkNextBuildIntegrity
// ---------------------------------------------------------------------------
describe("checkNextBuildIntegrity", () => {
  it("returns ok when .next does not exist", () => {
    mockedFs.existsSync.mockReturnValue(false);
    const r = checkNextBuildIntegrity();
    expect(r.status).toBe("ok");
  });

  it("returns ok when .next contains only dev cache", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue(["dev", "cache"] as any);
    const r = checkNextBuildIntegrity();
    expect(r.status).toBe("ok");
  });

  it("returns warn when build output exists but build-manifest.json is missing", () => {
    // First existsSync for .next dir = true, second for build-manifest.json = false
    mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
      if (String(p).endsWith("build-manifest.json")) return false;
      return true;
    });
    mockedFs.readdirSync.mockReturnValue(["server", "static", "dev"] as any);
    const r = checkNextBuildIntegrity();
    expect(r.status).toBe("warn");
    expect(r.fix).toBe("delete-next");
  });

  it("returns warn when build-manifest.json is corrupt", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "server",
      "build-manifest.json",
    ] as any);
    mockedFs.readFileSync.mockReturnValue("not json at all");
    const r = checkNextBuildIntegrity();
    expect(r.status).toBe("warn");
    expect(r.fix).toBe("delete-next");
  });

  it("returns ok when build-manifest.json is valid", () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      "server",
      "build-manifest.json",
    ] as any);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({ pages: {} }));
    const r = checkNextBuildIntegrity();
    expect(r.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// requiredFixes
// ---------------------------------------------------------------------------
describe("requiredFixes", () => {
  it("returns empty array when all checks pass", () => {
    const results: CheckResult[] = [
      { name: "a", status: "ok", message: "fine" },
      { name: "b", status: "ok", message: "fine" },
    ];
    expect(requiredFixes(results)).toEqual([]);
  });

  it("deduplicates and orders fixes: delete-next before npm-install", () => {
    const results: CheckResult[] = [
      { name: "a", status: "error", message: "bad", fix: "npm-install" },
      { name: "b", status: "warn", message: "bad", fix: "delete-next" },
      { name: "c", status: "warn", message: "bad", fix: "npm-install" },
    ];
    const fixes = requiredFixes(results);
    expect(fixes).toEqual(["delete-next", "npm-install"]);
  });

  it("returns only npm-install when no next issues", () => {
    const results: CheckResult[] = [
      { name: "a", status: "error", message: "bad", fix: "npm-install" },
    ];
    expect(requiredFixes(results)).toEqual(["npm-install"]);
  });
});

// ---------------------------------------------------------------------------
// runAllChecks (integration-style with mocked fs)
// ---------------------------------------------------------------------------
describe("runAllChecks", () => {
  it("skips deeper node_modules checks when node_modules is missing", () => {
    mockedFs.existsSync.mockReturnValue(false);
    const results = runAllChecks();
    const names = results.map((r) => r.name);
    expect(names).toContain("node_modules-exists");
    expect(names).not.toContain("node_modules-stale");
    expect(names).not.toContain("key-packages");
  });

  it("includes all checks when node_modules exists", () => {
    // Make everything healthy
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ mtimeMs: 5000 } as fs.Stats);
    mockedFs.readdirSync.mockReturnValue(["dev"] as any);
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ version: "16.1.6" }),
    );

    const results = runAllChecks();
    const names = results.map((r) => r.name);
    expect(names).toContain("node_modules-exists");
    expect(names).toContain("node_modules-stale");
    expect(names).toContain("key-packages");
    expect(names).toContain("next-version");
    expect(names).toContain("next-integrity");
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });
});
