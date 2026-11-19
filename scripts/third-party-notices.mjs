// Collect license texts from the exact installed frontend packages and the
// registry sources present on the Windows build runner. No network requests.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const sections = [
  "FROSTMARK — THIRD-PARTY SOFTWARE NOTICES\n\nThe following packages retain their original licenses and copyrights.\nSome build-only/transitive dependencies may be listed in addition to code included in the executable.\n",
];
const divider = "\n" + "=".repeat(78) + "\n";
async function licenseTexts(directory) {
  const names = await readdir(directory).catch(() => []);
  const licenseNames = names.filter((n) =>
    /^(licen[sc]e|copying|notice)([.\-_]|$)/i.test(n),
  );
  const texts = [];
  for (const name of licenseNames) {
    try {
      texts.push(
        `${name}\n${await readFile(path.join(directory, name), "utf8")}`,
      );
    } catch {}
  }
  return texts.join("\n\n");
}
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
for (const [relative, pkg] of Object.entries(lock.packages || {})) {
  if (!relative || pkg.dev) continue;
  const directory = path.resolve(relative);
  const info = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  const text = await licenseTexts(directory);
  sections.push(
    `${info.name} ${info.version} (npm)\nLicense: ${typeof info.license === "string" ? info.license : JSON.stringify(info.license || "See package source")}\n${text || "License text is included in the package source: https://www.npmjs.com/package/" + info.name + "/v/" + info.version}`,
  );
}
const registry = path.join(
  process.env.CARGO_HOME || path.join(os.homedir(), ".cargo"),
  "registry",
  "src",
);
for (const index of await readdir(registry).catch(() => [])) {
  for (const folder of await readdir(path.join(registry, index)).catch(
    () => [],
  )) {
    const directory = path.join(registry, index, folder);
    const toml = await readFile(
      path.join(directory, "Cargo.toml"),
      "utf8",
    ).catch(() => "");
    const license =
      /^license\s*=\s*"([^"]+)"/m.exec(toml)?.[1] || "See package source";
    const text = await licenseTexts(directory);
    sections.push(
      `${folder} (Rust crate)\nLicense: ${license}\n${text || "See original crate source and license metadata at https://crates.io/crates/" + folder.replace(/-\d.*$/, "")}`,
    );
  }
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/THIRD-PARTY-NOTICES.txt",
  sections.join(divider),
  "utf8",
);
console.log(`Collected ${sections.length - 1} dependency notice sections.`);
