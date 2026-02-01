import { watch, FSWatcher } from 'fs';

export class ProjectWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private changedFiles: Set<string> = new Set();

  constructor(
    private projectPath: string,
    private snapshotPath: string,
    private onUpdate: (changedFiles: string[]) => void,
    private debounceMs: number = 1000
  ) {
    this.start();
  }

  private start(): void {
    try {
      this.watcher = watch(this.projectPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Skip common noise
        if (
          filename.includes('node_modules') ||
          filename.includes('.git') ||
          filename.includes('.argus')
        ) {
          return;
        }

        this.changedFiles.add(filename);
        this.scheduleUpdate();
      });
    } catch (error) {
      console.error(`Failed to watch ${this.projectPath}:`, error);
    }
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.changedFiles);
      this.changedFiles.clear();
      this.onUpdate(files);
    }, this.debounceMs);
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
