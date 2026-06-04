import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli/cli.ts"],
    format: ["esm"],
    target: "node20",
    dts: true,
    clean: true,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/mcp/server.ts"],
    format: ["esm"],
    target: "node20",
    dts: false,
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);