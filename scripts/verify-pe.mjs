// Inspect the executable without loading it. This catches accidental installer,
// wrong-architecture, console-subsystem, or dynamic VC++ runtime builds.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const file = process.argv[2] || "src-tauri/target/release/frostmark.exe";
const bytes = await readFile(file);
assert.equal(bytes.toString("ascii", 0, 2), "MZ");
const pe = bytes.readUInt32LE(0x3c);
assert.equal(bytes.toString("ascii", pe, pe + 4), "PE\0\0");
assert.equal(
  bytes.readUInt16LE(pe + 4),
  0x8664,
  "Expected Windows x64 machine type",
);
const optional = pe + 24;
assert.equal(bytes.readUInt16LE(optional), 0x20b, "Expected PE32+ executable");
assert.equal(
  bytes.readUInt16LE(optional + 68),
  2,
  "Expected GUI executable without console window",
);
const count = bytes.readUInt16LE(pe + 6);
const sectionStart = optional + bytes.readUInt16LE(pe + 20);
const sections = Array.from({ length: count }, (_, i) => {
  const s = sectionStart + i * 40;
  return {
    rva: bytes.readUInt32LE(s + 12),
    size: Math.max(bytes.readUInt32LE(s + 8), bytes.readUInt32LE(s + 16)),
    offset: bytes.readUInt32LE(s + 20),
  };
});
const offset = (rva) => {
  const s = sections.find((s) => rva >= s.rva && rva < s.rva + s.size);
  assert(s, `Unmapped RVA ${rva}`);
  return s.offset + rva - s.rva;
};
const imports = [];
const tableRva = bytes.readUInt32LE(optional + 112 + 8);
if (tableRva) {
  for (
    let entry = offset(tableRva);
    bytes.readUInt32LE(entry + 12);
    entry += 20
  ) {
    const start = offset(bytes.readUInt32LE(entry + 12));
    imports.push(bytes.toString("ascii", start, bytes.indexOf(0, start)));
  }
}
assert(
  !imports.some((d) => /^(vcruntime|msvcp|webview2loader)/i.test(d)),
  `Nonportable direct dependency: ${imports.join(", ")}`,
);
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/executable-report.json",
  JSON.stringify(
    {
      file,
      architecture: "Windows x64",
      subsystem: "GUI",
      bytes: bytes.length,
      imports,
      staticRuntimeCheck: true,
    },
    null,
    2,
  ),
);
console.log(
  `Verified x64 GUI portable executable (${bytes.length} bytes); no direct VC++ runtime or WebView2Loader DLL dependency.`,
);
