const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const pty = require("node-pty");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");

let mainWindow = null;
let ptyProcess = null;

// Optional workarounds for environments with HTTPS interception or GPU issues.
if (process.env.ALLOW_INSECURE_CERTS === "1") {
  app.commandLine.appendSwitch("ignore-certificate-errors");
}
if (process.env.DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#111113",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startPty() {
  if (process.platform !== "win32") {
    return;
  }

  const wslDistro = process.env.WSL_DISTRO;
  const shell = "wsl.exe";
  const args = wslDistro ? ["-d", wslDistro, "-e", "bash", "-l"] : ["-e", "bash", "-l"];

  ptyProcess = pty.spawn(shell, args, {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: process.env.USERPROFILE || "C:\\",
    env: {
      ...process.env,
      TERM: "xterm-256color"
    }
  });

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("terminal:data", data);
    }
  });

  ptyProcess.onExit(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("terminal:data", "\r\n[WSL exited]\r\n");
    }
  });
}

ipcMain.on("terminal:write", (_event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on("terminal:resize", (_event, size) => {
  if (ptyProcess && size && size.cols && size.rows) {
    ptyProcess.resize(size.cols, size.rows);
  }
});

ipcMain.on("improve:start", (event, payload) => {
  const iterations = Number(payload?.iterations || 5);
  const repoWinPath = app.getAppPath();
  const repoWslPath = toWslPath(repoWinPath);
  const scriptPath = path.join(repoWinPath, "scripts", "improve.sh");

  if (!fs.existsSync(scriptPath)) {
    event.sender.send("improve:done", "Missing scripts/improve.sh");
    return;
  }

  const token = process.env.GITHUB_TOKEN || "";
  if (!token) {
    event.sender.send("improve:done", "Missing GITHUB_TOKEN env var.");
    return;
  }

  const cmd = [
    `REPO_PATH=${escapeShell(repoWslPath)}`,
    `GITHUB_TOKEN=${escapeShell(token)}`,
    `GITHUB_REPO=${escapeShell("mordechimenaker-create/codex-ai-exe")}`,
    `MAX_ITERATIONS=${iterations}`,
    "AUTO_MERGE=1",
    `bash ${escapeShell(toWslPath(scriptPath))}`
  ].join(" ");

  const child = spawn("wsl.exe", ["-e", "bash", "-lc", cmd], { env: process.env });

  child.stdout.on("data", (data) => {
    event.sender.send("improve:log", data.toString());
  });

  child.stderr.on("data", (data) => {
    event.sender.send("improve:log", data.toString());
  });

  child.on("close", (code) => {
    event.sender.send("improve:done", `Improve loop finished with code ${code}`);
  });
});

ipcMain.on("ai:prompt", (event, payload) => {
  const prompt = (payload && payload.prompt) || "";
  const id = (payload && payload.id) || "";
  if (!prompt.trim()) {
    event.sender.send("ai:done", { id, error: "Prompt is empty" });
    return;
  }

  const history = (payload && payload.history) || "";
  streamCodex(prompt, history, (chunk) => {
    event.sender.send("ai:chunk", { id, chunk });
  }).then(
    (text) => event.sender.send("ai:done", { id, text }),
    (error) => event.sender.send("ai:done", { id, error })
  );
});

function bashEscape(value) {
  const str = String(value);
  return `'${str.replace(/'/g, `'\"'\"'`)}'`;
}

function buildCodexCommand(prompt, history) {
  const install = "command -v codex >/dev/null 2>&1 || npm install -g @openai/codex";
  const systemHint = [
    "You are a terminal command generator.",
    "Return ONLY the command(s) to run, no explanations.",
    "If admin is needed, include sudo.",
    "If you are unsure, still return the safest command you can.",
    "Do not use code fences."
  ].join(" ");
  const historyBlock = history ? `Conversation so far:\n${history}\n` : "";
  const combined = bashEscape(`${systemHint}\n${historyBlock}User request: ${prompt}`);
  const exec = `codex exec --skip-git-repo-check ${combined}`;
  return `${install} && ${exec}`;
}

function toWslPath(winPath) {
  if (!winPath) {
    return "";
  }
  const normalized = winPath.replace(/\//g, "\\");
  if (normalized.startsWith("\\\\")) {
    return "";
  }
  const match = normalized.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) {
    return "";
  }
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

function escapeShell(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function streamCodex(prompt, history, onChunk) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      reject("Codex CLI via WSL is supported on Windows only.");
      return;
    }

    const wslDistro = process.env.WSL_DISTRO;
    const cmd = buildCodexCommand(prompt, history);
    const args = wslDistro
      ? ["-d", wslDistro, "-e", "bash", "-lc", cmd]
      : ["-e", "bash", "-lc", cmd];

    const child = spawn("wsl.exe", args, {
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (onChunk) {
        onChunk(chunk);
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(`WSL error: ${err.message}`);
    });

    child.on("close", (code) => {
      const output = stdout.trim();
      const errorOut = stderr.trim();
      if (code !== 0 && !output) {
        reject(errorOut || `codex exec exited with code ${code}`);
        return;
      }
      resolve(output || errorOut || "(no output)");
    });
  });
}

function warnIfUnc() {
  const appPath = app.getAppPath();
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (appPath.startsWith("\\\\") || appPath.includes("\\\\wsl$\\")) {
    mainWindow.webContents.send(
      "app:warning",
      "App is running from a UNC/WSL path. For stability, run from C:\\\\codex-ai-exe."
    );
  }
}

function sendWslStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  let status = "WSL: Unknown";
  try {
    const distro = process.env.WSL_DISTRO;
    status = distro ? `WSL: ${distro}` : "WSL: Available";
  } catch (_err) {
    status = "WSL: Unknown";
  }
  mainWindow.webContents.send("app:warning", status);
  mainWindow.webContents.send("app:status", status);
}

function setupAutoUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("app:warning", "Checking for updates...");
  });
  autoUpdater.on("update-available", () => {
    mainWindow?.webContents.send("app:warning", "Update available. Downloading...");
  });
  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("app:warning", "No updates available.");
  });
  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("app:warning", `Update error: ${err?.message || err}`);
  });
  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("app:warning", "Update downloaded. Restarting...");
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  createWindow();
  startPty();
  warnIfUnc();
  sendWslStatus();
  setupAutoUpdates();
  autoUpdater.checkForUpdatesAndNotify();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      startPty();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
