import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";

type Cmd = (args: string[]) => Promise<number> | number;

const help = `
thynkai (toolkits)

Usage:
  thynkai <command> [subcommand] [options]

Commands:
  init model         Scaffold a model entry (for thynkai-models)
  validate models    Validate a models registry tree
  digest             Compute sha256 digest for a local file
  publish            Print a dry-run summary of changed files

Examples:
  thynkai init model --modality text --slug my-model --id thynkai/my-model
  thynkai validate models --root .
  thynkai digest --file ./artifact.bin
  thynkai publish --root . --since HEAD~1
`;

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function argValue(args: string[], name: string, fallback?: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1] ?? fallback;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function write(path: string, content: string) {
  ensureDir(dirname(path));
  writeFileSync(path, content, { encoding: "utf8" });
}

function isIsoDate(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function parseJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`invalid_json: ${path}`);
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function cmdInitModel(args: string[]): Promise<number> {
  const modality = argValue(args, "--modality");
  const slug = argValue(args, "--slug");
  const id = argValue(args, "--id");
  const name = argValue(args, "--name", slug ? slug : "New Model");
  const owner = argValue(args, "--owner", "contrib:unknown");
  const ownerName = argValue(args, "--owner-name", "Unknown");
  const version = argValue(args, "--version", "0.1.0");

  if (!modality || !["text","vision","multimodal"].includes(modality)) {
    die("init model: --modality must be one of text|vision|multimodal");
  }
  if (!slug) die("init model: --slug is required");
  if (!id) die("init model: --id is required (recommended org/name)");
  if (!version || !SEMVER_RE.test(version)) die("init model: --version must be SemVer");

  const root = argValue(args, "--root", ".");
  const base = join(root, "models", modality, slug);

  const createdAt = new Date().toISOString();
  const releasedAt = createdAt;

  const modelJson = {
    id,
    name,
    modality,
    description: "TODO: add description",
    owner: { contributorId: owner, displayName: ownerName },
    createdAt,
    version,
    tags: ["todo"],
    links: { repo: "TODO" }
  };

  const versionJson = {
    modelId: id,
    version,
    releasedAt,
    artifact: {
      uri: "TODO",
      digest: "sha256:" + "0".repeat(64),
      builtWith: { framework: "TODO", runtime: "TODO", notes: "TODO" }
    },
    benchmarks: []
  };

  write(join(base, "model.json"), JSON.stringify(modelJson, null, 2) + "\n");
  write(join(base, "versions", version + ".json"), JSON.stringify(versionJson, null, 2) + "\n");
  write(join(base, "PERFORMANCE.md"), `# Performance notes — ${id}

- Benchmark: TODO
- Date: ${createdAt.slice(0,10)}
- Environment: TODO
- Report: TODO

Notes:
- Keep it factual and reproducible.
`);

  console.log("Scaffolded:", base);
  return 0;
}

async function cmdValidateModels(args: string[]): Promise<number> {
  const root = argValue(args, "--root", ".");
  const modelsDir = join(root, "models");
  const files = walk(modelsDir);

  const modelFiles = files.filter((p) => p.endsWith("model.json"));
  const versionFiles = files.filter((p) => /versions[\\/]/.test(p) && p.endsWith(".json"));

  assert(modelFiles.length > 0, "no model.json entries found under models/");

  for (const mf of modelFiles) {
    const m = parseJson(mf);

    assert(typeof m.id === "string" && m.id.trim(), `model.id required: ${mf}`);
    assert(typeof m.name === "string" && m.name.trim(), `model.name required: ${mf}`);
    assert(["text","vision","multimodal"].includes(m.modality), `model.modality invalid: ${mf}`);
    assert(m.owner && typeof m.owner === "object", `model.owner required: ${mf}`);
    assert(typeof m.createdAt === "string" && isIsoDate(m.createdAt), `createdAt must be ISO date: ${mf}`);
    assert(typeof m.version === "string" && SEMVER_RE.test(m.version), `model.version must be SemVer: ${mf}`);

    const parts = mf.split(/\\|\//);
    const idx = parts.indexOf("models");
    const folderModality = idx >= 0 ? parts[idx + 1] : undefined;
    assert(folderModality === m.modality, `modality folder mismatch for ${m.id}`);

    const perfPath = mf.replace(/model\.json$/, "PERFORMANCE.md");
    try {
      const st = statSync(perfPath);
      assert(st.isFile(), `PERFORMANCE.md missing: ${perfPath}`);
    } catch {
      throw new Error(`PERFORMANCE.md missing: ${perfPath}`);
    }

    const versionsDir = mf.replace(/model\.json$/, "versions");
    const expectedFile = join(versionsDir, `${m.version}.json`).replace(/\\/g, "/");
    const matching = versionFiles
      .filter((vf) => vf.replace(/\\/g, "/").startsWith(versionsDir.replace(/\\/g, "/")))
      .map((vf) => vf.replace(/\\/g, "/"));

    assert(matching.length > 0, `no versions found for model ${m.id}`);
    assert(matching.includes(expectedFile), `missing versions/${m.version}.json for model ${m.id}`);

    for (const vf of matching) {
      const v = parseJson(vf);
      assert(v.modelId === m.id, `version.modelId mismatch: ${vf}`);
      assert(typeof v.version === "string" && SEMVER_RE.test(v.version), `version.version invalid: ${vf}`);
      const fileName = vf.split("/").pop();
      const versionFromFile = fileName?.replace(/\.json$/, "");
      assert(versionFromFile === v.version, `version filename mismatch: ${vf}`);

      if (v.artifact?.digest !== undefined) {
        assert(typeof v.artifact.digest === "string" && SHA256_RE.test(v.artifact.digest), `artifact.digest invalid: ${vf}`);
      }
    }
  }

  console.log("OK: models registry validation passed.");
  return 0;
}

async function cmdDigest(args: string[]): Promise<number> {
  const file = argValue(args, "--file");
  if (!file) die("digest: --file is required");

  const buf = readFileSync(file);
  const hex = createHash("sha256").update(buf).digest("hex");
  const out = `sha256:${hex}`;

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify({ file, digest: out }, null, 2));
  } else {
    console.log(out);
  }
  return 0;
}

async function cmdPublish(args: string[]): Promise<number> {
  // intentionally "dry-run" only: show changed files under root
  const root = argValue(args, "--root", ".");
  const since = argValue(args, "--since"); // optional: git ref
  const jsonOut = hasFlag(args, "--json");

  // This command avoids hard dependency on git libs; it relies on 'git' if present.
  // If git isn't available, it falls back to listing all files.
  let changed: string[] = [];

  try {
    const { execSync } = await import("node:child_process");
    const cmd = since
      ? `git diff --name-only ${since} -- ${root}`
      : `git status --porcelain ${root}`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
    if (since) {
      changed = out ? out.split(/\r?\n/).filter(Boolean) : [];
    } else {
      changed = out
        ? out
            .split(/\r?\n/)
            .map((l) => l.slice(3).trim())
            .filter(Boolean)
        : [];
    }
  } catch {
    // fallback: show all files (still a useful dry-run)
    changed = walk(root).map((p) => relative(".", p));
  }

  const summary = {
    root,
    since: since ?? null,
    changedFiles: changed.sort(),
    count: changed.length,
  };

  if (jsonOut) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Changed files (${summary.count}):`);
    for (const f of summary.changedFiles) console.log(" -", f);
  }

  console.log("\nNote: publish is dry-run only. Open a PR to submit changes.");
  return 0;
}

const commands = new Map<string, Cmd>([
  ["init:model", cmdInitModel],
  ["validate:models", cmdValidateModels],
  ["digest", cmdDigest],
  ["publish", cmdPublish],
]);

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(help);
    return;
  }

  const [c1, c2, ...rest] = args;

  const key =
    c1 === "init" && c2 === "model" ? "init:model" :
    c1 === "validate" && c2 === "models" ? "validate:models" :
    c1 === "digest" ? "digest" :
    c1 === "publish" ? "publish" :
    null;

  if (!key || !commands.has(key)) {
    console.error("Unknown command.");
    console.log(help);
    process.exit(1);
  }

  const cmd = commands.get(key)!;
  const exitCode = await cmd(rest);
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
