const termEl = document.getElementById("terminal");
const terminalPanel = document.getElementById("terminalPanel");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clearChat");
const statusLine = document.getElementById("statusLine");
const statusMeta = document.getElementById("statusMeta");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const cmdHistoryEl = document.getElementById("cmdHistory");
const chatEmpty = document.getElementById("chatEmpty");
const historyEmpty = document.getElementById("historyEmpty");
const scrollToLatest = document.getElementById("scrollToLatest");
const toggleTheme = document.getElementById("toggleTheme");
const toggleDensity = document.getElementById("toggleDensity");
const jumpTerminal = document.getElementById("jumpTerminal");
const startImprove = document.getElementById("startImprove");
const toggleRtl = document.getElementById("toggleRtl");
const fontDown = document.getElementById("fontDown");
const fontUp = document.getElementById("fontUp");
const healthCheck = document.getElementById("healthCheck");
const dangerModal = document.getElementById("dangerModal");
const dangerText = document.getElementById("dangerText");
const dangerAllow = document.getElementById("dangerAllow");
const dangerDecline = document.getElementById("dangerDecline");
const quickButtons = document.querySelectorAll(".quick-actions .quick");
const consentModal = document.getElementById("consentModal");
const consentAllow = document.getElementById("consentAllow");
const consentDecline = document.getElementById("consentDecline");

const terminal = new window.Terminal({
  cursorBlink: true,
  scrollback: 5000,
  fontFamily: "JetBrains Mono, Consolas, 'Fira Code', monospace",
  fontSize: 13,
  theme: {
    background: "#0c0d10",
    foreground: "#d7dbe0",
    cursor: "#d7dbe0"
  }
});

const FitAddonClass = (window.FitAddon && window.FitAddon.FitAddon) || window.FitAddon;
const fitAddon = new FitAddonClass();
terminal.loadAddon(fitAddon);
terminal.open(termEl);
fitAddon.fit();
window.api.terminalResize(terminal.cols, terminal.rows);

terminal.onData((data) => {
  window.api.terminalWrite(data);
});

terminal.attachCustomKeyEventHandler((event) => {
  if (!event.shiftKey) {
    return false;
  }
  if (event.key === "PageUp") {
    terminal.scrollPages(-1);
    return true;
  }
  if (event.key === "PageDown") {
    terminal.scrollPages(1);
    return true;
  }
  return false;
});

window.api.onTerminalData((data) => {
  terminal.write(data);
  if (/error|failed|permission denied/i.test(data)) {
    const header = document.querySelector(".terminal-header");
    if (header) {
      header.classList.add("error");
    }
  }
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
  resizeTimer = setTimeout(() => {
    fitAddon.fit();
    window.api.terminalResize(terminal.cols, terminal.rows);
  }, 120);
});

function appendMessage(role, text, status) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = role === "user" ? "You" : "AI";
  if (status) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = status;
    label.appendChild(badge);
  }

  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(body);
  chatEl.appendChild(wrapper);
  if (shouldAutoScroll()) {
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  updateEmptyStates();
  updateScrollButton();
  return wrapper;
}

function setStatus(text) {
  if (!statusLine) {
    return;
  }
  const normalized = String(text || "").toLowerCase();
  let state = "ok";
  if (normalized.includes("שגיאה") || normalized.includes("error")) {
    state = "error";
  } else if (normalized.includes("חושב") || normalized.includes("running") || normalized.includes("מתחיל")) {
    state = "busy";
  }
  statusLine.setAttribute("data-state", state);
  if (statusText) {
    statusText.textContent = text;
  } else {
    statusLine.textContent = text;
  }
}

function setMeta(text) {
  if (statusMeta) {
    statusMeta.textContent = text;
  }
}

const FONT_MIN = 12;
const FONT_MAX = 20;
const FONT_STEP = 1;

function applyFontSize(size) {
  const app = document.querySelector(".app");
  if (app) {
    app.style.fontSize = `${size}px`;
  }
  terminal.setOption("fontSize", size);
  fitAddon.fit();
}

function getFontSize() {
  const raw = localStorage.getItem("fontSize");
  const parsed = raw ? Number(raw) : 14;
  if (Number.isFinite(parsed)) {
    return Math.min(FONT_MAX, Math.max(FONT_MIN, parsed));
  }
  return 14;
}

function setFontSize(size) {
  const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
  localStorage.setItem("fontSize", String(clamped));
  applyFontSize(clamped);
}

function updateEmptyStates() {
  if (chatEmpty) {
    if (!chatEl.contains(chatEmpty)) {
      chatEl.prepend(chatEmpty);
    }
    const hasMessages = Array.from(chatEl.children).some((child) => child.id !== "chatEmpty");
    chatEmpty.classList.toggle("hidden", hasMessages);
  }
  if (historyEmpty) {
    historyEmpty.classList.toggle("hidden", commandHistory.length > 0);
  }
}

function shouldAutoScroll() {
  if (!chatEl) {
    return true;
  }
  const threshold = 40;
  return chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < threshold;
}

function updateScrollButton() {
  if (!scrollToLatest) {
    return;
  }
  scrollToLatest.classList.toggle("hidden", shouldAutoScroll());
}

const history = [];
const MAX_HISTORY = 20;
const pendingResponses = new Map();
const commandHistory = [];
const MAX_COMMAND_HISTORY = 30;
let pendingDangerCommand = null;

function pushHistory(role, text) {
  history.push({ role, text });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function buildHistoryPrompt() {
  return history
    .map((item) => `${item.role.toUpperCase()}: ${item.text}`)
    .join("\n");
}

async function sendPrompt() {
  const prompt = inputEl.value.trim();
  if (!prompt) {
    return;
  }

  inputEl.value = "";
  appendMessage("user", prompt);
  pushHistory("user", prompt);

  sendBtn.disabled = true;
  setStatus("חושב...");
  const context = buildHistoryPrompt();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const messageEl = appendMessage("ai", "", "Running");
  pendingResponses.set(id, { element: messageEl, text: "" });
  window.api.sendPrompt(id, prompt, context);
}

let composing = false;
sendBtn.addEventListener("click", sendPrompt);
inputEl.addEventListener("compositionstart", () => {
  composing = true;
});
inputEl.addEventListener("compositionend", () => {
  composing = false;
});
inputEl.addEventListener("keydown", (e) => {
  if (composing) {
    return;
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});

inputEl.focus();

let pendingCommand = null;
let lastCommand = "";

function maybeAutoRun(text) {
  const command = extractCommand(text);
  if (!command) {
    return;
  }

  const consent = localStorage.getItem("autoRunConsent");
  if (consent === "allowed") {
    if (isDangerous(command)) {
      showDangerModal(command);
    } else {
      runCommand(command);
    }
    return;
  }
  if (consent === "denied") {
    return;
  }

  pendingCommand = command;
  showConsentModal(true);
}

function extractCommand(text) {
  if (!text) {
    return "";
  }

  const fenceMatch = text.match(/```(?:bash|sh|shell|zsh)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    const fenced = fenceMatch[1].trim();
    if (fenced) {
      return fenced;
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("$ ")) {
      return line.slice(2);
    }
    if (line.toLowerCase().startsWith("cmd:")) {
      return line.slice(4).trim();
    }
    if (line.toLowerCase().startsWith("run:")) {
      return line.slice(4).trim();
    }
    if (line.startsWith("•")) {
      const candidate = line.replace(/^•\s*/, "");
      if (looksLikeCommand(candidate)) {
        return candidate;
      }
    }
    if (looksLikeCommand(line)) {
      return line;
    }
  }
  return "";
}

function looksLikeCommand(line) {
  if (!line) {
    return false;
  }
  // Ignore obvious sentences.
  if (/[.!?]$/.test(line)) {
    return false;
  }
  // Common shell command starters.
  return /^(sudo|apt|npm|node|yarn|pnpm|git|cd|ls|pwd|whoami|id|python|python3|pip|pip3|bash|sh|zsh|echo|cat|grep|rg|curl|wget|make)\b/.test(
    line
  );
}

function runCommand(command) {
  if (!command) {
    return;
  }
  if (lastCommand && lastCommand !== command) {
    appendMessage("ai", "Command changed from previous suggestion.", "Note");
  }
  lastCommand = command;
  appendMessage("ai", `Running in terminal: ${command}`);
  recordCommand(command);
  const lines = command.split(/\r?\n/).filter((line) => line.trim().length);
  for (const line of lines) {
    window.api.terminalWrite(line + "\r");
  }
}

function isDangerous(command) {
  return /(rm\s+-rf\s+\/|mkfs|dd\s+if=|:?\(\)\s*{\s*:\|:\s*&\s*}\s*;|shutdown|reboot|poweroff|halt|init\s+0)/i.test(
    command
  );
}

function showDangerModal(command) {
  pendingDangerCommand = command;
  if (dangerText) {
    dangerText.textContent = `הפקודה נראית מסוכנת: ${command}`;
  }
  dangerModal?.classList.toggle("hidden", false);
  dangerModal?.setAttribute("aria-hidden", "false");
}

function hideDangerModal() {
  dangerModal?.classList.toggle("hidden", true);
  dangerModal?.setAttribute("aria-hidden", "true");
}

function recordCommand(command) {
  if (!cmdHistoryEl) {
    return;
  }
  commandHistory.unshift(command);
  if (commandHistory.length > MAX_COMMAND_HISTORY) {
    commandHistory.pop();
  }
  renderCommandHistory();
  updateEmptyStates();
}

function renderCommandHistory() {
  if (!cmdHistoryEl) {
    return;
  }
  cmdHistoryEl.innerHTML = "";
  for (const cmd of commandHistory) {
    const item = document.createElement("div");
    item.className = "side-item";
    item.textContent = cmd;
    item.title = cmd;
    item.addEventListener("click", () => {
      inputEl.value = cmd;
      inputEl.focus();
    });
    cmdHistoryEl.appendChild(item);
  }
}

function showConsentModal(show) {
  consentModal.classList.toggle("hidden", !show);
  consentModal.setAttribute("aria-hidden", show ? "false" : "true");
}

consentAllow.addEventListener("click", () => {
  localStorage.setItem("autoRunConsent", "allowed");
  showConsentModal(false);
  if (pendingCommand) {
    if (isDangerous(pendingCommand)) {
      showDangerModal(pendingCommand);
    } else {
      runCommand(pendingCommand);
    }
    pendingCommand = null;
  }
});

consentDecline.addEventListener("click", () => {
  localStorage.setItem("autoRunConsent", "denied");
  pendingCommand = null;
  showConsentModal(false);
});

dangerAllow?.addEventListener("click", () => {
  hideDangerModal();
  if (pendingDangerCommand) {
    runCommand(pendingDangerCommand);
    pendingDangerCommand = null;
  }
});

dangerDecline?.addEventListener("click", () => {
  pendingDangerCommand = null;
  hideDangerModal();
});

window.api.onAiChunk(({ id, chunk }) => {
  const entry = pendingResponses.get(id);
  if (!entry) {
    return;
  }
  entry.text += chunk;
  const body = entry.element.querySelector(".body");
  if (body) {
    body.textContent = entry.text;
  }
  if (shouldAutoScroll()) {
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  updateScrollButton();
});

window.api.onAiDone(({ id, text, error }) => {
  const hadError = Boolean(error);
  const entry = pendingResponses.get(id);
  if (entry) {
    const finalText = error || text || "(no output)";
    entry.text = finalText;
    const body = entry.element.querySelector(".body");
    if (body) {
      body.textContent = finalText;
    }
    if (error) {
      entry.element.classList.add("error");
      const badge = entry.element.querySelector(".badge");
      if (badge) {
        badge.textContent = "שגיאה";
      }
      setStatus("שגיאה");
    } else {
      const badge = entry.element.querySelector(".badge");
      if (badge) {
        badge.textContent = "בוצע";
      }
    }
    applyCommandHighlight(entry.element, finalText);
    pushHistory("ai", finalText);
    maybeAutoRun(finalText);
    pendingResponses.delete(id);
  } else if (error) {
    const el = appendMessage("ai", error, "שגיאה");
    el.classList.add("error");
    setStatus("שגיאה");
  }
  sendBtn.disabled = false;
  if (hadError) {
    setTimeout(() => setStatus("מוכן"), 1500);
  } else {
    setStatus("מוכן");
  }
  inputEl.focus();
});

window.api.onAppWarning((msg) => {
  if (msg) {
    appendMessage("ai", msg, "אזהרה");
  }
});

window.api.onAppStatus((msg) => {
  if (msg) {
    setMeta(`${msg} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }
});

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    chatEl.innerHTML = "";
    history.splice(0, history.length);
    updateEmptyStates();
    setStatus("נוקה");
    setTimeout(() => setStatus("מוכן"), 800);
  });
}

function saveSession() {
  localStorage.setItem("chatHistory", JSON.stringify(history));
  localStorage.setItem("commandHistory", JSON.stringify(commandHistory));
}

function restoreSession() {
  const raw = localStorage.getItem("chatHistory");
  if (!raw) {
    return;
  }
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && item.role && item.text) {
          appendMessage(item.role, item.text);
          history.push(item);
        }
      }
    }
  } catch (_err) {
    // Ignore corrupted session data.
  }
}

window.addEventListener("beforeunload", saveSession);
restoreSession();
try {
  const rawCommands = localStorage.getItem("commandHistory");
  if (rawCommands) {
    const items = JSON.parse(rawCommands);
    if (Array.isArray(items)) {
      commandHistory.push(...items.slice(0, MAX_COMMAND_HISTORY));
      renderCommandHistory();
    }
  }
} catch (_err) {
  // ignore
}
updateEmptyStates();
setStatus("מוכן");

if (toggleTheme) {
  toggleTheme.addEventListener("click", () => {
    const current = document.body.dataset.theme || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    localStorage.setItem("theme", next);
  });
}

if (toggleDensity) {
  toggleDensity.addEventListener("click", () => {
    const app = document.querySelector(".app");
    if (!app) {
      return;
    }
    app.classList.toggle("compact");
    localStorage.setItem("density", app.classList.contains("compact") ? "compact" : "comfortable");
  });
}

if (jumpTerminal) {
  jumpTerminal.addEventListener("click", () => {
    if (terminalPanel) {
      terminalPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

if (toggleRtl) {
  toggleRtl.addEventListener("click", () => {
    const current = document.body.dataset.direction || "ltr";
    const next = current === "rtl" ? "ltr" : "rtl";
    document.body.dataset.direction = next;
    localStorage.setItem("direction", next);
  });
}

if (fontDown) {
  fontDown.addEventListener("click", () => {
    setFontSize(getFontSize() - FONT_STEP);
  });
}

if (fontUp) {
  fontUp.addEventListener("click", () => {
    setFontSize(getFontSize() + FONT_STEP);
  });
}

if (startImprove) {
  startImprove.addEventListener("click", () => {
    appendMessage("ai", "מתחיל לולאת שיפור (עד 5 סבבים)...", "Info");
    window.api.startImprove(5);
  });
}

if (healthCheck) {
  healthCheck.addEventListener("click", () => {
    appendMessage("ai", "בודק מערכת...", "Info");
    window.api.healthCheck();
  });
}

window.api.onImproveLog((msg) => {
  if (msg) {
    appendMessage("ai", msg.trim(), "לוג");
  }
});

window.api.onImproveDone((msg) => {
  if (msg) {
    appendMessage("ai", msg, "בוצע");
  }
});

window.api.onHealthResult((msg) => {
  if (msg) {
    appendMessage("ai", msg, "סטטוס");
  }
});

function restoreUiPrefs() {
  const theme = localStorage.getItem("theme") || "dark";
  document.body.dataset.theme = theme;
  const direction = localStorage.getItem("direction") || "rtl";
  document.body.dataset.direction = direction;
  const density = localStorage.getItem("density") || "comfortable";
  const app = document.querySelector(".app");
  if (app && density === "compact") {
    app.classList.add("compact");
  }
  setFontSize(getFontSize());
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const meta = statusMeta ? statusMeta.textContent.split("·")[0].trim() : "WSL: Unknown";
  setMeta(`${meta} · ${time}`);
}

restoreUiPrefs();
updateClock();
setInterval(updateClock, 1000);

quickButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const task = btn.getAttribute("data-task") || "";
    if (!task) {
      return;
    }
    inputEl.value = task;
    sendPrompt();
  });
});

if (scrollToLatest) {
  scrollToLatest.addEventListener("click", () => {
    chatEl.scrollTop = chatEl.scrollHeight;
    updateScrollButton();
  });
}

if (chatEl) {
  chatEl.addEventListener("scroll", () => {
    updateScrollButton();
  });
}

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "enter") {
    event.preventDefault();
    sendPrompt();
  } else if (key === "l") {
    event.preventDefault();
    clearBtn?.click();
  } else if (key === "k") {
    event.preventDefault();
    inputEl.focus();
  } else if (key === "j") {
    event.preventDefault();
    jumpTerminal?.click();
  } else if (key === "d") {
    event.preventDefault();
    toggleDensity?.click();
  } else if (key === "t") {
    event.preventDefault();
    toggleTheme?.click();
  } else if (key === "r" && event.shiftKey) {
    event.preventDefault();
    toggleRtl?.click();
  } else if (key === "+" || key === "=") {
    event.preventDefault();
    fontUp?.click();
  } else if (key === "-" || key === "_") {
    event.preventDefault();
    fontDown?.click();
  }
});

function applyCommandHighlight(wrapper, text) {
  if (!wrapper || !text) {
    return;
  }
  const cmd = extractCommand(text);
  if (!cmd) {
    return;
  }
  const body = wrapper.querySelector(".body");
  if (!body) {
    return;
  }
  if (text.trim() === cmd.trim()) {
    body.classList.add("command");
    return;
  }
  const cmdBlock = document.createElement("div");
  cmdBlock.className = "command";
  cmdBlock.textContent = cmd;
  wrapper.appendChild(cmdBlock);
}
