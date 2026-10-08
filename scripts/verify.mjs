import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Persist the actual command outputs, including failures; never manufacture PASS.
const browserProjects = process.env.EQUINOX_CHROMIUM_EXECUTABLE
  ? ["chromium-mobile"]
  : ["chromium-mobile", "webkit-mobile"];
const commands = [
  ["run", "lint"],
  ["run", "typecheck"],
  ["run", "test:reference"],
  ["test"],
  ["run", "build"],
  [
    "run",
    "test:browser",
    "--",
    ...browserProjects.map((p) => `--project=${p}`),
  ],
];
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  browserProjects,
  physicalIPhone: "NOT TESTED",
  hostedDeployment: "NOT TESTED",
  steps: [],
};
await mkdir("validation", { recursive: true });
for (const args of commands) {
  const startedAt = new Date().toISOString();
  let output = "";
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn("npm", args, { env: process.env });
    const collect = (data) => {
      const s = data.toString();
      output += s;
      process.stdout.write(s);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", resolve);
  });
  report.steps.push({
    command: ["npm", ...args],
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    output,
  });
  await writeFile(
    "validation/release-checks.json",
    JSON.stringify(report, null, 2),
  );
  if (exitCode !== 0) {
    process.exitCode = exitCode ?? 1;
    break;
  }
}
