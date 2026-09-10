import fs from "node:fs";

const path = "src/app.ts";
const source = fs.readFileSync(path, "utf8");
const from = 'version: "1.0.0"';
const to = 'version: "1.0.1"';
if (!source.includes(from)) throw new Error("OpenAPI 1.0.0 version marker not found");
fs.writeFileSync(path, source.replace(from, to));
