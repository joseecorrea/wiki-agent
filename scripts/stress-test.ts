import { fork } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WORKERS = 5;
const ITERATIONS = 50;
const FILES = 3;

function createTempProject(): string {
  const dir = join(__dirname, `stress-tmp-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, ".wiki-agent"), { recursive: true });
  mkdirSync(join(dir, "wiki"), { recursive: true });
  return dir;
}

function runWorker(projectDir: string, fileIndex: number, workerId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = fork(join(__dirname, "stress-worker.ts"), [projectDir, String(fileIndex), String(workerId), String(ITERATIONS)], {
      stdio: "pipe",
      execArgv: ["--import", "tsx"],
    });

    let stderr = "";
    child.stderr?.on("data", (d) => { stderr += d; });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker ${workerId} exited with ${code}. stderr: ${stderr}`));
      }
    });
  });
}

async function main() {
  const projectDir = createTempProject();
  console.log(`Stress test project: ${projectDir}`);

  // Create target files
  for (let f = 0; f < FILES; f++) {
    const filePath = join(projectDir, `wiki`, `test-page-${f}.md`);
    // pre-create with initial content so findProjectDir works
    const content = `# Initial ${f}\n`;
    // Use direct write for setup (bypass lock to avoid needing project structure during setup)
    // But our writeText needs projectDir detection... so we use atomic-write directly
    const { writeFileAtomic } = await import("../src/core/atomic-write.ts");
    writeFileAtomic(filePath, content);
  }

  const promises: Promise<void>[] = [];
  for (let f = 0; f < FILES; f++) {
    for (let w = 0; w < WORKERS; w++) {
      promises.push(runWorker(projectDir, f, w));
    }
  }

  const start = Date.now();
  await Promise.all(promises);
  const elapsed = Date.now() - start;

  // Verify integrity
  let errors = 0;
  for (let f = 0; f < FILES; f++) {
    const filePath = join(projectDir, `wiki`, `test-page-${f}.md`);
    const content = readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");

    // Expect: initial line + WORKERS * ITERATIONS appended lines
    const expectedLines = 1 + WORKERS * ITERATIONS;
    if (lines.length !== expectedLines) {
      console.error(`File ${f}: expected ${expectedLines} lines, got ${lines.length}`);
      errors++;
    }

    // Verify no duplicate or malformed lines
    const seen = new Set<string>();
    for (const line of lines) {
      if (line.startsWith("# Initial")) continue;
      const match = line.match(/^worker-(\d+)-iter-(\d+)$/);
      if (!match) {
        console.error(`File ${f}: malformed line: "${line}"`);
        errors++;
        continue;
      }
      if (seen.has(line)) {
        console.error(`File ${f}: duplicate line: "${line}"`);
        errors++;
        continue;
      }
      seen.add(line);
    }

    if (seen.size !== WORKERS * ITERATIONS) {
      console.error(`File ${f}: expected ${WORKERS * ITERATIONS} unique worker lines, got ${seen.size}`);
      errors++;
    }
  }

  // Cleanup
  rmSync(projectDir, { recursive: true, force: true });

  if (errors === 0) {
    console.log(`\n✅ Stress test passed: ${WORKERS * FILES} workers, ${ITERATIONS} iterations each, ${elapsed}ms`);
    console.log(`   Throughput: ${((WORKERS * FILES * ITERATIONS) / (elapsed / 1000)).toFixed(0)} writes/sec`);
  } else {
    console.error(`\n❌ Stress test failed with ${errors} errors`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
