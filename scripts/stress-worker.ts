import { readFileSync } from "node:fs";
import { withFileLock } from "../src/core/lock.js";
import { writeFileAtomic } from "../src/core/atomic-write.js";

const [projectDir, fileIndexStr, workerIdStr, iterationsStr] = process.argv.slice(2);
const fileIndex = Number(fileIndexStr);
const workerId = Number(workerIdStr);
const iterations = Number(iterationsStr);

const filePath = `${projectDir}/wiki/test-page-${fileIndex}.md`;

for (let i = 0; i < iterations; i++) {
  withFileLock(filePath, () => {
    const existing = readFileSync(filePath, "utf-8");
    const line = `worker-${workerId}-iter-${i}\n`;
    writeFileAtomic(filePath, existing + line);
  });
}

process.exit(0);
