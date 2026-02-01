import express, { Request, Response } from 'express';
import { SnapshotCache } from './cache.js';
import { ProjectWatcher } from './watcher.js';

const PORT = process.env.ARGUS_WORKER_PORT || 37778;

export function startWorker() {
  const app = express();
  const cache = new SnapshotCache({ maxSize: 5 });
  const watchers = new Map<string, ProjectWatcher>();

  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '2.0.0',
      cached: cache.size,
      watching: watchers.size,
    });
  });

  // Load snapshot into memory
  app.post('/snapshot/load', async (req: Request, res: Response) => {
    const { path } = req.body;
    try {
      const snapshot = await cache.load(path);
      res.json({
        success: true,
        fileCount: snapshot.fileCount,
        cached: true,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Search using cached snapshot
  app.post('/search', (req: Request, res: Response) => {
    const { path, pattern, options } = req.body;
    try {
      const results = cache.search(path, pattern, options || {});
      res.json(results);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get context from cached snapshot
  app.post('/context', (req: Request, res: Response) => {
    const { path, file, line, before, after } = req.body;
    try {
      const context = cache.getContext(path, file, line, before || 10, after || 10);
      res.json(context);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Notify of file changes
  app.post('/notify-change', (req: Request, res: Response) => {
    const { projectPath } = req.body;
    const snapshotPath = `${projectPath}/.argus/snapshot.txt`;
    cache.invalidate(snapshotPath);
    res.json({ invalidated: true });
  });

  // Start watching a project
  app.post('/watch', (req: Request, res: Response) => {
    const { projectPath, snapshotPath } = req.body;

    if (!watchers.has(projectPath)) {
      const watcher = new ProjectWatcher(projectPath, snapshotPath, () => {
        cache.invalidate(snapshotPath);
      });
      watchers.set(projectPath, watcher);
    }

    res.json({ watching: true, path: projectPath });
  });

  // Stop watching
  app.delete('/watch', (req: Request, res: Response) => {
    const { projectPath } = req.body;
    const watcher = watchers.get(projectPath);
    if (watcher) {
      watcher.close();
      watchers.delete(projectPath);
    }
    res.json({ watching: false });
  });

  const server = app.listen(PORT, () => {
    console.log(`Argus worker listening on port ${PORT}`);
  });

  return { app, server, cache, watchers };
}
