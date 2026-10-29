import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

// Guard the stylesheet ownership/import convention without snapshotting visual values.
const source = path.resolve("src");
const layout = fs.readFileSync(path.join(source, "app/layout.tsx"), "utf8");
const entries = [...layout.matchAll(/import\s+["'](@\/[^"']+\.css)["']/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  entries,
  ["@/styles/globals.css", "@/styles/application.css"],
  "Load base CSS before the single application stylesheet entry point.",
);

const visited = new Set();
const selectorOwners = new Map();
const animationOwners = new Map();
function register(owners, key, file) {
  assert(
    !owners.has(key) || owners.get(key) === file,
    `${key} has multiple owners: ${owners.get(key)}, ${file}`,
  );
  owners.set(key, file);
}
function visit(file) {
  const relative = path.relative(source, file);
  assert(
    !relative.startsWith("..") && !path.isAbsolute(relative),
    "CSS imports must stay inside src.",
  );
  assert(!visited.has(file), `${relative} is imported more than once.`);
  visited.add(file);
  const root = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
  root.walkAtRules("import", (rule) => {
    assert(
      ["styles/globals.css", "styles/application.css"].includes(relative),
      `Keep feature imports in application.css, not ${relative}.`,
    );
    const match = /^(["'])(\.[^"']+\.css)\1$/.exec(rule.params);
    assert(match, `Use a local relative CSS import in ${relative}.`);
    visit(path.resolve(path.dirname(file), match[2]));
  });
  root.walkAtRules(/keyframes$/, (rule) =>
    register(animationOwners, rule.params, relative),
  );
  root.walkRules((rule) => {
    for (const selector of rule.selectors) {
      if (!selector.includes(".margin-")) continue;
      register(selectorOwners, selector.replace(/\s+/g, " ").trim(), relative);
    }
  });
}
for (const entry of entries) visit(path.join(source, entry.slice(2)));
function checkReachable(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.name === "generated") continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) checkReachable(file);
    else if (item.name.endsWith(".css"))
      assert(
        visited.has(file),
        `${path.relative(source, file)} is not imported by a stylesheet entry point.`,
      );
  }
}
checkReachable(source);
console.log(
  `Styles checked: ${visited.size} reachable files; ${selectorOwners.size} selectors with one owner.`,
);
