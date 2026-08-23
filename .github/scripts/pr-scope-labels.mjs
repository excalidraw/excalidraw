const title = process.env.PR_TITLE;
const match = title.match(/^[a-z]+(?:\(([^)]+)\))?!?:/i);
const scopes = match?.[1]?.split(",").map((scope) => scope.trim()) ?? [];
const labels = new Set();

for (const scope of scopes) {
  if (scope === "app") {
    labels.add("s-app");
  } else if (scope === "editor") {
    labels.add("s-editor");
  } else if (scope.startsWith("packages/")) {
    labels.add("s-package");
  }
}

process.stdout.write([...labels].join("\n"));
