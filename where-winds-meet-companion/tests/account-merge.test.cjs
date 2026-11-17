const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("where-winds-meet-companion/account.js", "utf8");
const window = {};
vm.runInNewContext(source, { window, console, Promise });
assert.equal(typeof window.wwmMergeData, "function", "merge helper must be exposed for tests");

const merged = window.wwmMergeData(
  {
    quests: [{ name: "Explore Qinghe", done: false }, { name: "Find a hidden cave", done: true }],
    checks: { Coffres: false, Boss: true },
    journal: [{ date: "17/11/2026", note: "Premier voyage" }],
    builds: [{ name: "Lame", details: "Build local" }]
  },
  {
    quests: [{ name: "Explore Qinghe", done: true }, { name: "Finish tutorial", done: true }],
    checks: { Coffres: true, Secrets: true },
    journal: [{ date: "17/11/2026", note: "Premier voyage" }, { date: "16/11/2026", note: "Ancienne note" }],
    builds: [{ name: "Lame", details: "Build local" }, { name: "Arc", details: "Build distant" }]
  }
);

const quest = name => merged.quests.find(item => item.name === name);
assert.equal(quest("Explore Qinghe").done, false, "local unchecked state must not be forced back to true");
assert.equal(quest("Finish tutorial").done, true, "remote-only quests must be preserved");
assert.equal(merged.checks.Coffres, false, "local unchecked discovery must override remote checked state");
assert.equal(merged.checks.Secrets, true, "remote-only discoveries must be preserved");
assert.equal(merged.journal.length, 2, "duplicate journal entries must be collapsed");
assert.equal(merged.builds.length, 2, "remote-only builds must be preserved");
console.log("Account sync merge tests passed.");
