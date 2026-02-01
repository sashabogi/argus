import { useMemo, useState } from 'react';
import type { ImportEdge, FileInfo } from '../types';

interface DependencyAnalysisProps {
  files: FileInfo[];
  imports: ImportEdge[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}

type SortField = 'path' | 'count';
type SortDirection = 'asc' | 'desc';

interface AnalysisRow {
  path: string;
  count: number;
  lines?: number;
}

interface CircularDep {
  cycle: string[];
}

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function AnalysisTable({
  title,
  description,
  rows,
  onFileSelect,
  selectedFile,
  countLabel,
  emptyMessage,
}: {
  title: string;
  description: string;
  rows: AnalysisRow[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
  countLabel: string;
  emptyMessage: string;
}) {
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'count') {
        return (a.count - b.count) * multiplier;
      }
      return a.path.localeCompare(b.path) * multiplier;
    });
  }, [rows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'count' ? 'desc' : 'asc');
    }
  };

  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 text-argus-accent">
        {sortDirection === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  return (
    <div className="panel">
      <div className="panel-header flex justify-between items-center">
        <span>{title}</span>
        <span className="text-xs font-normal normal-case tracking-normal">
          {rows.length} items
        </span>
      </div>
      <p className="px-4 py-2 text-xs text-argus-muted border-b border-argus-border">
        {description}
      </p>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-argus-muted">{emptyMessage}</div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-argus-dark">
              <tr className="border-b border-argus-border">
                <th
                  className="text-left px-4 py-2 text-argus-muted font-medium cursor-pointer hover:text-argus-text transition-colors"
                  onClick={() => handleSort('path')}
                >
                  File
                  <SortIcon field="path" />
                </th>
                <th
                  className="text-right px-4 py-2 text-argus-muted font-medium cursor-pointer hover:text-argus-text transition-colors w-32"
                  onClick={() => handleSort('count')}
                >
                  {countLabel}
                  <SortIcon field="count" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.path}
                  className={`border-b border-argus-border/50 cursor-pointer transition-colors ${
                    selectedFile === row.path
                      ? 'bg-argus-accent/10'
                      : 'hover:bg-argus-dark'
                  }`}
                  onClick={() => onFileSelect?.(row.path)}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-argus-text truncate"
                        title={row.path}
                      >
                        {getFileName(row.path)}
                      </span>
                      <span className="text-argus-muted text-xs truncate hidden sm:inline">
                        {row.path.replace(getFileName(row.path), '')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-argus-darker rounded-full overflow-hidden">
                        <div
                          className="h-full bg-argus-accent rounded-full"
                          style={{
                            width: `${(row.count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-argus-accent w-8 text-right">
                        {row.count}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CircularDepsTable({
  cycles,
  onFileSelect,
}: {
  cycles: CircularDep[];
  onFileSelect?: (path: string) => void;
}) {
  if (cycles.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header flex justify-between items-center">
          <span>Circular Dependencies</span>
          <span className="text-argus-green text-xs font-normal normal-case tracking-normal">
            None detected
          </span>
        </div>
        <p className="px-4 py-2 text-xs text-argus-muted border-b border-argus-border">
          Import cycles that may cause issues
        </p>
        <div className="p-4 text-sm text-argus-green">
          No circular dependencies found. Your import graph is acyclic.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header flex justify-between items-center">
        <span>Circular Dependencies</span>
        <span className="text-argus-red text-xs font-normal normal-case tracking-normal">
          {cycles.length} cycle{cycles.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <p className="px-4 py-2 text-xs text-argus-muted border-b border-argus-border">
        Import cycles that may cause issues - consider refactoring
      </p>
      <div className="max-h-64 overflow-y-auto p-4 space-y-3">
        {cycles.map((cycle, i) => (
          <div
            key={i}
            className="bg-argus-darker border border-argus-red/30 rounded p-3"
          >
            <div className="flex flex-wrap items-center gap-1 text-sm font-mono">
              {cycle.cycle.map((file, j) => (
                <span key={j} className="flex items-center">
                  <button
                    className="text-argus-text hover:text-argus-accent transition-colors"
                    onClick={() => onFileSelect?.(file)}
                    title={file}
                  >
                    {getFileName(file)}
                  </button>
                  {j < cycle.cycle.length - 1 && (
                    <span className="text-argus-red mx-1">{'\u2192'}</span>
                  )}
                </span>
              ))}
              <span className="text-argus-red mx-1">{'\u21BA'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DependencyAnalysis({
  files,
  imports,
  onFileSelect,
  selectedFile,
}: DependencyAnalysisProps) {
  // Build a set of all file paths for quick lookup
  const fileSet = useMemo(() => new Set(files.map((f) => f.path)), [files]);

  // Build normalized import graph (source -> targets, target -> sources)
  const { importers, dependencies } = useMemo(() => {
    const importersMap = new Map<string, Set<string>>();
    const depsMap = new Map<string, Set<string>>();

    // Initialize all files
    for (const file of files) {
      importersMap.set(file.path, new Set());
      depsMap.set(file.path, new Set());
    }

    // Process imports
    for (const imp of imports) {
      // Only count if both source and target exist in our file list
      if (fileSet.has(imp.source) && fileSet.has(imp.target)) {
        // source imports target, so:
        // - target is imported BY source (target has source as an importer)
        // - source depends ON target (source has target as a dependency)
        importersMap.get(imp.target)?.add(imp.source);
        depsMap.get(imp.source)?.add(imp.target);
      }
    }

    return { importers: importersMap, dependencies: depsMap };
  }, [files, imports, fileSet]);

  // Entry Points: files not imported by anyone
  const entryPoints = useMemo<AnalysisRow[]>(() => {
    const entries: AnalysisRow[] = [];
    for (const file of files) {
      const importerCount = importers.get(file.path)?.size || 0;
      if (importerCount === 0) {
        entries.push({
          path: file.path,
          count: dependencies.get(file.path)?.size || 0,
          lines: file.lines,
        });
      }
    }
    return entries.sort((a, b) => b.count - a.count);
  }, [files, importers, dependencies]);

  // Most Imported: files sorted by number of importers
  const mostImported = useMemo<AnalysisRow[]>(() => {
    const rows: AnalysisRow[] = [];
    for (const file of files) {
      const importerCount = importers.get(file.path)?.size || 0;
      if (importerCount > 0) {
        rows.push({
          path: file.path,
          count: importerCount,
          lines: file.lines,
        });
      }
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, 50);
  }, [files, importers]);

  // Highest Coupling: files sorted by number of dependencies
  const highestCoupling = useMemo<AnalysisRow[]>(() => {
    const rows: AnalysisRow[] = [];
    for (const file of files) {
      const depCount = dependencies.get(file.path)?.size || 0;
      if (depCount > 0) {
        rows.push({
          path: file.path,
          count: depCount,
          lines: file.lines,
        });
      }
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, 50);
  }, [files, dependencies]);

  // Detect circular dependencies using DFS
  const circularDeps = useMemo<CircularDep[]>(() => {
    const cycles: CircularDep[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];

    function dfs(node: string): void {
      visited.add(node);
      recursionStack.add(node);
      pathStack.push(node);

      const deps = dependencies.get(node) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle - extract it
          const cycleStart = pathStack.indexOf(dep);
          if (cycleStart !== -1) {
            const cycle = pathStack.slice(cycleStart);
            // Only add if we haven't seen this cycle before (check by sorting)
            const cycleKey = [...cycle].sort().join('|');
            const existing = cycles.find(
              (c) => [...c.cycle].sort().join('|') === cycleKey
            );
            if (!existing) {
              cycles.push({ cycle });
            }
          }
        }
      }

      pathStack.pop();
      recursionStack.delete(node);
    }

    for (const file of files) {
      if (!visited.has(file.path)) {
        dfs(file.path);
      }
    }

    return cycles;
  }, [files, dependencies]);

  if (files.length === 0) {
    return (
      <div className="p-6 text-argus-muted text-sm">
        No file data available. Load a snapshot with enhanced metadata.
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="p-6 text-argus-muted text-sm">
        No import data available. This snapshot may not include dependency
        information.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <AnalysisTable
        title="Entry Points"
        description="Files not imported by anything else - where execution starts"
        rows={entryPoints}
        onFileSelect={onFileSelect}
        selectedFile={selectedFile}
        countLabel="Deps"
        emptyMessage="All files are imported by at least one other file"
      />

      <AnalysisTable
        title="Most Imported"
        description="Critical files - changes here affect many dependents"
        rows={mostImported}
        onFileSelect={onFileSelect}
        selectedFile={selectedFile}
        countLabel="Importers"
        emptyMessage="No files are imported by other files"
      />

      <AnalysisTable
        title="Highest Coupling"
        description="Files with many dependencies - potential refactoring candidates"
        rows={highestCoupling}
        onFileSelect={onFileSelect}
        selectedFile={selectedFile}
        countLabel="Imports"
        emptyMessage="No files have dependencies"
      />

      <CircularDepsTable cycles={circularDeps} onFileSelect={onFileSelect} />
    </div>
  );
}
