// Starts the FastAPI backend (../backend) for `npm run dev`. Prefers the backend's own virtualenv, falls back to
// whatever `python` is on PATH. The database seeds itself on first start.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(backend, "venv", "Scripts", "python.exe")
  : path.join(backend, "venv", "bin", "python");
const python = existsSync(venvPython) ? venvPython : isWindows ? "python" : "python3";

const child = spawn(python, ["-m", "uvicorn", "main:app", "--reload", "--port", process.env.API_PORT ?? "8000"], {
  cwd: backend,
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error(`Could not start the backend with "${python}": ${err.message}`);
  console.error("Set it up once:  cd backend && python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt");
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
