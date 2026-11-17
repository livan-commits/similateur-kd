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
    builds: [{ name: "Lame", details: "Build local" }],
    mapNotes: [{ id: "local-note", region: "central", title: "Grotte" }],
    mapRegion: "central"
  },
  {
    quests: [{ name: "Explore Qinghe", done: true }, { name: "Finish tutorial", done: true }],
    checks: { Coffres: true, Secrets: true },
    journal: [{ date: "17/11/2026", note: "Premier voyage" }, { date: "16/11/2026", note: "Ancienne note" }],
    builds: [{ name: "Lame", details: "Build local" }, { name: "Arc", details: "Build distant" }],
    mapNotes: [{ id: "remote-note", region: "hexi", title: "Ruines" }],
    mapRegion: "hexi"
  }
);

const quest = name => merged.quests.find(item => item.name === name);
assert.equal(quest("Explore Qinghe").done, false, "local unchecked state must not be forced back to true");
assert.equal(quest("Finish tutorial").done, true, "remote-only quests must be preserved");
assert.equal(merged.checks.Coffres, false, "local unchecked discovery must override remote checked state");
assert.equal(merged.checks.Secrets, true, "remote-only discoveries must be preserved");
assert.equal(merged.journal.length, 2, "duplicate journal entries must be collapsed");
assert.equal(merged.builds.length, 2, "remote-only builds must be preserved");
assert.equal(merged.mapNotes.length, 2, "personal map notes from both devices must be preserved");
assert.equal(merged.mapRegion, "central", "the current device region must be retained");

const conflictMerged=window.wwmMergeData(
  {checks:{Coffres:false},checkUpdatedAt:{Coffres:"2026-11-17T12:00:00.000Z"},mapNotes:[],deletedMapNoteIds:["deleted-note"],quests:[{name:"Quest",done:false,updatedAt:"2026-11-17T12:00:00.000Z"}]},
  {checks:{Coffres:true},checkUpdatedAt:{Coffres:"2026-11-17T11:00:00.000Z"},mapNotes:[{id:"deleted-note",title:"Should stay deleted"},{id:"live-note",title:"Keep me"}],deletedMapNoteIds:[],quests:[{name:"Quest",done:true,updatedAt:"2026-11-17T11:00:00.000Z"}]}
);
assert.equal(conflictMerged.checks.Coffres,false,"the newest timestamp must win for discovery checkboxes");
assert.equal(conflictMerged.quests[0].done,false,"the newest timestamp must win for quest completion");
assert.deepEqual(Array.from(conflictMerged.mapNotes, n=>n.id),["live-note"],"deleted map notes must not be resurrected");
assert.deepEqual(Array.from(conflictMerged.deletedMapNoteIds),["deleted-note"],"map note tombstones must survive merging");


const schema = fs.readFileSync("where-winds-meet-companion/supabase/schema.sql", "utf8");
assert.ok(schema.includes("create or replace function public.save_companion_state"), "SQL must define the revision-checked save function");
assert.ok(schema.includes("security definer"), "the RPC must own the narrowly scoped write path");
assert.ok(schema.includes("grant select on table public.companion_state to authenticated"), "authenticated clients must only read the table directly");
assert.ok(!schema.includes("grant select, insert, update, delete on table public.companion_state to authenticated"), "authenticated clients must not bypass the revision-checked RPC");
assert.ok(schema.includes("where current_state.user_id = auth.uid()"), "the privileged RPC must restrict writes to the authenticated user");
assert.ok(schema.includes("as $function$") && schema.includes("$function$;"), "the SQL function body must use a valid dollar-quoted block");
assert.ok(schema.includes("current_state.revision = p_expected_revision"), "updates must compare the expected revision atomically");
assert.ok(schema.includes("on conflict (user_id) do nothing"), "first writes must not overwrite a row created concurrently");
assert.ok(schema.includes("grant execute on function public.save_companion_state(bigint, integer, jsonb) to authenticated"), "only authenticated users receive execute permission");
assert.ok(source.includes('client.rpc("save_companion_state"'), "the browser client must use the atomic SQL function");
assert.equal(source.includes(".upsert("), false, "cloud snapshots must not use unconditional upserts");

const serviceWorker = fs.readFileSync("where-winds-meet-companion/service-worker.js", "utf8");
assert.ok(serviceWorker.includes('const CACHE="wwm-companion-v9"'), "offline cache must be versioned after sync client changes");

const manifest = JSON.parse(fs.readFileSync("where-winds-meet-companion/manifest.webmanifest", "utf8"));
assert.ok(manifest.icons.some(icon => icon.src === "./icon.svg" && icon.type === "image/svg+xml"), "PWA manifest must declare the companion icon");
assert.ok(serviceWorker.includes('"./icon.svg"'), "offline cache must include the PWA icon");
assert.ok(fs.existsSync("where-winds-meet-companion/icon.svg"), "PWA icon asset must exist");

const appSource = fs.readFileSync("where-winds-meet-companion/app.js", "utf8");
assert.ok(appSource.includes('q.elements.namedItem("name").value'), "quest creation must read the named input explicitly");
assert.ok(appSource.includes('b.elements.namedItem("name").value'), "build creation must avoid form property name collisions");
assert.ok(appSource.includes('b.elements.namedItem("details").value'), "build details must be read from the named textarea");
assert.equal(appSource.includes("q.name.value"), false, "quest form must not rely on ambiguous named access");
assert.equal(appSource.includes("b.name.value"), false, "build form must not rely on ambiguous named access");
const bossBlock = appSource.split("const bossData=[")[1].split("];")[0];
assert.equal((bossBlock.match(/\{name:/g)||[]).length, 31, "boss catalogue must contain exactly 31 world-boss records");
assert.ok(appSource.includes("31 boss mondiaux"), "boss catalogue must state the world-boss count separately");
assert.ok(appSource.includes("Xiao Han"), "Hutuo campaign boss must be documented separately from world bosses");
assert.ok(appSource.includes("wherewindsmeet.org/guides/hutuo"), "Hutuo roster source must be linked from the boss view");
assert.ok(appSource.includes("wherewindsmeetgame.org/guides/where-winds-meet-bosses"), "boss roster source must be linked from the boss view");
assert.ok(appSource.includes("Conseil de combat sourcé"), "boss cards must expose sourced combat guidance");
assert.ok(appSource.includes("allthings.how/how-to-beat-puppeteer-sheng-wu"), "Sheng Wu strategy source must be linked");
assert.ok(appSource.includes("gamemarket.gg/news/where-winds-meet/where-winds-meet-bosses"), "Hutuo boss strategy source must be linked");
assert.ok(appSource.includes("Aperçu pré-lancement Hutuo"), "Hutuo combat advice must be labelled as pre-launch guidance pending in-game confirmation");
assert.ok(appSource.includes("Ces consignes concernent cette épreuve d’équipe, pas nécessairement le boss en monde ouvert"), "trial-only mechanics must not be presented as open-world mechanics");
assert.ok(appSource.includes("dont les mécaniques diffèrent du boss mondial"), "Centipede trial mechanics must be clearly scoped");
assert.ok(appSource.includes("lettre de développeurs du 19 septembre"), "Taicu and Goshawk tactics must retain their developer-letter provenance");
assert.ok(appSource.includes("lettre de développeurs du 21 août"), "Inkpincer Scorpion and Cloudclutch Serpent tactics must retain their developer-letter provenance");
assert.ok(appSource.includes("Compétence mystique Contortion"), "Hidden Mountain boss preparation must mention Contortion where required");
assert.ok(appSource.includes("boss-strategy"), "sourced strategy details must render in expandable boss-card sections");


console.log("Account sync merge tests passed.");
