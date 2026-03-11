import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createIndex } from "pagefind";
const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
};
const DEFAULT_PACKAGE_MANAGER_COMMAND = ["pnpm"];
const DEFAULT_SITE_DIR = "docs-site";
const DEFAULT_OUTPUT_DIR = path.join("build", "client", "docs");
const DEFAULT_MOUNT_PATH = "/docs";
const DEFAULT_TEMP_ROOT = path.join("tmp", "haakco-vike-docusaurus");
const DEFAULT_PROXY_PORT = 3001;
const DEFAULT_DEBOUNCE_MS = 250;
const GENERATED_SITE_DIRS = [
    ".docusaurus",
    "build",
    ".cache",
    "node_modules",
];
const shouldIgnoreWatchPath = (siteDir, filePath) => {
    const relativePath = path.relative(siteDir, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        return true;
    }
    return GENERATED_SITE_DIRS.some((segment) => relativePath === segment ||
        relativePath.startsWith(`${segment}${path.sep}`));
};
const normalizeMountPath = (mountPath) => {
    if (mountPath === "/")
        return "/";
    return `/${mountPath.replace(/^\/+|\/+$/g, "")}`;
};
const resolveCommand = (command, cwd) => {
    if (command.length === 0) {
        throw new Error("packageManagerCommand must include at least one command segment.");
    }
    const [bin, ...args] = command;
    return { bin, args, cwd };
};
const runCommand = async (command, cwd, log) => {
    const { bin, args } = resolveCommand(command, cwd);
    await new Promise((resolve, reject) => {
        const child = spawn(bin, args, {
            cwd,
            stdio: "pipe",
            env: process.env,
        });
        child.stdout.on("data", (chunk) => {
            const text = chunk.toString().trim();
            if (text)
                log(text);
        });
        child.stderr.on("data", (chunk) => {
            const text = chunk.toString().trim();
            if (text)
                log(text);
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Command failed with exit code ${code}: ${bin} ${args.join(" ")}`));
        });
    });
};
const removeIfExists = async (targetPath) => {
    await fsp.rm(targetPath, { recursive: true, force: true });
};
const ensureDir = async (targetPath) => {
    await fsp.mkdir(targetPath, { recursive: true });
};
const copyDir = async (from, to) => {
    await removeIfExists(to);
    await ensureDir(path.dirname(to));
    await fsp.cp(from, to, { recursive: true });
};
const swapDirs = async (nextDir, liveDir) => {
    const backupDir = `${liveDir}.previous`;
    await removeIfExists(backupDir);
    if (fs.existsSync(liveDir)) {
        await fsp.rename(liveDir, backupDir);
    }
    try {
        await ensureDir(path.dirname(liveDir));
        await fsp.rename(nextDir, liveDir);
        await removeIfExists(backupDir);
    }
    catch (error) {
        if (fs.existsSync(backupDir) && !fs.existsSync(liveDir)) {
            await fsp.rename(backupDir, liveDir);
        }
        throw error;
    }
};
const createPagefindIndex = async (sitePath, log) => {
    const { index, errors } = await createIndex();
    if (!index) {
        throw new Error(`Pagefind service did not return an index: ${errors.join("; ")}`);
    }
    const indexingResult = await index.addDirectory({
        path: sitePath,
    });
    if (indexingResult.errors.length > 0) {
        throw new Error(`Pagefind directory indexing failed: ${indexingResult.errors.join("; ")}`);
    }
    const result = await index.writeFiles({
        outputPath: path.join(sitePath, "pagefind"),
    });
    if (result.errors.length > 0) {
        throw new Error(`Pagefind indexing failed: ${result.errors.join("; ")}`);
    }
    log(`Pagefind index written to ${result.outputPath}.`);
};
export const buildDocusaurusSite = async (options = {}) => {
    const rootDir = path.resolve(options.rootDir ?? process.cwd());
    const siteDir = path.resolve(rootDir, options.siteDir ?? DEFAULT_SITE_DIR);
    const liveOutputDir = path.resolve(rootDir, options.outputDir ?? DEFAULT_OUTPUT_DIR);
    const tempRootDir = path.resolve(rootDir, options.tempRootDir ?? DEFAULT_TEMP_ROOT);
    const packageManagerCommand = options.packageManagerCommand ?? DEFAULT_PACKAGE_MANAGER_COMMAND;
    const log = options.log ?? (() => { });
    await ensureDir(tempRootDir);
    const tempBuildDir = await fsp.mkdtemp(path.join(tempRootDir, "build-"));
    const docsBuildDir = path.join(tempBuildDir, "docusaurus-build");
    const docusaurusBuildDir = path.join(siteDir, "build");
    log(`Building Docusaurus from ${siteDir}`);
    await runCommand([...packageManagerCommand, "--dir", siteDir, "run", "build"], rootDir, log);
    await copyDir(docusaurusBuildDir, docsBuildDir);
    log(`Indexing Pagefind into ${docsBuildDir}`);
    await createPagefindIndex(docsBuildDir, log);
    await swapDirs(docsBuildDir, liveOutputDir);
    await removeIfExists(tempBuildDir);
    return { outputDir: liveOutputDir };
};
const getRequestPathname = (requestPath) => {
    try {
        return new URL(requestPath, "http://localhost").pathname;
    }
    catch {
        return requestPath.split("?")[0]?.split("#")[0] ?? requestPath;
    }
};
const tryServeStaticFile = (baseDir, requestPath, mountPath, res) => {
    const pathname = getRequestPathname(requestPath);
    let filePath = pathname.replace(new RegExp(`^${mountPath}`), "");
    if (!filePath || filePath === "/")
        filePath = "/index.html";
    const candidates = [
        path.join(baseDir, filePath),
        path.join(baseDir, filePath, "index.html"),
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
            continue;
        }
        const ext = path.extname(candidate);
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.end(fs.readFileSync(candidate));
        return true;
    }
    return false;
};
class DocsBuildManager {
    server;
    buildOptions;
    log;
    debounceMs;
    hooks;
    liveOutputDir;
    buildPromise = null;
    queuedReason = null;
    timer = null;
    constructor(server, options, log) {
        this.server = server;
        this.log = log;
        this.debounceMs = options.dev?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
        this.hooks = {
            watch: options.dev?.watch ?? true,
            debounceMs: this.debounceMs,
            proxyPort: options.dev?.proxyPort ?? DEFAULT_PROXY_PORT,
            ignoreGeneratedDirs: options.dev?.ignoreGeneratedDirs ?? true,
            onBuildStart: options.dev?.onBuildStart ?? (async () => { }),
            onBuildSuccess: options.dev?.onBuildSuccess ?? (async () => { }),
            onBuildFailure: options.dev?.onBuildFailure ?? (async () => { }),
        };
        this.buildOptions = {
            rootDir: options.rootDir,
            siteDir: options.siteDir,
            outputDir: options.outputDir,
            tempRootDir: options.tempRootDir,
            packageManagerCommand: options.packageManagerCommand,
            log,
        };
        const rootDir = path.resolve(options.rootDir ?? process.cwd());
        this.liveOutputDir = path.resolve(rootDir, options.outputDir ?? DEFAULT_OUTPUT_DIR);
    }
    get outputDir() {
        return this.liveOutputDir;
    }
    schedule(reason) {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.run(reason);
        }, this.debounceMs);
    }
    async run(reason) {
        if (this.buildPromise) {
            this.queuedReason = reason;
            return;
        }
        this.buildPromise = (async () => {
            await this.hooks.onBuildStart?.(reason);
            this.log(`Docs rebuild started: ${reason}`);
            try {
                const result = await buildDocusaurusSite(this.buildOptions);
                await this.hooks.onBuildSuccess?.(reason, result.outputDir);
                this.server.ws.send({ type: "full-reload" });
                this.log(`Docs rebuild completed: ${reason}`);
            }
            catch (error) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                await this.hooks.onBuildFailure?.(reason, normalizedError);
                this.log(`Docs rebuild failed: ${normalizedError.message}`);
            }
            finally {
                this.buildPromise = null;
                if (this.queuedReason) {
                    const nextReason = this.queuedReason;
                    this.queuedReason = null;
                    this.schedule(nextReason);
                }
            }
        })();
        await this.buildPromise;
    }
}
export const vikePluginDocusaurus = (options = {}) => {
    const rootDir = path.resolve(options.rootDir ?? process.cwd());
    const siteDir = path.resolve(rootDir, options.siteDir ?? DEFAULT_SITE_DIR);
    const mountPath = normalizeMountPath(options.mountPath ?? DEFAULT_MOUNT_PATH);
    const proxyPort = options.dev?.proxyPort ?? DEFAULT_PROXY_PORT;
    let buildManager = null;
    const log = (message) => {
        console.log(`[haakco:vike-plugin-docusaurus] ${message}`);
    };
    return {
        name: "haakco-vike-plugin-docusaurus",
        apply: "serve",
        configureServer(server) {
            buildManager = new DocsBuildManager(server, options, log);
            if (options.dev?.watch !== false) {
                server.watcher.add(siteDir);
                if (options.dev?.ignoreGeneratedDirs !== false) {
                    const generatedDirs = GENERATED_SITE_DIRS.map((dirName) => path.join(siteDir, dirName));
                    server.watcher.unwatch(generatedDirs);
                }
                server.watcher.on("add", (filePath) => {
                    if (!shouldIgnoreWatchPath(siteDir, filePath)) {
                        buildManager?.schedule(`added ${path.relative(siteDir, filePath)}`);
                    }
                });
                server.watcher.on("change", (filePath) => {
                    if (!shouldIgnoreWatchPath(siteDir, filePath)) {
                        buildManager?.schedule(`changed ${path.relative(siteDir, filePath)}`);
                    }
                });
                server.watcher.on("unlink", (filePath) => {
                    if (!shouldIgnoreWatchPath(siteDir, filePath)) {
                        buildManager?.schedule(`removed ${path.relative(siteDir, filePath)}`);
                    }
                });
            }
            void buildManager.run("startup");
            server.middlewares.use((req, res, next) => {
                const url = req.originalUrl ?? req.url ?? "";
                if (!url.startsWith(mountPath))
                    return next();
                if (buildManager &&
                    tryServeStaticFile(buildManager.outputDir, url, mountPath, res)) {
                    return;
                }
                if (proxyPort != null) {
                    const proxyReq = http.request({
                        hostname: "localhost",
                        port: proxyPort,
                        path: url,
                        method: req.method,
                        headers: req.headers,
                    }, (proxyRes) => {
                        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
                        proxyRes.pipe(res);
                    });
                    proxyReq.on("error", () => {
                        res.writeHead(503, { "Content-Type": "text/html" });
                        res.end(`<h1>Docs not available</h1><p>Docs are still building. You can also run a standalone Docusaurus dev server on port ${proxyPort}.</p>`);
                    });
                    req.pipe(proxyReq);
                    return;
                }
                res.writeHead(503, { "Content-Type": "text/html" });
                res.end("<h1>Docs not available</h1><p>Docs are still building.</p>");
            });
        },
    };
};
export { createPagefindSearchClient, enablePagefindHighlighting, } from "./search.js";
