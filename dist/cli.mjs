#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/tsup/assets/esm_shims.js
import { fileURLToPath } from "url";
import path from "path";
var getFilename, getDirname, __dirname;
var init_esm_shims = __esm({
  "node_modules/tsup/assets/esm_shims.js"() {
    "use strict";
    getFilename = () => fileURLToPath(import.meta.url);
    getDirname = () => path.dirname(getFilename());
    __dirname = /* @__PURE__ */ getDirname();
  }
});

// src/core/onboarding-ui.tsx
var onboarding_ui_exports = {};
__export(onboarding_ui_exports, {
  renderGlobalOnboarding: () => renderGlobalOnboarding,
  renderProjectOnboarding: () => renderProjectOnboarding
});
import React, { useState, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function TabBar({ tabs, activeIndex }) {
  return /* @__PURE__ */ jsxs(Box, { marginBottom: 1, children: [
    tabs.map((tab, i) => /* @__PURE__ */ jsx(React.Fragment, { children: i === activeIndex ? /* @__PURE__ */ jsxs(Text, { bold: true, inverse: true, children: [
      " ",
      tab,
      " "
    ] }) : /* @__PURE__ */ jsxs(Text, { dimColor: true, children: [
      "  ",
      tab,
      "  "
    ] }) }, tab)),
    /* @__PURE__ */ jsx(Text, { dimColor: true, children: "  (tab to cycle)" })
  ] });
}
function SelectItem({ label, value, description, isSelected, isCurrent, isMulti = false }) {
  const indicator = isMulti ? isSelected ? "\u25CF" : "\u25CB" : isSelected ? "\u25CF" : "\u25CB";
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isCurrent ? "cyan" : void 0, children: isCurrent ? "\u203A " : "  " }),
      /* @__PURE__ */ jsxs(Text, { color: isSelected ? "cyan" : "gray", children: [
        indicator,
        " "
      ] }),
      /* @__PURE__ */ jsx(Text, { bold: isCurrent, children: label }),
      value && /* @__PURE__ */ jsxs(Text, { bold: true, color: "cyan", children: [
        " ",
        value
      ] })
    ] }),
    description && /* @__PURE__ */ jsx(Box, { marginLeft: 4, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: description }) })
  ] });
}
function Footer({ hints }) {
  return /* @__PURE__ */ jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, paddingTop: 0, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: hints.join(" \xB7 ") }) });
}
function GlobalWizard({ onComplete }) {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState("experience");
  const [experienceLevel, setExperienceLevel] = useState("intermediate");
  const [selectedPatterns, setSelectedPatterns] = useState(
    new Set(COMMON_KEY_FILE_PATTERNS.filter((p) => p.default).map((p) => p.pattern))
  );
  const [customPatterns, setCustomPatterns] = useState("");
  const [refreshStale, setRefreshStale] = useState(true);
  const [contextRestore, setContextRestore] = useState(true);
  const [trackNew, setTrackNew] = useState("auto");
  const [cursorIndex, setCursorIndex] = useState(0);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const getTabs = useCallback(() => {
    if (experienceLevel === "beginner") return ["experience", "confirm"];
    if (experienceLevel === "intermediate") return ["experience", "patterns", "confirm"];
    return ["experience", "patterns", "behaviors", "confirm"];
  }, [experienceLevel]);
  const tabs = getTabs();
  const tabIndex = tabs.indexOf(activeTab);
  const handleComplete = useCallback(() => {
    const allPatterns = [
      ...Array.from(selectedPatterns),
      ...customPatterns ? customPatterns.split(",").map((p) => p.trim()).filter(Boolean) : []
    ];
    const config = {
      experienceLevel,
      globalKeyPatterns: experienceLevel === "beginner" ? DEFAULT_ONBOARDING_CONFIG.globalKeyPatterns : allPatterns,
      autoBehaviors: experienceLevel === "expert" ? { refreshStaleSnapshots: refreshStale, contextRestoreOnCompact: contextRestore, trackNewKeyFiles: trackNew } : DEFAULT_ONBOARDING_CONFIG.autoBehaviors,
      projects: {}
    };
    onComplete(config);
    exit();
  }, [experienceLevel, selectedPatterns, customPatterns, refreshStale, contextRestore, trackNew, onComplete, exit]);
  useInput((input, key) => {
    if (key.escape) {
      if (isEditingCustom) {
        setIsEditingCustom(false);
      } else {
        exit();
      }
      return;
    }
    if (key.tab && !isEditingCustom) {
      const newIndex = key.shift ? (tabIndex - 1 + tabs.length) % tabs.length : (tabIndex + 1) % tabs.length;
      setActiveTab(tabs[newIndex]);
      setCursorIndex(0);
      return;
    }
    if (isEditingCustom) {
      if (key.return) {
        setIsEditingCustom(false);
      } else if (key.backspace || key.delete) {
        setCustomPatterns((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setCustomPatterns((prev) => prev + input);
      }
      return;
    }
    const getItemCount = () => {
      switch (activeTab) {
        case "experience":
          return 3;
        case "patterns":
          return COMMON_KEY_FILE_PATTERNS.length + 1;
        case "behaviors":
          return 3;
        case "confirm":
          return 2;
        default:
          return 0;
      }
    };
    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursorIndex((prev) => Math.min(getItemCount() - 1, prev + 1));
      return;
    }
    if (key.return || input === " ") {
      switch (activeTab) {
        case "experience": {
          const levels = ["beginner", "intermediate", "expert"];
          const selected = levels[cursorIndex];
          if (selected) {
            setExperienceLevel(selected);
            const newTabs = selected === "beginner" ? ["experience", "confirm"] : selected === "intermediate" ? ["experience", "patterns", "confirm"] : ["experience", "patterns", "behaviors", "confirm"];
            setActiveTab(newTabs[1]);
            setCursorIndex(0);
          }
          break;
        }
        case "patterns": {
          const isCustom = cursorIndex === COMMON_KEY_FILE_PATTERNS.length;
          if (isCustom) {
            setIsEditingCustom(true);
          } else {
            const pattern = COMMON_KEY_FILE_PATTERNS[cursorIndex];
            if (pattern) {
              setSelectedPatterns((prev) => {
                const next = new Set(prev);
                if (next.has(pattern.pattern)) {
                  next.delete(pattern.pattern);
                } else {
                  next.add(pattern.pattern);
                }
                return next;
              });
            }
          }
          break;
        }
        case "behaviors": {
          if (cursorIndex === 0) {
            setRefreshStale(!refreshStale);
          } else if (cursorIndex === 1) {
            setContextRestore(!contextRestore);
          } else if (cursorIndex === 2) {
            setTrackNew(trackNew === "auto" ? "ask" : trackNew === "ask" ? "manual" : "auto");
          }
          break;
        }
        case "confirm": {
          if (cursorIndex === 0) {
            handleComplete();
          } else {
            setActiveTab(tabs[tabIndex - 1] || "experience");
            setCursorIndex(0);
          }
          break;
        }
      }
    }
  });
  const tabNames = tabs.map((t) => {
    switch (t) {
      case "experience":
        return "Experience";
      case "patterns":
        return "Patterns";
      case "behaviors":
        return "Behaviors";
      case "confirm":
        return "Confirm";
      default:
        return t;
    }
  });
  const getTitle = () => {
    switch (activeTab) {
      case "experience":
        return "Select your experience level";
      case "patterns":
        return `Key file patterns (${selectedPatterns.size} selected)`;
      case "behaviors":
        return "Configure auto behaviors";
      case "confirm":
        return "Ready to complete setup";
      default:
        return "";
    }
  };
  const renderExperience = () => {
    const items = [
      { id: "beginner", label: "Beginner", desc: "Auto-setup, minimal questions" },
      { id: "intermediate", label: "Intermediate", desc: "Smart defaults with confirmation" },
      { id: "expert", label: "Expert", desc: "Full control over all settings" }
    ];
    return items.map((item, i) => /* @__PURE__ */ jsx(
      SelectItem,
      {
        label: item.label,
        description: item.desc,
        isCurrent: i === cursorIndex,
        isSelected: item.id === experienceLevel
      },
      item.id
    ));
  };
  const renderPatterns = () => {
    const patternItems = COMMON_KEY_FILE_PATTERNS.map((p, i) => /* @__PURE__ */ jsx(
      SelectItem,
      {
        label: p.pattern,
        description: p.description,
        isCurrent: i === cursorIndex,
        isSelected: selectedPatterns.has(p.pattern),
        isMulti: true
      },
      p.pattern
    ));
    const customIndex = COMMON_KEY_FILE_PATTERNS.length;
    const customItem = isEditingCustom ? /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
      /* @__PURE__ */ jsxs(Box, { children: [
        /* @__PURE__ */ jsx(Text, { color: "cyan", children: "\u203A " }),
        /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u25CB " }),
        /* @__PURE__ */ jsx(Text, { children: "Custom: " }),
        /* @__PURE__ */ jsx(Text, { color: "cyan", children: customPatterns }),
        /* @__PURE__ */ jsx(Text, { color: "cyan", inverse: true, children: " " })
      ] }),
      /* @__PURE__ */ jsx(Box, { marginLeft: 4, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: "Type comma-separated patterns, Enter when done" }) })
    ] }, "_custom") : /* @__PURE__ */ jsx(
      SelectItem,
      {
        label: "Custom patterns...",
        description: customPatterns || "Add your own patterns",
        isCurrent: cursorIndex === customIndex,
        isSelected: false
      },
      "_custom"
    );
    return [...patternItems, customItem];
  };
  const renderBehaviors = () => {
    const items = [
      {
        id: "refresh",
        label: "Auto-refresh snapshots:",
        value: refreshStale ? "Yes" : "No",
        desc: "Refresh when snapshots become stale"
      },
      {
        id: "context",
        label: "Context restore:",
        value: contextRestore ? "Yes" : "No",
        desc: "Auto-restore after compaction"
      },
      {
        id: "track",
        label: "New key files:",
        value: trackNew,
        desc: "When new potential key files detected (auto/ask/manual)"
      }
    ];
    return items.map((item, i) => /* @__PURE__ */ jsx(
      SelectItem,
      {
        label: item.label,
        value: item.value,
        description: item.desc,
        isCurrent: i === cursorIndex,
        isSelected: i === cursorIndex,
        isMulti: true
      },
      item.id
    ));
  };
  const renderConfirm = () => {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        SelectItem,
        {
          label: "Confirm and continue",
          description: "Save settings and install MCP server",
          isCurrent: cursorIndex === 0,
          isSelected: cursorIndex === 0
        }
      ),
      /* @__PURE__ */ jsx(
        SelectItem,
        {
          label: "Go back",
          description: "Review settings",
          isCurrent: cursorIndex === 1,
          isSelected: false
        }
      )
    ] });
  };
  const renderContent = () => {
    switch (activeTab) {
      case "experience":
        return renderExperience();
      case "patterns":
        return renderPatterns();
      case "behaviors":
        return renderBehaviors();
      case "confirm":
        return renderConfirm();
      default:
        return null;
    }
  };
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsx(Box, { marginBottom: 1, children: /* @__PURE__ */ jsx(Text, { bold: true, color: "cyan", children: "\u{1F52E} Argus Setup" }) }),
    /* @__PURE__ */ jsx(TabBar, { tabs: tabNames, activeIndex: tabIndex }),
    /* @__PURE__ */ jsx(Box, { marginBottom: 1, children: /* @__PURE__ */ jsx(Text, { bold: true, children: getTitle() }) }),
    renderContent(),
    activeTab === "patterns" && cursorIndex < COMMON_KEY_FILE_PATTERNS.length && /* @__PURE__ */ jsx(Box, { marginLeft: 2, marginTop: 1, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: "\u2193 more below" }) }),
    /* @__PURE__ */ jsx(Footer, { hints: isEditingCustom ? ["Type patterns", "Enter: done", "Esc: cancel"] : ["\u2191\u2193: navigate", "Space/Enter: select", "Tab: next section", "Esc: cancel"] })
  ] });
}
function ProjectWizard({
  projectName,
  detectedFiles,
  globalPatterns,
  experienceLevel,
  onComplete
}) {
  const { exit } = useApp();
  const patternMatches = detectedFiles.filter((f) => f.matchedPattern);
  const otherFiles = detectedFiles.filter((f) => !f.matchedPattern).slice(0, 10);
  const allFiles = [...patternMatches, ...otherFiles];
  const [selectedFiles, setSelectedFiles] = useState(
    new Set(patternMatches.map((f) => f.path))
  );
  const [cursorIndex, setCursorIndex] = useState(0);
  const [tab, setTab] = useState(allFiles.length > 0 ? "files" : "confirm");
  const tabs = allFiles.length > 0 ? ["files", "confirm"] : ["confirm"];
  const tabIndex = tabs.indexOf(tab);
  const handleComplete = useCallback(() => {
    const config = {
      keyFiles: Array.from(selectedFiles),
      customPatterns: [],
      lastScanDate: (/* @__PURE__ */ new Date()).toISOString()
    };
    onComplete(config);
    exit();
  }, [selectedFiles, onComplete, exit]);
  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if (key.tab) {
      const newIndex = key.shift ? (tabIndex - 1 + tabs.length) % tabs.length : (tabIndex + 1) % tabs.length;
      setTab(tabs[newIndex]);
      setCursorIndex(0);
      return;
    }
    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      const maxIndex = tab === "files" ? allFiles.length - 1 : 1;
      setCursorIndex((prev) => Math.min(maxIndex, prev + 1));
      return;
    }
    if (key.return || input === " ") {
      if (tab === "files") {
        const file = allFiles[cursorIndex];
        if (file) {
          setSelectedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(file.path)) {
              next.delete(file.path);
            } else {
              next.add(file.path);
            }
            return next;
          });
        }
      } else {
        if (cursorIndex === 0) {
          handleComplete();
        } else {
          setTab("files");
          setCursorIndex(0);
        }
      }
    }
  });
  const tabNames = tabs.map((t) => t === "files" ? "Files" : "Confirm");
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsx(Box, { marginBottom: 1, children: /* @__PURE__ */ jsxs(Text, { bold: true, color: "cyan", children: [
      "\u{1F4C2} Project Setup: ",
      projectName
    ] }) }),
    /* @__PURE__ */ jsx(TabBar, { tabs: tabNames, activeIndex: tabIndex }),
    /* @__PURE__ */ jsx(Box, { marginBottom: 1, children: /* @__PURE__ */ jsx(Text, { bold: true, children: tab === "files" ? `Select key files (${selectedFiles.size}/${allFiles.length} selected)` : "Ready to continue" }) }),
    tab === "files" && /* @__PURE__ */ jsxs(Fragment, { children: [
      patternMatches.length > 0 && /* @__PURE__ */ jsx(Box, { marginBottom: 1, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: "\u2500\u2500 Matches your patterns \u2500\u2500" }) }),
      allFiles.map((file, i) => {
        const isPatternMatch = patternMatches.includes(file);
        const showSeparator = i === patternMatches.length && otherFiles.length > 0;
        return /* @__PURE__ */ jsxs(React.Fragment, { children: [
          showSeparator && /* @__PURE__ */ jsx(Box, { marginY: 1, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: "\u2500\u2500 Other detected files \u2500\u2500" }) }),
          /* @__PURE__ */ jsx(
            SelectItem,
            {
              label: file.path,
              description: `${file.lines} lines \xB7 ${file.reason}`,
              isCurrent: i === cursorIndex,
              isSelected: selectedFiles.has(file.path),
              isMulti: true
            }
          )
        ] }, file.path);
      }),
      allFiles.length > 8 && cursorIndex < allFiles.length - 1 && /* @__PURE__ */ jsx(Box, { marginLeft: 2, children: /* @__PURE__ */ jsx(Text, { dimColor: true, children: "\u2193 more below" }) })
    ] }),
    tab === "confirm" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        SelectItem,
        {
          label: "Confirm and continue",
          description: `Track ${selectedFiles.size} key file(s)`,
          isCurrent: cursorIndex === 0,
          isSelected: cursorIndex === 0
        }
      ),
      /* @__PURE__ */ jsx(
        SelectItem,
        {
          label: "Go back",
          description: "Review file selection",
          isCurrent: cursorIndex === 1,
          isSelected: false
        }
      )
    ] }),
    /* @__PURE__ */ jsx(Footer, { hints: ["\u2191\u2193: navigate", "Space/Enter: select", "Tab: next section", "Esc: cancel"] })
  ] });
}
async function renderGlobalOnboarding() {
  return new Promise((resolve2) => {
    const { waitUntilExit } = render(
      /* @__PURE__ */ jsx(GlobalWizard, { onComplete: resolve2 })
    );
    waitUntilExit();
  });
}
async function renderProjectOnboarding(projectName, detectedFiles, globalPatterns, experienceLevel) {
  return new Promise((resolve2) => {
    const { waitUntilExit } = render(
      /* @__PURE__ */ jsx(
        ProjectWizard,
        {
          projectName,
          detectedFiles,
          globalPatterns,
          experienceLevel,
          onComplete: resolve2
        }
      )
    );
    waitUntilExit();
  });
}
var init_onboarding_ui = __esm({
  "src/core/onboarding-ui.tsx"() {
    "use strict";
    init_esm_shims();
    init_onboarding();
  }
});

// src/core/onboarding.ts
function detectPotentialKeyFiles(projectPath, userPatterns, fs2, path3) {
  const detected = [];
  function checkFile(filePath, relativePath) {
    try {
      const stats = fs2.statSync(filePath);
      if (!stats.isFile()) return;
      const fileName = path3.basename(filePath).toLowerCase();
      const ext = path3.extname(filePath).toLowerCase();
      if (![".md", ".txt", ".org", ""].includes(ext)) return;
      let reason = "";
      let matchedPattern;
      let matchedSignal;
      for (const pattern of userPatterns) {
        const regex = new RegExp(
          "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
          "i"
        );
        if (regex.test(fileName) || regex.test(relativePath)) {
          reason = `Matches pattern: ${pattern}`;
          matchedPattern = pattern;
          break;
        }
      }
      if (!reason && ext === ".md") {
        try {
          const content = fs2.readFileSync(filePath, "utf-8").toLowerCase();
          for (const signal of CONTENT_SIGNALS) {
            if (content.includes(signal)) {
              reason = `Contains "${signal}" keyword`;
              matchedSignal = signal;
              break;
            }
          }
        } catch {
        }
      }
      if (!reason && ext === ".md" && !relativePath.includes("/")) {
        const lineCount = countLines(filePath, fs2);
        if (lineCount > 50) {
          reason = "Large markdown file in project root";
        }
      }
      if (reason) {
        detected.push({
          path: relativePath,
          reason,
          lines: countLines(filePath, fs2),
          lastModified: stats.mtime,
          matchedPattern,
          matchedSignal
        });
      }
    } catch {
    }
  }
  function scanDir(dirPath, relativePath = "") {
    try {
      const entries = fs2.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if ([
            "node_modules",
            ".git",
            "target",
            "dist",
            "build",
            ".next",
            "coverage",
            "__pycache__",
            ".venv",
            "vendor"
          ].includes(entry.name)) {
            continue;
          }
          if (relativePath.split("/").filter(Boolean).length < 2) {
            scanDir(
              path3.join(dirPath, entry.name),
              relativePath ? `${relativePath}/${entry.name}` : entry.name
            );
          }
        } else {
          checkFile(
            path3.join(dirPath, entry.name),
            relativePath ? `${relativePath}/${entry.name}` : entry.name
          );
        }
      }
    } catch {
    }
  }
  scanDir(projectPath);
  return detected.sort((a, b) => {
    if (a.matchedPattern && !b.matchedPattern) return -1;
    if (!a.matchedPattern && b.matchedPattern) return 1;
    return b.lines - a.lines;
  });
}
function countLines(filePath, fs2) {
  try {
    const content = fs2.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}
async function runGlobalOnboarding() {
  const { renderGlobalOnboarding: renderGlobalOnboarding2 } = await Promise.resolve().then(() => (init_onboarding_ui(), onboarding_ui_exports));
  const config = await renderGlobalOnboarding2();
  console.log("\n\u2705 Onboarding complete!");
  console.log(`   Experience level: ${config.experienceLevel}`);
  console.log(`   Key patterns: ${config.globalKeyPatterns.join(", ")}`);
  return config;
}
async function runProjectOnboarding(projectPath, globalConfig, fs2, path3) {
  const projectName = path3.basename(projectPath);
  console.log(`
\u{1F4C2} Scanning project: ${projectName}
`);
  const detected = detectPotentialKeyFiles(projectPath, globalConfig.globalKeyPatterns, fs2, path3);
  if (globalConfig.experienceLevel === "beginner") {
    const autoSelected = detected.filter((d) => d.matchedPattern).map((d) => d.path);
    if (autoSelected.length > 0) {
      console.log("\u2705 Auto-detected key files:");
      autoSelected.forEach((f) => console.log(`   \u2022 ${f}`));
    } else {
      console.log("\u2139\uFE0F  No key files matching your patterns found");
    }
    return {
      keyFiles: autoSelected,
      customPatterns: [],
      lastScanDate: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const { renderProjectOnboarding: renderProjectOnboarding2 } = await Promise.resolve().then(() => (init_onboarding_ui(), onboarding_ui_exports));
  const config = await renderProjectOnboarding2(
    projectName,
    detected,
    globalConfig.globalKeyPatterns,
    globalConfig.experienceLevel
  );
  if (config.keyFiles.length > 0) {
    console.log(`
\u2705 Tracking ${config.keyFiles.length} key file(s)`);
  }
  return config;
}
var COMMON_KEY_FILE_PATTERNS, CONTENT_SIGNALS, DEFAULT_ONBOARDING_CONFIG;
var init_onboarding = __esm({
  "src/core/onboarding.ts"() {
    "use strict";
    init_esm_shims();
    COMMON_KEY_FILE_PATTERNS = [
      { pattern: "STATUS*", description: "Project status tracking", default: true },
      { pattern: "README*", description: "Project documentation", default: true },
      { pattern: "TODO*", description: "Task lists", default: true },
      { pattern: "ROADMAP*", description: "Project roadmap", default: false },
      { pattern: "PROGRESS*", description: "Progress tracking", default: false },
      { pattern: "CHANGELOG*", description: "Version history", default: false },
      { pattern: "ARCHITECTURE*", description: "Architecture docs", default: false },
      { pattern: "DEVELOPMENT*", description: "Development notes", default: false },
      { pattern: ".plan", description: "Plan files", default: false },
      { pattern: "docs/architecture*", description: "Architecture in docs/", default: false }
    ];
    CONTENT_SIGNALS = [
      "roadmap",
      "milestone",
      "progress",
      "status",
      "todo",
      "architecture",
      "overview",
      "getting started"
    ];
    DEFAULT_ONBOARDING_CONFIG = {
      experienceLevel: "beginner",
      globalKeyPatterns: ["STATUS*", "README*", "TODO*"],
      autoBehaviors: {
        refreshStaleSnapshots: true,
        contextRestoreOnCompact: true,
        trackNewKeyFiles: "auto"
      },
      projects: {}
    };
  }
});

// src/cli.ts
init_esm_shims();
import { Command } from "commander";
import { existsSync as existsSync4, readFileSync as readFileSync5, writeFileSync as writeFileSync4, statSync as statSync2, unlinkSync, readdirSync as readdirSync2, mkdirSync as mkdirSync2 } from "fs";
import * as fs from "fs";
import { homedir as homedir2 } from "os";
import { join as join4, resolve, basename as basename2 } from "path";
import * as path2 from "path";
import { execSync as execSync2 } from "child_process";

// src/core/config.ts
init_esm_shims();
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var DEFAULT_CONFIG = {
  provider: "ollama",
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "qwen2.5-coder:7b"
    }
  },
  defaults: {
    maxTurns: 15,
    turnTimeoutMs: 6e4,
    snapshotExtensions: ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "rb", "php", "swift", "kt", "scala", "c", "cpp", "h", "hpp", "cs", "md"],
    excludePatterns: [
      "node_modules",
      ".git",
      "target",
      "dist",
      "build",
      ".next",
      "coverage",
      "__pycache__",
      ".venv",
      "vendor"
    ]
  }
};
function getConfigDir() {
  return join(homedir(), ".argus");
}
function getConfigPath() {
  return join(getConfigDir(), "config.json");
}
function ensureConfigDir() {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
function loadConfig() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content = readFileSync(configPath, "utf-8");
    const loaded = JSON.parse(content);
    return {
      ...DEFAULT_CONFIG,
      ...loaded,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...loaded.providers
      },
      defaults: {
        ...DEFAULT_CONFIG.defaults,
        ...loaded.defaults
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
function saveConfig(config) {
  ensureConfigDir();
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
function validateConfig(config) {
  const errors = [];
  const providerConfig = config.providers[config.provider];
  if (!providerConfig) {
    errors.push(`Provider "${config.provider}" is not configured`);
    return errors;
  }
  if (config.provider !== "ollama" && !providerConfig.apiKey) {
    errors.push(`API key is required for provider "${config.provider}"`);
  }
  if (!providerConfig.model) {
    errors.push(`Model is required for provider "${config.provider}"`);
  }
  return errors;
}
var PROVIDER_DEFAULTS = {
  zai: {
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    model: "glm-4.7"
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "qwen2.5-coder:7b"
  }
};

// src/core/snapshot.ts
init_esm_shims();
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync, statSync, writeFileSync as writeFileSync2 } from "fs";
import { join as join2, relative, extname } from "path";
var DEFAULT_OPTIONS = {
  extensions: ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "rb", "php", "swift", "kt", "scala", "c", "cpp", "h", "hpp", "cs", "md", "json"],
  excludePatterns: [
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    "coverage",
    "__pycache__",
    ".venv",
    "vendor",
    ".DS_Store",
    "*.lock",
    "package-lock.json",
    "*.min.js",
    "*.min.css"
  ],
  maxFileSize: 1024 * 1024,
  // 1MB
  includeHidden: false
};
function shouldExclude(filePath, patterns) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  for (const pattern of patterns) {
    if (pattern.startsWith("*")) {
      const suffix = pattern.slice(1);
      if (normalizedPath.endsWith(suffix)) return true;
    } else if (normalizedPath.includes(`/${pattern}/`) || normalizedPath.endsWith(`/${pattern}`) || normalizedPath === pattern) {
      return true;
    }
  }
  return false;
}
function hasValidExtension(filePath, extensions) {
  const ext = extname(filePath).slice(1).toLowerCase();
  return extensions.includes(ext);
}
function collectFiles(dir, options, baseDir = dir) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join2(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      if (!options.includeHidden && entry.name.startsWith(".")) {
        continue;
      }
      if (shouldExclude(relativePath, options.excludePatterns)) {
        continue;
      }
      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath, options, baseDir));
      } else if (entry.isFile()) {
        if (!hasValidExtension(entry.name, options.extensions)) {
          continue;
        }
        try {
          const stats = statSync(fullPath);
          if (stats.size > options.maxFileSize) {
            continue;
          }
        } catch {
          continue;
        }
        files.push(fullPath);
      }
    }
  } catch (error) {
  }
  return files.sort();
}
function createSnapshot(projectPath, outputPath, options = {}) {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };
  if (!existsSync2(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  const stats = statSync(projectPath);
  if (!stats.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }
  const files = collectFiles(projectPath, mergedOptions);
  const lines = [];
  lines.push("================================================================================");
  lines.push("CODEBASE SNAPSHOT");
  lines.push(`Project: ${projectPath}`);
  lines.push(`Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push(`Extensions: ${mergedOptions.extensions.join(", ")}`);
  lines.push(`Files: ${files.length}`);
  lines.push("================================================================================");
  lines.push("");
  for (const filePath of files) {
    const relativePath = relative(projectPath, filePath);
    lines.push("");
    lines.push("================================================================================");
    lines.push(`FILE: ./${relativePath}`);
    lines.push("================================================================================");
    try {
      const content2 = readFileSync2(filePath, "utf-8");
      lines.push(content2);
    } catch (error) {
      lines.push("[Unable to read file]");
    }
  }
  const content = lines.join("\n");
  writeFileSync2(outputPath, content);
  const totalLines = content.split("\n").length;
  const totalSize = Buffer.byteLength(content, "utf-8");
  return {
    outputPath,
    fileCount: files.length,
    totalLines,
    totalSize,
    files: files.map((f) => relative(projectPath, f))
  };
}

// src/core/enhanced-snapshot.ts
init_esm_shims();
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join3, dirname, extname as extname2, basename } from "path";
import { execSync } from "child_process";
function parseImports(content, filePath) {
  const imports = [];
  const lines = content.split("\n");
  const patterns = [
    // import { a, b } from 'module'
    /import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
    // import * as name from 'module'
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // import defaultExport from 'module'
    /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // import 'module' (side-effect)
    /import\s+['"]([^'"]+)['"]/g,
    // require('module')
    /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import") && !trimmed.includes("require(")) continue;
    let match = /import\s+(type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      const isType = !!match[1];
      const symbols = match[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const target = match[3];
      imports.push({
        source: filePath,
        target,
        symbols,
        isDefault: false,
        isType
      });
      continue;
    }
    match = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[2],
        symbols: ["*"],
        isDefault: false,
        isType: false
      });
      continue;
    }
    match = /import\s+(type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match && !trimmed.includes("{")) {
      imports.push({
        source: filePath,
        target: match[3],
        symbols: [match[2]],
        isDefault: true,
        isType: !!match[1]
      });
      continue;
    }
    match = /^import\s+['"]([^'"]+)['"]/.exec(trimmed);
    if (match) {
      imports.push({
        source: filePath,
        target: match[1],
        symbols: [],
        isDefault: false,
        isType: false
      });
    }
  }
  return imports;
}
function parseExports(content, filePath) {
  const exports = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let match = /export\s+(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "function",
        signature: `function ${match[1]}${match[2]}`,
        line: i + 1
      });
      continue;
    }
    match = /export\s+class\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "class",
        line: i + 1
      });
      continue;
    }
    match = /export\s+(const|let|var)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1],
        line: i + 1
      });
      continue;
    }
    match = /export\s+(type|interface)\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[2],
        type: match[1],
        line: i + 1
      });
      continue;
    }
    match = /export\s+enum\s+(\w+)/.exec(trimmed);
    if (match) {
      exports.push({
        file: filePath,
        symbol: match[1],
        type: "enum",
        line: i + 1
      });
      continue;
    }
    if (/export\s+default/.test(trimmed)) {
      match = /export\s+default\s+(?:function\s+)?(\w+)?/.exec(trimmed);
      exports.push({
        file: filePath,
        symbol: match?.[1] || "default",
        type: "default",
        line: i + 1
      });
    }
  }
  return exports;
}
function calculateComplexity(content) {
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+/g,
    /\?\s*.*\s*:/g,
    /\&\&/g,
    /\|\|/g,
    /\bcatch\s*\(/g
  ];
  let complexity = 1;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}
function getComplexityLevel(score) {
  if (score <= 10) return "low";
  if (score <= 20) return "medium";
  return "high";
}
function mapTestFiles(files) {
  const testMap = {};
  const testPatterns = [
    // Same directory patterns
    (src) => src.replace(/\.tsx?$/, ".test.ts"),
    (src) => src.replace(/\.tsx?$/, ".test.tsx"),
    (src) => src.replace(/\.tsx?$/, ".spec.ts"),
    (src) => src.replace(/\.tsx?$/, ".spec.tsx"),
    (src) => src.replace(/\.jsx?$/, ".test.js"),
    (src) => src.replace(/\.jsx?$/, ".test.jsx"),
    (src) => src.replace(/\.jsx?$/, ".spec.js"),
    (src) => src.replace(/\.jsx?$/, ".spec.jsx"),
    // __tests__ directory pattern
    (src) => {
      const dir = dirname(src);
      const base = basename(src).replace(/\.(tsx?|jsx?)$/, "");
      return join3(dir, "__tests__", `${base}.test.ts`);
    },
    (src) => {
      const dir = dirname(src);
      const base = basename(src).replace(/\.(tsx?|jsx?)$/, "");
      return join3(dir, "__tests__", `${base}.test.tsx`);
    },
    // test/ directory pattern
    (src) => src.replace(/^src\//, "test/").replace(/\.(tsx?|jsx?)$/, ".test.ts"),
    (src) => src.replace(/^src\//, "tests/").replace(/\.(tsx?|jsx?)$/, ".test.ts")
  ];
  const fileSet = new Set(files);
  for (const file of files) {
    if (file.includes(".test.") || file.includes(".spec.") || file.includes("__tests__")) continue;
    if (!/\.(tsx?|jsx?)$/.test(file)) continue;
    const tests = [];
    for (const pattern of testPatterns) {
      const testPath = pattern(file);
      if (testPath !== file && fileSet.has(testPath)) {
        tests.push(testPath);
      }
    }
    if (tests.length > 0) {
      testMap[file] = [...new Set(tests)];
    }
  }
  return testMap;
}
function getRecentChanges(projectPath) {
  try {
    execSync("git rev-parse --git-dir", { cwd: projectPath, encoding: "utf-8", stdio: "pipe" });
    const output = execSync(
      'git log --since="7 days ago" --name-only --format="COMMIT_AUTHOR:%an" --diff-filter=ACMR',
      { cwd: projectPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, stdio: "pipe" }
    );
    if (!output.trim()) return [];
    const fileStats = {};
    let currentAuthor = "";
    let currentCommitId = 0;
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentCommitId++;
        continue;
      }
      if (trimmed.startsWith("COMMIT_AUTHOR:")) {
        currentAuthor = trimmed.replace("COMMIT_AUTHOR:", "");
        continue;
      }
      const file = trimmed;
      if (!fileStats[file]) {
        fileStats[file] = { commits: /* @__PURE__ */ new Set(), authors: /* @__PURE__ */ new Set() };
      }
      fileStats[file].commits.add(`${currentCommitId}`);
      if (currentAuthor) {
        fileStats[file].authors.add(currentAuthor);
      }
    }
    const result = Object.entries(fileStats).map(([file, stats]) => ({
      file,
      commits: stats.commits.size,
      authors: stats.authors.size
    })).sort((a, b) => b.commits - a.commits);
    return result;
  } catch {
    return null;
  }
}
function resolveImportPath(importPath, fromFile, projectFiles) {
  if (!importPath.startsWith(".")) return void 0;
  const fromDir = dirname(fromFile);
  let resolved = join3(fromDir, importPath);
  const extensions = [".ts", ".tsx", ".js", ".jsx", "", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (projectFiles.includes(candidate) || projectFiles.includes("./" + candidate)) {
      return candidate;
    }
  }
  return void 0;
}
function createEnhancedSnapshot(projectPath, outputPath, options = {}) {
  const baseResult = createSnapshot(projectPath, outputPath, options);
  const allImports = [];
  const allExports = [];
  const fileIndex = {};
  const projectFiles = baseResult.files.map((f) => "./" + f);
  for (const relPath of baseResult.files) {
    const fullPath = join3(projectPath, relPath);
    const ext = extname2(relPath).toLowerCase();
    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      continue;
    }
    try {
      const content = readFileSync3(fullPath, "utf-8");
      const imports = parseImports(content, relPath);
      const exports = parseExports(content, relPath);
      for (const imp of imports) {
        imp.resolved = resolveImportPath(imp.target, relPath, projectFiles);
      }
      allImports.push(...imports);
      allExports.push(...exports);
      fileIndex[relPath] = {
        path: relPath,
        imports,
        exports,
        size: content.length,
        lines: content.split("\n").length
      };
    } catch {
    }
  }
  const importGraph = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!importGraph[imp.source]) importGraph[imp.source] = [];
      if (!importGraph[imp.source].includes(imp.resolved)) {
        importGraph[imp.source].push(imp.resolved);
      }
    }
  }
  const exportGraph = {};
  for (const imp of allImports) {
    if (imp.resolved) {
      if (!exportGraph[imp.resolved]) exportGraph[imp.resolved] = [];
      if (!exportGraph[imp.resolved].includes(imp.source)) {
        exportGraph[imp.resolved].push(imp.source);
      }
    }
  }
  const symbolIndex = {};
  for (const exp of allExports) {
    if (!symbolIndex[exp.symbol]) symbolIndex[exp.symbol] = [];
    if (!symbolIndex[exp.symbol].includes(exp.file)) {
      symbolIndex[exp.symbol].push(exp.file);
    }
  }
  const complexityScores = [];
  for (const [relPath, metadata] of Object.entries(fileIndex)) {
    const fullPath = join3(projectPath, relPath);
    try {
      const content = readFileSync3(fullPath, "utf-8");
      const score = calculateComplexity(content);
      complexityScores.push({
        file: relPath,
        score,
        level: getComplexityLevel(score)
      });
    } catch {
    }
  }
  complexityScores.sort((a, b) => b.score - a.score);
  const testFileMap = mapTestFiles(baseResult.files);
  const recentChanges = getRecentChanges(projectPath);
  const metadataSection = `

================================================================================
METADATA: IMPORT GRAPH
================================================================================
${Object.entries(importGraph).map(([file, imports]) => `${file}:
${imports.map((i) => `  \u2192 ${i}`).join("\n")}`).join("\n\n")}

================================================================================
METADATA: EXPORT INDEX
================================================================================
${Object.entries(symbolIndex).map(([symbol, files]) => `${symbol}: ${files.join(", ")}`).join("\n")}

================================================================================
METADATA: FILE EXPORTS
================================================================================
${allExports.map((e) => `${e.file}:${e.line} - ${e.type} ${e.symbol}${e.signature ? ` ${e.signature}` : ""}`).join("\n")}

================================================================================
METADATA: WHO IMPORTS WHOM
================================================================================
${Object.entries(exportGraph).map(([file, importers]) => `${file} is imported by:
${importers.map((i) => `  \u2190 ${i}`).join("\n")}`).join("\n\n")}

================================================================================
METADATA: COMPLEXITY SCORES
================================================================================
${complexityScores.map((c) => `${c.file}: ${c.score} (${c.level})`).join("\n")}

================================================================================
METADATA: TEST COVERAGE MAP
================================================================================
${Object.entries(testFileMap).length > 0 ? Object.entries(testFileMap).map(([src, tests]) => `${src} -> ${tests.join(", ")}`).join("\n") : "(no test file mappings found)"}
${baseResult.files.filter(
    (f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes(".test.") && !f.includes(".spec.") && !f.includes("__tests__") && !testFileMap[f]
  ).map((f) => `${f} -> (no tests)`).join("\n")}
${recentChanges !== null ? `

================================================================================
METADATA: RECENT CHANGES (last 7 days)
================================================================================
${recentChanges.length > 0 ? recentChanges.map((c) => `${c.file}: ${c.commits} commit${c.commits !== 1 ? "s" : ""}, ${c.authors} author${c.authors !== 1 ? "s" : ""}`).join("\n") : "(no changes in the last 7 days)"}` : ""}
`;
  const existingContent = readFileSync3(outputPath, "utf-8");
  writeFileSync3(outputPath, existingContent + metadataSection);
  return {
    ...baseResult,
    metadata: {
      imports: allImports,
      exports: allExports,
      fileIndex,
      importGraph,
      exportGraph,
      symbolIndex,
      complexityScores,
      testFileMap,
      recentChanges
    }
  };
}

// src/core/engine.ts
init_esm_shims();
import { readFileSync as readFileSync4 } from "fs";

// src/core/prompts.ts
init_esm_shims();
var NUCLEUS_COMMANDS = `
COMMANDS (output ONE per turn):
(grep "pattern")           - Find lines matching regex
(grep "pattern" "i")       - Case-insensitive search  
(count RESULTS)            - Count matches
(take RESULTS n)           - First n results
(filter RESULTS (lambda (x) (match x.line "pattern" 0)))  - Filter results
(map RESULTS (lambda (x) x.line))  - Extract just the lines

VARIABLES: RESULTS = last result, _1 _2 _3 = results from turn 1,2,3

TO ANSWER: <<<FINAL>>>your answer<<<END>>>
`;
var CODEBASE_ANALYSIS_PROMPT = `You are analyzing a SOFTWARE CODEBASE snapshot to help a developer understand it.

The snapshot contains source files concatenated with "FILE: ./path/to/file" markers.

${NUCLEUS_COMMANDS}

## STRATEGY FOR CODEBASE SNAPSHOTS

**To find modules/directories:**
(grep "FILE:.*src/[^/]+/")       - top-level source dirs
(grep "FILE:.*mod\\.rs")         - Rust modules  
(grep "FILE:.*index\\.(ts|js)")  - JS/TS modules

**To find implementations:**
(grep "fn function_name")        - Rust functions
(grep "function|const.*=>")      - JS functions
(grep "class ClassName")         - Classes
(grep "struct |type |interface") - Type definitions

**To understand structure:**
(grep "FILE:")                   - List all files
(grep "use |import |require")    - Find dependencies
(grep "pub |export")             - Public APIs

## RULES
1. Output ONLY a Nucleus command OR a final answer
2. NO explanations, NO markdown formatting in commands
3. MUST provide final answer by turn 8
4. If turn 6+, start summarizing what you found

## EXAMPLE SESSION
Turn 1: (grep "FILE:.*src/[^/]+/mod\\.rs")
Turn 2: (take RESULTS 15)
Turn 3: <<<FINAL>>>The codebase has these main modules:
- src/auth/ - Authentication handling
- src/api/ - API endpoints
- src/db/ - Database layer
...<<<END>>>
`;
var ARCHITECTURE_PROMPT = `You are generating an ARCHITECTURE SUMMARY of a codebase.

${NUCLEUS_COMMANDS}

## YOUR TASK
Create a summary suitable for CLAUDE.md that helps Claude Code understand this project after context compaction.

## SEARCH STRATEGY (do these in order)
1. (grep "FILE:.*mod\\.rs|FILE:.*index\\.(ts|js)") - Find module entry points
2. (take RESULTS 20) - Limit results
3. Based on file paths, provide your summary

## OUTPUT FORMAT
Your final answer should be structured like:

## Modules
- **module_name/** - Brief description based on files found

## Key Patterns  
- Pattern observations from the code

## Important Files
- List key files and their apparent purpose

PROVIDE FINAL ANSWER BY TURN 6.
`;
var IMPLEMENTATION_PROMPT = `You are finding HOW something works in a codebase.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "FILE:.*keyword") - Find files related to the concept
2. (grep "keyword") - Find all mentions
3. (take RESULTS 30) - Limit if too many results
4. Look for function definitions, structs, classes
5. PROVIDE FINAL ANSWER based on file paths and code patterns found

## IMPORTANT
- You have 12 turns maximum
- By turn 8, START WRITING YOUR FINAL ANSWER
- Use what you've found - don't keep searching indefinitely
- It's better to give a partial answer than no answer

## OUTPUT FORMAT
Your final answer should explain:
- Which files contain the implementation
- Key functions/structs/classes involved  
- Basic flow of how it works (based on what you found)
`;
var COUNT_PROMPT = `You are counting items in a codebase.

${NUCLEUS_COMMANDS}

## STRATEGY  
1. (grep "pattern")
2. (count RESULTS)
3. <<<FINAL>>>There are N items matching the pattern.<<<END>>>

THIS SHOULD TAKE 2-3 TURNS MAXIMUM.
`;
var SEARCH_PROMPT = `You are searching for specific code.

${NUCLEUS_COMMANDS}

## STRATEGY
1. (grep "pattern")
2. (take RESULTS 20) if too many
3. Report what you found with file paths

PROVIDE FINAL ANSWER BY TURN 4.
`;
function selectPrompt(query) {
  const q = query.toLowerCase();
  if (/how many|count|number of|total|how much/.test(q)) {
    return COUNT_PROMPT;
  }
  if (/^(find|search|show|list|where is|locate)\b/.test(q) && q.length < 50) {
    return SEARCH_PROMPT;
  }
  if (/architect|structure|overview|module|organization|main.*component|summar|layout/.test(q)) {
    return ARCHITECTURE_PROMPT;
  }
  if (/how does|how is|implement|work|handle|process|flow/.test(q)) {
    return IMPLEMENTATION_PROMPT;
  }
  return CODEBASE_ANALYSIS_PROMPT;
}
function buildSystemPrompt(query) {
  return selectPrompt(query);
}
function getTurnLimit(query) {
  const q = query.toLowerCase();
  if (/how many|count/.test(q)) return 5;
  if (/^(find|search|show|list)\b/.test(q) && q.length < 50) return 6;
  if (/architect|overview|structure|module/.test(q)) return 12;
  if (/how does|how is|implement|work/.test(q)) return 12;
  return 12;
}

// src/core/engine.ts
function executeNucleus(command, content, bindings) {
  const parsed = parseSExpression(command);
  if (!parsed) {
    throw new Error(`Failed to parse command: ${command}`);
  }
  return evaluateExpr(parsed, content, bindings);
}
function parseSExpression(input) {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return null;
  let pos = 0;
  function parse() {
    const token = tokens[pos++];
    if (token === "(") {
      const list = [];
      while (tokens[pos] !== ")" && pos < tokens.length) {
        list.push(parse());
      }
      pos++;
      return list;
    } else if (token.startsWith('"')) {
      return token.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      return token;
    } else {
      return token;
    }
  }
  return parse();
}
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push(char);
      i++;
      continue;
    }
    if (char === '"') {
      let str = '"';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          str += input[i] + input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      str += '"';
      i++;
      tokens.push(str);
      continue;
    }
    let sym = "";
    while (i < input.length && !/[\s()]/.test(input[i])) {
      sym += input[i];
      i++;
    }
    tokens.push(sym);
  }
  return tokens;
}
function evaluateExpr(expr, content, bindings) {
  if (typeof expr === "string") {
    if (bindings.has(expr)) {
      return bindings.get(expr);
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }
    return expr;
  }
  if (!Array.isArray(expr) || expr.length === 0) {
    return expr;
  }
  const [op, ...args] = expr;
  switch (op) {
    case "grep": {
      const pattern = evaluateExpr(args[0], content, bindings);
      const flags = args[1] ? evaluateExpr(args[1], content, bindings) : "";
      const regex = new RegExp(pattern, flags + "g");
      const lines = content.split("\n");
      const matches = [];
      let charIndex = 0;
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let match;
        const lineRegex = new RegExp(pattern, flags + "g");
        while ((match = lineRegex.exec(line)) !== null) {
          matches.push({
            match: match[0],
            line,
            lineNum: lineNum + 1,
            index: charIndex + match.index,
            groups: match.slice(1)
          });
        }
        charIndex += line.length + 1;
      }
      return matches;
    }
    case "count": {
      const arr = evaluateExpr(args[0], content, bindings);
      if (Array.isArray(arr)) return arr.length;
      return 0;
    }
    case "map": {
      const arr = evaluateExpr(args[0], content, bindings);
      const lambdaExpr = args[1];
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== "lambda") {
        throw new Error("map requires a lambda expression");
      }
      const params = lambdaExpr[1];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] : params;
      return arr.map((item) => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    case "filter": {
      const arr = evaluateExpr(args[0], content, bindings);
      const lambdaExpr = args[1];
      if (!Array.isArray(lambdaExpr) || lambdaExpr[0] !== "lambda") {
        throw new Error("filter requires a lambda expression");
      }
      const params = lambdaExpr[1];
      const body = lambdaExpr[2];
      const paramName = Array.isArray(params) ? params[0] : params;
      return arr.filter((item) => {
        const localBindings = new Map(bindings);
        localBindings.set(paramName, item);
        return evaluateExpr(body, content, localBindings);
      });
    }
    case "first": {
      const arr = evaluateExpr(args[0], content, bindings);
      return arr[0];
    }
    case "last": {
      const arr = evaluateExpr(args[0], content, bindings);
      return arr[arr.length - 1];
    }
    case "take": {
      const arr = evaluateExpr(args[0], content, bindings);
      const n = evaluateExpr(args[1], content, bindings);
      return arr.slice(0, n);
    }
    case "sort": {
      const arr = evaluateExpr(args[0], content, bindings);
      const key = evaluateExpr(args[1], content, bindings);
      return [...arr].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return aVal - bVal;
        }
        return String(aVal).localeCompare(String(bVal));
      });
    }
    case "match": {
      const str = evaluateExpr(args[0], content, bindings);
      const strValue = typeof str === "object" && str !== null && "line" in str ? str.line : String(str);
      const pattern = evaluateExpr(args[1], content, bindings);
      const group = args[2] ? evaluateExpr(args[2], content, bindings) : 0;
      const regex = new RegExp(pattern);
      const match = strValue.match(regex);
      if (match) {
        return match[group] || null;
      }
      return null;
    }
    default:
      throw new Error(`Unknown command: ${op}`);
  }
}
function extractCommand(response) {
  const finalMatch = response.match(/<<<FINAL>>>([\s\S]*?)<<<END>>>/);
  if (finalMatch) {
    return { finalAnswer: finalMatch[1].trim() };
  }
  const sexpMatch = response.match(/\([^)]*(?:\([^)]*\)[^)]*)*\)/);
  if (sexpMatch) {
    return { command: sexpMatch[0] };
  }
  return {};
}
async function analyze(provider, documentPath, query, options = {}) {
  const {
    maxTurns = 15,
    verbose = false,
    onProgress
  } = options;
  const dynamicLimit = Math.min(getTurnLimit(query), maxTurns);
  const content = readFileSync4(documentPath, "utf-8");
  const fileCount = (content.match(/^FILE:/gm) || []).length;
  const lineCount = content.split("\n").length;
  const bindings = /* @__PURE__ */ new Map();
  const commands = [];
  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(query)
    },
    {
      role: "user",
      content: `CODEBASE SNAPSHOT:
- Total size: ${content.length.toLocaleString()} characters
- Files: ${fileCount}
- Lines: ${lineCount.toLocaleString()}

Files are marked with "FILE: ./path/to/file" headers.

QUERY: ${query}

Begin analysis. You have ${dynamicLimit} turns maximum - provide final answer before then.`
    }
  ];
  for (let turn = 1; turn <= dynamicLimit; turn++) {
    const isLastTurn = turn === dynamicLimit;
    const isNearEnd = turn >= dynamicLimit - 2;
    if (verbose) {
      console.log(`
[Turn ${turn}/${dynamicLimit}] Querying LLM...`);
    }
    const result = await provider.complete(messages);
    const response = result.content;
    if (verbose) {
      console.log(`[Turn ${turn}] Response: ${response.slice(0, 200)}...`);
    }
    const extracted = extractCommand(response);
    if (extracted.finalAnswer) {
      return {
        answer: extracted.finalAnswer,
        turns: turn,
        commands,
        success: true
      };
    }
    if (!extracted.command) {
      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: "Please provide a Nucleus command or final answer." });
      continue;
    }
    const command = extracted.command;
    commands.push(command);
    if (verbose) {
      console.log(`[Turn ${turn}] Command: ${command}`);
    }
    try {
      const cmdResult = executeNucleus(command, content, bindings);
      bindings.set("RESULTS", cmdResult);
      bindings.set(`_${turn}`, cmdResult);
      const resultStr = JSON.stringify(cmdResult, null, 2);
      const truncatedResult = resultStr.length > 2e3 ? resultStr.slice(0, 2e3) + "...[truncated]" : resultStr;
      if (verbose) {
        console.log(`[Turn ${turn}] Result: ${truncatedResult.slice(0, 500)}...`);
      }
      onProgress?.(turn, command, cmdResult);
      messages.push({ role: "assistant", content: command });
      let userMessage = `Result:
${truncatedResult}`;
      if (isNearEnd && !isLastTurn) {
        userMessage += `

\u26A0\uFE0F ${dynamicLimit - turn} turns remaining. Start forming your final answer.`;
      }
      messages.push({ role: "user", content: userMessage });
      if (isLastTurn) {
        messages.push({
          role: "user",
          content: "STOP SEARCHING. Based on everything you found, provide your final answer NOW using <<<FINAL>>>your answer<<<END>>>"
        });
        const finalResult = await provider.complete(messages);
        const finalExtracted = extractCommand(finalResult.content);
        if (finalExtracted.finalAnswer) {
          return {
            answer: finalExtracted.finalAnswer,
            turns: turn,
            commands,
            success: true
          };
        }
        return {
          answer: finalResult.content,
          turns: turn,
          commands,
          success: true
        };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.log(`[Turn ${turn}] Error: ${errMsg}`);
      }
      messages.push({ role: "assistant", content: command });
      messages.push({ role: "user", content: `Error executing command: ${errMsg}` });
    }
  }
  return {
    answer: "Maximum turns reached without final answer",
    turns: dynamicLimit,
    commands,
    success: false,
    error: "Max turns reached"
  };
}
function searchDocument(documentPath, pattern, options = {}) {
  const content = readFileSync4(documentPath, "utf-8");
  const flags = options.caseInsensitive ? "gi" : "g";
  const regex = new RegExp(pattern, flags);
  const lines = content.split("\n");
  const matches = [];
  let charIndex = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    const lineRegex = new RegExp(pattern, flags);
    while ((match = lineRegex.exec(line)) !== null) {
      matches.push({
        match: match[0],
        line,
        lineNum: lineNum + 1,
        index: charIndex + match.index,
        groups: match.slice(1)
      });
      if (options.maxResults && matches.length >= options.maxResults) {
        return matches;
      }
    }
    charIndex += line.length + 1;
  }
  return matches;
}

// src/providers/index.ts
init_esm_shims();

// src/providers/openai-compatible.ts
init_esm_shims();
var OpenAICompatibleProvider = class {
  name;
  config;
  constructor(name, config) {
    this.name = name;
    this.config = config;
    if (!config.apiKey) {
      throw new Error(`API key is required for ${name} provider`);
    }
    if (!config.baseUrl) {
      throw new Error(`Base URL is required for ${name} provider`);
    }
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/chat/completions`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...options?.stopSequences && { stop: options.stopSequences }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const choice = data.choices[0];
    return {
      content: choice.message.content || "",
      finishReason: choice.finish_reason === "stop" ? "stop" : choice.finish_reason === "length" ? "length" : "error",
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : void 0
    };
  }
  async healthCheck() {
    try {
      const result = await this.complete([
        { role: "user", content: 'Say "ok"' }
      ], { maxTokens: 10 });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
};
function createZAIProvider(config) {
  return new OpenAICompatibleProvider("ZAI", {
    ...config,
    baseUrl: config.baseUrl || "https://api.z.ai/api/coding/paas/v4",
    model: config.model || "glm-4.7"
  });
}
function createOpenAIProvider(config) {
  return new OpenAICompatibleProvider("OpenAI", {
    ...config,
    baseUrl: config.baseUrl || "https://api.openai.com/v1",
    model: config.model || "gpt-4o"
  });
}
function createDeepSeekProvider(config) {
  return new OpenAICompatibleProvider("DeepSeek", {
    ...config,
    baseUrl: config.baseUrl || "https://api.deepseek.com",
    model: config.model || "deepseek-chat"
  });
}

// src/providers/ollama.ts
init_esm_shims();
var OllamaProvider = class {
  name = "Ollama";
  config;
  constructor(config) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "http://localhost:11434",
      model: config.model || "qwen2.5-coder:7b"
    };
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/api/chat`;
    const body = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stream: false,
      options: {
        temperature: options?.temperature ?? this.config.options?.temperature ?? 0.2,
        num_ctx: this.config.options?.num_ctx ?? 8192
      }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return {
      content: data.message.content || "",
      finishReason: data.done ? "stop" : "error",
      usage: data.eval_count ? {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + data.eval_count
      } : void 0
    };
  }
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json();
      const hasModel = data.models.some(
        (m) => m.name === this.config.model || m.name.startsWith(this.config.model + ":")
      );
      return hasModel;
    } catch {
      return false;
    }
  }
  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }
};
function createOllamaProvider(config) {
  return new OllamaProvider(config);
}

// src/providers/anthropic.ts
init_esm_shims();
var AnthropicProvider = class {
  name = "Anthropic";
  config;
  constructor(config) {
    if (!config.apiKey) {
      throw new Error("API key is required for Anthropic provider");
    }
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "https://api.anthropic.com",
      model: config.model || "claude-sonnet-4-20250514"
    };
  }
  async complete(messages, options) {
    const endpoint = `${this.config.baseUrl}/v1/messages`;
    const systemMessage = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const body = {
      model: this.config.model,
      max_tokens: options?.maxTokens ?? this.config.options?.max_tokens ?? 4096,
      ...systemMessage && { system: systemMessage.content },
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      ...options?.temperature !== void 0 && { temperature: options.temperature },
      ...options?.stopSequences && { stop_sequences: options.stopSequences }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const textContent = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    return {
      content: textContent,
      finishReason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason === "max_tokens" ? "length" : "error",
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }
  async healthCheck() {
    try {
      const result = await this.complete([
        { role: "user", content: 'Say "ok"' }
      ], { maxTokens: 10 });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
};
function createAnthropicProvider(config) {
  return new AnthropicProvider(config);
}

// src/providers/index.ts
function createProvider(config) {
  const providerType = config.provider;
  const providerConfig = config.providers[providerType];
  if (!providerConfig) {
    throw new Error(`No configuration found for provider: ${providerType}`);
  }
  return createProviderByType(providerType, providerConfig);
}
function createProviderByType(type, config) {
  switch (type) {
    case "zai":
      return createZAIProvider(config);
    case "openai":
      return createOpenAIProvider(config);
    case "deepseek":
      return createDeepSeekProvider(config);
    case "ollama":
      return createOllamaProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
function getProviderDisplayName(type) {
  switch (type) {
    case "zai":
      return "ZAI (GLM)";
    case "openai":
      return "OpenAI";
    case "deepseek":
      return "DeepSeek";
    case "ollama":
      return "Ollama (Local)";
    case "anthropic":
      return "Anthropic (Claude)";
    default:
      return type;
  }
}
function listProviderTypes() {
  return ["zai", "anthropic", "openai", "deepseek", "ollama"];
}

// src/cli.ts
init_onboarding();
var program = new Command();
program.name("argus").description("Codebase Intelligence Beyond Context Limits").version("2.0.3");
program.command("init").description("Interactive setup wizard").action(async () => {
  console.log("\n\u{1F52E} Argus Setup Wizard\n");
  console.log("This will configure your AI provider and create ~/.argus/config.json\n");
  const inquirer = await import("inquirer");
  const providers = listProviderTypes();
  const providerChoices = providers.map((p) => ({
    name: `${getProviderDisplayName(p)} - ${getProviderDescription(p)}`,
    value: p
  }));
  const answers = await inquirer.default.prompt([
    {
      type: "list",
      name: "provider",
      message: "Select your AI provider:",
      choices: providerChoices
    },
    {
      type: "input",
      name: "apiKey",
      message: "Enter your API key:",
      when: (ans) => ans.provider !== "ollama",
      validate: (input) => input.length > 0 || "API key is required"
    },
    {
      type: "input",
      name: "model",
      message: "Enter model name (leave empty for default):",
      default: (ans) => PROVIDER_DEFAULTS[ans.provider]?.model || ""
    },
    {
      type: "input",
      name: "baseUrl",
      message: "Enter custom base URL (leave empty for default):",
      when: (ans) => ans.provider === "ollama",
      default: "http://localhost:11434"
    }
  ]);
  const config = {
    provider: answers.provider,
    providers: {
      [answers.provider]: {
        ...answers.apiKey && { apiKey: answers.apiKey },
        ...answers.baseUrl && { baseUrl: answers.baseUrl },
        model: answers.model || PROVIDER_DEFAULTS[answers.provider]?.model || "",
        ...PROVIDER_DEFAULTS[answers.provider]
      }
    },
    defaults: {
      maxTurns: 15,
      turnTimeoutMs: 6e4,
      snapshotExtensions: ["ts", "tsx", "js", "jsx", "rs", "py", "go", "java", "rb", "php", "md"],
      excludePatterns: ["node_modules", ".git", "target", "dist", "build", ".next"]
    }
  };
  saveConfig(config);
  console.log(`
\u2705 Configuration saved to ${getConfigPath()}`);
  console.log("\n\u{1F50D} Testing connection...");
  try {
    const provider = createProvider(config);
    const healthy = await provider.healthCheck();
    if (healthy) {
      console.log("\u2705 Connection successful!\n");
    } else {
      console.log("\u26A0\uFE0F  Connection test failed. Please check your configuration.\n");
    }
  } catch (error) {
    console.log(`\u26A0\uFE0F  Connection test failed: ${error instanceof Error ? error.message : error}
`);
  }
  console.log("Next steps:");
  console.log("  argus snapshot ./my-project -o snapshot.txt");
  console.log('  argus analyze snapshot.txt "What are the main modules?"');
  console.log("  argus mcp install  # Add to Claude Code");
});
program.command("update").description("Update Argus to the latest version").action(() => {
  console.log("\n\u{1F504} Updating Argus...\n");
  try {
    execSync2("npm install -g https://github.com/sashabogi/argus/tarball/main", { stdio: "inherit" });
    console.log("\n\u2705 Argus updated successfully!");
    console.log("\nRun `argus --version` to check the new version.");
  } catch (error) {
    console.error("\n\u274C Update failed. Try manually:");
    console.error("   npm install -g https://github.com/sashabogi/argus/tarball/main");
    process.exit(1);
  }
});
program.command("analyze <path> <query>").description("Analyze a codebase or snapshot with AI").option("-p, --provider <provider>", "Override default provider").option("-t, --max-turns <n>", "Maximum reasoning turns", "15").option("-v, --verbose", "Show detailed execution logs").action(async (path3, query, opts) => {
  const config = loadConfig();
  if (opts.provider) {
    config.provider = opts.provider;
  }
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\nRun `argus init` to configure.");
    process.exit(1);
  }
  const resolvedPath = resolve(path3);
  if (!existsSync4(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }
  let snapshotPath = resolvedPath;
  let tempSnapshot = false;
  const stats = statSync2(resolvedPath);
  if (stats.isDirectory()) {
    console.log("\u{1F4F8} Creating snapshot of codebase...");
    snapshotPath = join4(homedir2(), ".argus", `temp-${Date.now()}.txt`);
    ensureConfigDir();
    const result = createEnhancedSnapshot(resolvedPath, snapshotPath, {
      extensions: config.defaults.snapshotExtensions,
      excludePatterns: config.defaults.excludePatterns
    });
    console.log(`   ${result.fileCount} files, ${formatSize(result.totalSize)} (enhanced)`);
    tempSnapshot = true;
  }
  console.log(`
\u{1F50D} Analyzing with ${getProviderDisplayName(config.provider)}...`);
  console.log(`   Query: ${query}
`);
  try {
    const provider = createProvider(config);
    const result = await analyze(provider, snapshotPath, query, {
      maxTurns: parseInt(opts.maxTurns),
      verbose: opts.verbose,
      onProgress: (turn, cmd) => {
        if (!opts.verbose) {
          process.stdout.write(`\r   Turn ${turn}: ${cmd.slice(0, 50)}...`);
        }
      }
    });
    if (!opts.verbose) {
      console.log("\n");
    }
    if (result.success) {
      console.log("\u{1F4CB} Answer:\n");
      console.log(result.answer);
      console.log(`
(${result.turns} turns, ${result.commands.length} commands)`);
    } else {
      console.log("\u26A0\uFE0F  Analysis incomplete:");
      console.log(result.answer);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }
  } finally {
    if (tempSnapshot && existsSync4(snapshotPath)) {
      unlinkSync(snapshotPath);
    }
  }
});
program.command("snapshot <path>").description("Create a codebase snapshot for analysis").option("-o, --output <file>", "Output file path").option("-e, --extensions <exts>", "File extensions to include (comma-separated)").option("--exclude <patterns>", "Patterns to exclude (comma-separated)").option("--basic", "Skip structural metadata (faster, smaller snapshot)").action((path3, opts) => {
  const config = loadConfig();
  const resolvedPath = resolve(path3);
  if (!existsSync4(resolvedPath)) {
    console.error(`Path not found: ${resolvedPath}`);
    process.exit(1);
  }
  const outputPath = opts.output || `${basename2(resolvedPath)}-snapshot.txt`;
  console.log("\u{1F4F8} Creating codebase snapshot...");
  console.log(`   Source: ${resolvedPath}`);
  console.log(`   Output: ${outputPath}`);
  const extensions = opts.extensions ? opts.extensions.split(",").map((e) => e.trim()) : config.defaults.snapshotExtensions;
  const excludePatterns = opts.exclude ? opts.exclude.split(",").map((p) => p.trim()) : config.defaults.excludePatterns;
  if (opts.basic) {
    console.log("   Mode: Basic (no structural metadata)");
  } else {
    console.log("   Mode: Enhanced (with import graph & exports index)");
  }
  const result = opts.basic ? createSnapshot(resolvedPath, outputPath, { extensions, excludePatterns }) : createEnhancedSnapshot(resolvedPath, outputPath, { extensions, excludePatterns });
  console.log(`
\u2705 Snapshot created!`);
  console.log(`   Files: ${result.fileCount}`);
  console.log(`   Lines: ${result.totalLines.toLocaleString()}`);
  console.log(`   Size: ${formatSize(result.totalSize)}`);
  if (!opts.basic && "metadata" in result) {
    const meta = result.metadata;
    console.log(`
\u{1F4CA} Structural Metadata:`);
    console.log(`   Imports tracked: ${meta.imports.length}`);
    console.log(`   Exports indexed: ${meta.exports.length}`);
    console.log(`   Symbols indexed: ${Object.keys(meta.symbolIndex).length}`);
  }
  console.log(`
Analyze with:`);
  console.log(`   argus analyze ${outputPath} "Your query here"`);
});
program.command("query <snapshot> <query>").description("Query an existing snapshot").option("-v, --verbose", "Show detailed execution logs").action(async (snapshot, query, opts) => {
  await program.commands.find((c) => c.name() === "analyze")?.parseAsync([
    snapshot,
    query,
    ...opts.verbose ? ["-v"] : []
  ], { from: "user" });
});
program.command("search <snapshot> <pattern>").description("Fast grep search (no AI)").option("-i, --ignore-case", "Case-insensitive search").option("-n, --max-results <n>", "Maximum results", "50").action((snapshot, pattern, opts) => {
  const resolvedPath = resolve(snapshot);
  if (!existsSync4(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }
  console.log(`\u{1F50D} Searching for: ${pattern}
`);
  const matches = searchDocument(resolvedPath, pattern, {
    caseInsensitive: opts.ignoreCase,
    maxResults: parseInt(opts.maxResults)
  });
  if (matches.length === 0) {
    console.log("No matches found.");
    return;
  }
  console.log(`Found ${matches.length} matches:
`);
  for (const match of matches) {
    console.log(`${match.lineNum}: ${match.line.trim()}`);
  }
});
program.command("status [path]").description("Check if snapshot is up to date").option("-s, --snapshot <file>", "Snapshot file to check", ".argus/snapshot.txt").action((path3, opts) => {
  const projectPath = path3 ? resolve(path3) : process.cwd();
  const snapshotPath = resolve(projectPath, opts.snapshot);
  console.log("\u{1F4CA} Argus Status\n");
  if (!existsSync4(snapshotPath)) {
    console.log("\u274C No snapshot found at:", snapshotPath);
    console.log("\nCreate one with:");
    console.log(`   argus snapshot ${projectPath} -o ${snapshotPath}`);
    return;
  }
  const snapshotStats = statSync2(snapshotPath);
  const snapshotAge = Date.now() - snapshotStats.mtimeMs;
  const ageHours = Math.floor(snapshotAge / (1e3 * 60 * 60));
  const ageDays = Math.floor(ageHours / 24);
  console.log("Snapshot:", snapshotPath);
  console.log("Size:", formatSize(snapshotStats.size));
  if (ageDays > 0) {
    console.log("Age:", `${ageDays} day${ageDays > 1 ? "s" : ""} ago`);
  } else if (ageHours > 0) {
    console.log("Age:", `${ageHours} hour${ageHours > 1 ? "s" : ""} ago`);
  } else {
    console.log("Age:", "Less than an hour ago");
  }
  const config = loadConfig();
  let modifiedCount = 0;
  let newCount = 0;
  function checkDir(dir) {
    try {
      const entries = readdirSync2(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join4(dir, entry.name);
        if (config.defaults.excludePatterns.some((p) => fullPath.includes(p))) {
          continue;
        }
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = entry.name.split(".").pop() || "";
          if (config.defaults.snapshotExtensions.includes(ext)) {
            const fileStats = statSync2(fullPath);
            if (fileStats.mtimeMs > snapshotStats.mtimeMs) {
              modifiedCount++;
            }
            if (fileStats.birthtimeMs > snapshotStats.mtimeMs) {
              newCount++;
            }
          }
        }
      }
    } catch {
    }
  }
  checkDir(projectPath);
  console.log("\nChanges since snapshot:");
  if (modifiedCount === 0 && newCount === 0) {
    console.log("   \u2705 No changes detected - snapshot is current");
  } else {
    if (newCount > 0) {
      console.log(`   \u{1F4C4} ${newCount} new file${newCount > 1 ? "s" : ""}`);
    }
    if (modifiedCount > newCount) {
      console.log(`   \u270F\uFE0F  ${modifiedCount - newCount} modified file${modifiedCount - newCount > 1 ? "s" : ""}`);
    }
    console.log("\n\u26A0\uFE0F  Snapshot may be stale. Refresh with:");
    console.log(`   argus snapshot ${projectPath} -o ${snapshotPath}`);
  }
  if (ageDays >= 7) {
    console.log("\n\u{1F4A1} Tip: Snapshot is over a week old. Consider refreshing.");
  }
});
var mcpCommand = program.command("mcp").description("Manage Claude Code MCP integration");
mcpCommand.command("install").description("Install Argus as an MCP server for Claude Code (global)").option("--no-claude-md", "Skip global CLAUDE.md injection").option("--no-onboarding", "Skip interactive onboarding").option("--reset-onboarding", "Re-run onboarding even if already completed").action(async (opts) => {
  let config = loadConfig();
  const shouldOnboard = opts.resetOnboarding || !config.onboardingComplete && opts.onboarding !== false;
  if (shouldOnboard) {
    try {
      const onboardingConfig = await runGlobalOnboarding();
      config.onboarding = onboardingConfig;
      config.onboardingComplete = true;
      saveConfig(config);
    } catch (error) {
      console.log("\n\u26A0\uFE0F  Interactive onboarding skipped (non-interactive terminal)");
      console.log("   Using default settings. Run `argus mcp install --reset-onboarding` to configure later.\n");
      config.onboarding = DEFAULT_ONBOARDING_CONFIG;
      config.onboardingComplete = true;
      saveConfig(config);
    }
  }
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error("Configuration errors - run `argus init` first:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  const wrapperPath = join4(homedir2(), ".argus", "argus-mcp-wrapper");
  const providerConfig = config.providers[config.provider];
  let envVars = "";
  if (providerConfig?.apiKey) {
    envVars += `export ARGUS_API_KEY="${providerConfig.apiKey}"
`;
  }
  if (providerConfig?.baseUrl) {
    envVars += `export ARGUS_BASE_URL="${providerConfig.baseUrl}"
`;
  }
  const wrapperScript = `#!/bin/bash
# Argus MCP Wrapper - Auto-generated
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
export ARGUS_PROVIDER="${config.provider}"
export ARGUS_MODEL="${providerConfig?.model || ""}"
${envVars}
exec argus-mcp "$@"
`;
  ensureConfigDir();
  writeFileSync4(wrapperPath, wrapperScript, { mode: 493 });
  try {
    execSync2(`claude mcp remove argus -s user 2>/dev/null || true`, { stdio: "ignore" });
    execSync2(`claude mcp add argus -s user -- "${wrapperPath}"`, { stdio: "inherit" });
    console.log("\n\u2705 Argus MCP server installed for Claude Code!");
  } catch {
    console.log("\n\u26A0\uFE0F  Could not automatically add to Claude Code.");
    console.log("Add manually by running:");
    console.log(`  claude mcp add argus -s user -- "${wrapperPath}"`);
  }
  if (opts.claudeMd !== false) {
    const globalClaudeMdPath = join4(homedir2(), ".claude", "CLAUDE.md");
    if (existsSync4(globalClaudeMdPath)) {
      let content = readFileSync5(globalClaudeMdPath, "utf-8");
      if (content.includes("## Codebase Intelligence (Argus)")) {
        console.log("\u2713  Global CLAUDE.md already has Argus section");
      } else {
        content += GLOBAL_CLAUDE_MD_ARGUS_SECTION;
        writeFileSync4(globalClaudeMdPath, content);
        console.log("\u2705 Added Argus section to global ~/.claude/CLAUDE.md");
        console.log("   \u2192 This applies to ALL projects and ALL sub-agents");
      }
    } else {
      const claudeDir = join4(homedir2(), ".claude");
      if (!existsSync4(claudeDir)) {
        mkdirSync2(claudeDir, { recursive: true });
      }
      writeFileSync4(globalClaudeMdPath, GLOBAL_CLAUDE_MD_ARGUS_SECTION.trim());
      console.log("\u2705 Created global ~/.claude/CLAUDE.md with Argus section");
    }
  }
  console.log("\n\u{1F4CB} Next: Run `argus setup .` in any project to create a snapshot");
});
mcpCommand.command("uninstall").description("Remove Argus from Claude Code").action(() => {
  try {
    execSync2("claude mcp remove argus -s user", { stdio: "inherit" });
    console.log("\n\u2705 Argus MCP server removed from Claude Code.");
  } catch {
    console.log("\n\u26A0\uFE0F  Could not remove from Claude Code.");
    console.log("Remove manually by running:");
    console.log("  claude mcp remove argus -s user");
  }
});
var contextCommand = program.command("context").description("Generate architectural context for CLAUDE.md (survives compaction)");
contextCommand.command("generate <path>").description("Generate architecture summary for a project").option("-o, --output <file>", "Output file (default: stdout)").option("-f, --format <format>", "Output format: markdown, json", "markdown").action(async (path3, opts) => {
  const config = loadConfig();
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error("Configuration errors - run `argus init` first:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  const resolvedPath = resolve(path3);
  if (!existsSync4(resolvedPath)) {
    console.error(`Path not found: ${resolvedPath}`);
    process.exit(1);
  }
  console.error("\u{1F4F8} Creating snapshot...");
  const snapshotPath = join4(homedir2(), ".argus", `context-${Date.now()}.txt`);
  ensureConfigDir();
  const snapshotResult = createEnhancedSnapshot(resolvedPath, snapshotPath, {
    extensions: config.defaults.snapshotExtensions,
    excludePatterns: config.defaults.excludePatterns
  });
  console.error(`   ${snapshotResult.fileCount} files, ${formatSize(snapshotResult.totalSize)} (enhanced)`);
  console.error("\u{1F9E0} Analyzing architecture...\n");
  try {
    const provider = createProvider(config);
    const moduleQuery = `List all the main directories/modules under src/ or the main source folder. 
For each module, based on its file names and code, describe its purpose in ONE sentence.
Format as a bullet list: - **module_name/** - description`;
    const moduleResult = await analyze(provider, snapshotPath, moduleQuery, {
      maxTurns: 10,
      onProgress: (turn) => {
        process.stderr.write(`\r   Analyzing modules (turn ${turn})...`);
      }
    });
    console.error("\n");
    const patternQuery = `What are the main coding patterns and conventions used? Look for:
- Error handling approach
- State management
- API/data patterns
- Testing patterns
Keep it brief - one line per pattern.`;
    const patternResult = await analyze(provider, snapshotPath, patternQuery, {
      maxTurns: 8,
      onProgress: (turn) => {
        process.stderr.write(`\r   Analyzing patterns (turn ${turn})...`);
      }
    });
    console.error("\n");
    const filesQuery = `What are the 5-10 most important files that a developer should understand first?
List with file paths and one-line descriptions.`;
    const filesResult = await analyze(provider, snapshotPath, filesQuery, {
      maxTurns: 8,
      onProgress: (turn) => {
        process.stderr.write(`\r   Finding key files (turn ${turn})...`);
      }
    });
    console.error("\n");
    const projectName = basename2(resolvedPath);
    const output = generateContextMarkdown(projectName, {
      modules: moduleResult.answer || "Unable to analyze modules",
      patterns: patternResult.answer || "Unable to analyze patterns",
      keyFiles: filesResult.answer || "Unable to identify key files",
      fileCount: snapshotResult.fileCount,
      lineCount: snapshotResult.totalLines
    });
    if (opts.output) {
      writeFileSync4(opts.output, output);
      console.error(`\u2705 Context saved to ${opts.output}`);
    } else {
      console.log(output);
    }
  } finally {
    if (existsSync4(snapshotPath)) {
      unlinkSync(snapshotPath);
    }
  }
});
contextCommand.command("inject <path>").description("Add/update architecture section in CLAUDE.md").action(async (path3) => {
  const resolvedPath = resolve(path3);
  const claudeMdPath = join4(resolvedPath, "CLAUDE.md");
  console.error("Generating context...\n");
  const { execSync: execSync3 } = await import("child_process");
  try {
    const contextOutput = execSync3(
      `argus context generate "${resolvedPath}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    const marker = "<!-- ARGUS:CONTEXT -->";
    const endMarker = "<!-- /ARGUS:CONTEXT -->";
    const wrappedContext = `${marker}
${contextOutput}
${endMarker}`;
    if (existsSync4(claudeMdPath)) {
      let existing = readFileSync5(claudeMdPath, "utf-8");
      const markerRegex = new RegExp(`${marker}[\\s\\S]*?${endMarker}`, "g");
      if (markerRegex.test(existing)) {
        existing = existing.replace(markerRegex, wrappedContext);
      } else {
        existing = existing.trim() + "\n\n" + wrappedContext;
      }
      writeFileSync4(claudeMdPath, existing);
      console.log(`\u2705 Updated ${claudeMdPath}`);
    } else {
      writeFileSync4(claudeMdPath, wrappedContext);
      console.log(`\u2705 Created ${claudeMdPath}`);
    }
    console.log("\nClaude Code will now have persistent architectural knowledge!");
    console.log("This section survives compaction and restarts.");
  } catch (error) {
    console.error("Failed to generate context:", error);
    process.exit(1);
  }
});
contextCommand.command("refresh <path>").description("Regenerate architecture context (run after major changes)").action(async (path3) => {
  const resolvedPath = resolve(path3);
  console.log("Refreshing codebase context...\n");
  execSync2(`argus context inject "${resolvedPath}"`, { stdio: "inherit" });
});
function generateContextMarkdown(projectName, data) {
  return `## Codebase Intelligence (Auto-generated by Argus)

> **This section provides architectural context that survives context compaction.**
> Regenerate with: \`argus context refresh .\`

### Project: ${projectName}
- **Files:** ${data.fileCount}
- **Lines:** ${data.lineCount.toLocaleString()}

### Module Structure

${data.modules}

### Key Patterns & Conventions

${data.patterns}

### Important Files to Understand

${data.keyFiles}

### Using Argus for On-Demand Queries

When you need more specific information about this codebase:

\`\`\`bash
# Find where something is implemented
argus analyze . "Where is authentication handled?"

# Understand a specific module
argus analyze . "What does the cognition/ module do?"

# Find code patterns
argus search .argus/snapshot.txt "async fn.*Result"
\`\`\`

### After Compaction Checklist

If your context was compacted or you're starting fresh:
1. \u2705 This architecture section is still available (you're reading it)
2. Query @argus for specific questions about the codebase
3. Don't re-scan the entire codebase - use targeted queries

`;
}
program.command("config [key] [value]").description("View or modify configuration").action((key, value) => {
  const config = loadConfig();
  if (!key) {
    console.log("Current configuration:\n");
    console.log(JSON.stringify(config, null, 2));
    console.log(`
Config file: ${getConfigPath()}`);
    return;
  }
  if (!value) {
    const parts2 = key.split(".");
    let current2 = config;
    for (const part of parts2) {
      if (current2 && typeof current2 === "object" && part in current2) {
        current2 = current2[part];
      } else {
        console.error(`Key not found: ${key}`);
        process.exit(1);
      }
    }
    console.log(JSON.stringify(current2, null, 2));
    return;
  }
  const parts = key.split(".");
  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  try {
    current[parts[parts.length - 1]] = JSON.parse(value);
  } catch {
    current[parts[parts.length - 1]] = value;
  }
  saveConfig(config);
  console.log(`\u2705 Set ${key} = ${value}`);
});
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getProviderDescription(provider) {
  switch (provider) {
    case "zai":
      return "GLM-4.7, best value for code";
    case "anthropic":
      return "Claude, highest quality";
    case "openai":
      return "GPT-4o, general purpose";
    case "deepseek":
      return "Budget-friendly";
    case "ollama":
      return "Free, local, private";
    default:
      return "";
  }
}
var GLOBAL_CLAUDE_MD_ARGUS_SECTION = `

## Codebase Intelligence (Argus) \u2014 ALL AGENTS

> **This applies to the main session AND all sub-agents/tasks regardless of type.**

### The Rule: Argus Before Multi-File Exploration

**Before reading more than 3 files to understand a codebase, use Argus MCP tools:**

1. **Check for snapshot**: Look for \`.argus/snapshot.txt\` in the project
2. **Search first** (FREE): \`search_codebase(".argus/snapshot.txt", "pattern")\`
3. **Understand if needed** (~500 tokens): \`analyze_codebase(".argus/snapshot.txt", "How does X work?")\`
4. **Then read specific files**: Only the files Argus identified as relevant

### Why This Matters

| Without Argus | With Argus |
|---------------|------------|
| Read 15+ files = 5,000-50,000 tokens | search \u2192 read 2 files = 100-500 tokens |
| Slow, expensive, loses context | Fast, cheap, efficient |

### For Sub-Agents

If you are a sub-agent (coder, tester, reviewer, debugger, or ANY other type):
1. Check if \`.argus/snapshot.txt\` exists in the project
2. If exploring the codebase, use \`search_codebase\` first (it's free)
3. This rule applies regardless of your specific role or instructions

### Quick Reference

| Tool | Cost | Use For |
|------|------|---------|
| \`search_codebase\` | FREE | Finding files, patterns, definitions |
| \`analyze_codebase\` | ~500 tokens | Architecture questions, understanding flows |

### No Snapshot?

If \`.argus/snapshot.txt\` doesn't exist, proceed normally with native tools.
The user can create one with: \`argus setup .\`
`;
var CLAUDE_MD_ARGUS_SECTION = `
## Codebase Intelligence (Argus) \u2014 APPLIES TO ALL AGENTS

> **This section applies to the main conversation AND all sub-agents/tasks.**
> Any agent exploring the codebase should use Argus tools.

### The Rule: Argus Before Multi-File Exploration

**Before reading more than 3 files to understand the codebase, use Argus MCP tools:**

\`\`\`
# Step 1: Search (FREE, instant)
search_codebase(".argus/snapshot.txt", "pattern-or-keyword")

# Step 2: If needed, understand architecture (~500 tokens)  
analyze_codebase(".argus/snapshot.txt", "How does X work?")

# Step 3: Read only the specific files you need
Read(the-file-you-found.ts)
\`\`\`

### Why This Matters

| Approach | Tokens | Speed |
|----------|--------|-------|
| Read 15 files to find something | 5,000-50,000 | Slow |
| search_codebase \u2192 Read 2 files | 100-500 | Fast |

### Available Tools

| Tool | Use For | Cost |
|------|---------|------|
| \`search_codebase\` | Find files, patterns, definitions | **FREE** |
| \`analyze_codebase\` | Architecture, "how does X work" | ~500 tokens |
| \`create_snapshot\` | Refresh after major changes | ~100 tokens |

### When to Use What

**Use Argus (\`.argus/snapshot.txt\`) for:**
- Finding where something is defined or used
- Understanding how modules connect
- Debugging: "where is this function called?"
- Architecture questions
- After context compaction

**Use native Read/Search for:**
- Single file you already know
- Quick edits to known locations
- Files you just created

### For Sub-Agents / Background Tasks

If you are a sub-agent or background task:
1. Check if \`.argus/snapshot.txt\` exists
2. Use \`search_codebase\` before reading multiple files
3. This applies regardless of your specific role (coder, tester, reviewer, etc.)

### Keeping Updated

\`\`\`bash
argus status .                              # Check if stale
argus snapshot . -o .argus/snapshot.txt     # Refresh
\`\`\`
`;
program.command("setup [path]").description("Set up Argus for a project (snapshot + key files + CLAUDE.md + .gitignore)").option("--no-claude-md", "Skip CLAUDE.md injection").option("--no-gitignore", "Skip .gitignore update").option("--no-onboarding", "Skip interactive key file selection").action(async (pathArg, opts) => {
  const projectPath = pathArg ? resolve(pathArg) : process.cwd();
  console.log("\u{1F680} Setting up Argus for project...\n");
  console.log(`   Project: ${projectPath}
`);
  const config = loadConfig();
  const onboardingConfig = config.onboarding || DEFAULT_ONBOARDING_CONFIG;
  const argusDir = join4(projectPath, ".argus");
  if (!existsSync4(argusDir)) {
    mkdirSync2(argusDir, { recursive: true });
    console.log("\u2705 Created .argus/ directory");
  } else {
    console.log("\u2713  .argus/ directory exists");
  }
  let projectConfig = onboardingConfig.projects[projectPath];
  if (!projectConfig && opts.onboarding !== false) {
    try {
      projectConfig = await runProjectOnboarding(projectPath, onboardingConfig, fs, path2);
      config.onboarding = config.onboarding || DEFAULT_ONBOARDING_CONFIG;
      config.onboarding.projects[projectPath] = projectConfig;
      saveConfig(config);
      if (projectConfig.keyFiles.length > 0) {
        console.log(`
\u2705 Tracking ${projectConfig.keyFiles.length} key file(s) for this project`);
      }
    } catch {
      console.log("\n\u26A0\uFE0F  Interactive selection skipped (non-interactive terminal)");
      const detected = detectPotentialKeyFiles(projectPath, onboardingConfig.globalKeyPatterns, fs, path2);
      projectConfig = {
        keyFiles: detected.filter((d) => d.matchedPattern).map((d) => d.path),
        customPatterns: [],
        lastScanDate: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  } else if (projectConfig) {
    console.log(`\u2713  Using existing project configuration (${projectConfig.keyFiles.length} key files)`);
  }
  const snapshotPath = join4(argusDir, "snapshot.txt");
  console.log("\n\u{1F4F8} Creating codebase snapshot (enhanced)...");
  const result = createEnhancedSnapshot(projectPath, snapshotPath, {
    extensions: config.defaults.snapshotExtensions,
    excludePatterns: config.defaults.excludePatterns
  });
  console.log(`\u2705 Snapshot created: ${result.fileCount} files, ${result.totalLines.toLocaleString()} lines`);
  if ("metadata" in result) {
    console.log(`   Imports: ${result.metadata.imports.length} | Exports: ${result.metadata.exports.length} | Symbols: ${Object.keys(result.metadata.symbolIndex).length}`);
  }
  if (projectConfig && projectConfig.keyFiles.length > 0) {
    const keyFilesPath = join4(argusDir, "key-files.json");
    writeFileSync4(keyFilesPath, JSON.stringify({
      keyFiles: projectConfig.keyFiles,
      customPatterns: projectConfig.customPatterns,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2));
    console.log("\u2705 Saved key files list to .argus/key-files.json");
  }
  if (opts.gitignore !== false) {
    const gitignorePath = join4(projectPath, ".gitignore");
    let gitignoreContent = "";
    if (existsSync4(gitignorePath)) {
      gitignoreContent = readFileSync5(gitignorePath, "utf-8");
    }
    if (!gitignoreContent.includes(".argus")) {
      const addition = gitignoreContent.endsWith("\n") ? "" : "\n";
      writeFileSync4(gitignorePath, gitignoreContent + addition + "\n# Argus codebase intelligence\n.argus/\n");
      console.log("\u2705 Added .argus/ to .gitignore");
    } else {
      console.log("\u2713  .argus/ already in .gitignore");
    }
  }
  if (opts.claudeMd !== false) {
    const claudeMdPath = join4(projectPath, "CLAUDE.md");
    if (existsSync4(claudeMdPath)) {
      let claudeMdContent = readFileSync5(claudeMdPath, "utf-8");
      if (claudeMdContent.includes("Codebase Intelligence (Argus)")) {
        console.log("\u2713  CLAUDE.md already has Argus section");
      } else {
        const firstHeadingMatch = claudeMdContent.match(/^#[^#].*$/m);
        if (firstHeadingMatch && firstHeadingMatch.index !== void 0) {
          const afterFirstHeading = claudeMdContent.indexOf("\n## ", firstHeadingMatch.index + 1);
          if (afterFirstHeading > 0) {
            claudeMdContent = claudeMdContent.slice(0, afterFirstHeading) + "\n" + CLAUDE_MD_ARGUS_SECTION + "\n" + claudeMdContent.slice(afterFirstHeading);
          } else {
            claudeMdContent += "\n" + CLAUDE_MD_ARGUS_SECTION;
          }
        } else {
          claudeMdContent += "\n" + CLAUDE_MD_ARGUS_SECTION;
        }
        writeFileSync4(claudeMdPath, claudeMdContent);
        console.log("\u2705 Added Argus section to CLAUDE.md");
      }
    } else {
      const newClaudeMd = `# Project Intelligence

This project uses Argus for efficient codebase analysis.
${CLAUDE_MD_ARGUS_SECTION}`;
      writeFileSync4(claudeMdPath, newClaudeMd);
      console.log("\u2705 Created CLAUDE.md with Argus section");
    }
  }
  console.log("\n\u{1F389} Argus setup complete!\n");
  console.log("Next steps:");
  console.log("  1. Restart Claude Code to pick up CLAUDE.md changes");
  console.log("  2. Ask Claude about your codebase architecture");
  console.log("  3. Run `argus status` periodically to check if snapshot needs refresh");
  if (projectConfig && projectConfig.keyFiles.length > 0) {
    console.log(`
\u{1F4A1} Key files tracked for context restoration:`);
    projectConfig.keyFiles.slice(0, 5).forEach((f) => console.log(`   \u2022 ${f}`));
    if (projectConfig.keyFiles.length > 5) {
      console.log(`   ... and ${projectConfig.keyFiles.length - 5} more`);
    }
  }
});
program.command("ui").description("Open the Argus web UI for codebase visualization").option("-p, --port <port>", "Port to serve on", "3333").option("--no-open", "Do not open browser automatically").action(async (opts) => {
  const uiPath = join4(__dirname, "..", "packages", "ui");
  if (!existsSync4(join4(uiPath, "package.json"))) {
    console.error("Argus UI package not found.");
    console.error("\nThe UI package needs to be installed separately:");
    console.error("  cd packages/ui && npm install && npm run build");
    process.exit(1);
  }
  const distPath = join4(uiPath, "dist");
  const hasBuiltUI = existsSync4(distPath);
  console.log("Starting Argus UI...\n");
  try {
    if (hasBuiltUI) {
      console.log(`   Serving built UI from ${distPath}`);
      console.log(`   Open http://localhost:${opts.port} in your browser`);
      const http = await import("http");
      const mimeTypes = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml"
      };
      const server = http.createServer((req, res) => {
        let filePath = join4(distPath, req.url === "/" ? "index.html" : req.url || "");
        if (!existsSync4(filePath) && !filePath.includes(".")) {
          filePath = join4(distPath, "index.html");
        }
        if (existsSync4(filePath)) {
          const ext = path2.extname(filePath);
          const contentType = mimeTypes[ext] || "application/octet-stream";
          const content = readFileSync5(filePath);
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content);
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      });
      const port = parseInt(opts.port, 10);
      server.listen(port, () => {
        console.log(`
Argus UI running at http://localhost:${port}`);
        if (opts.open !== false) {
          const { spawn } = __require("child_process");
          const openUrl = `http://localhost:${port}`;
          const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          spawn(openCmd, [openUrl], { detached: true, stdio: "ignore" }).unref();
        }
      });
      process.on("SIGINT", () => {
        console.log("\n\nShutting down Argus UI...");
        server.close();
        process.exit(0);
      });
    } else {
      console.log(`   Running development server...`);
      console.log(`   Port: ${opts.port}`);
      const { spawn } = __require("child_process");
      const vite = spawn("npm", ["run", "dev", "--", "--port", opts.port], {
        cwd: uiPath,
        stdio: "inherit"
      });
      process.on("SIGINT", () => {
        vite.kill();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error("Failed to start UI server:", error);
    console.error("\nTry building the UI first:");
    console.error("  cd packages/ui && npm install && npm run build");
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=cli.mjs.map