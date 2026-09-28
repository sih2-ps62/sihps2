// Isolated test API. Never reads or seeds the working polarops.db.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const directory = mkdtempSync(path.join(tmpdir(), "polarops-browser-"));
const localPython = path.join(backend, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const child = spawn(existsSync(localPython) ? localPython : "python", ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"], {
  cwd: backend, stdio: "inherit", env: { ...process.env, POLAROPS_DB_URL: `sqlite:///${path.join(directory, "browser.db").replaceAll("\\", "/")}`,
    POLAROPS_SKIP_DOTENV: "1", POLAROPS_CORS_ORIGINS: "http://127.0.0.1:5184", POLAROPS_JWT_SECRET: "isolated-browser-test-secret-at-least-32-characters" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
