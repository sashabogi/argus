import { useMemo, useState } from 'react';
import {
  FileCode2,
  GitBranch,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileWarning,
  Link2,
  ChevronDown,
  ChevronUp,
  Code2,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ImportEdge, FileInfo, SnapshotMetadata } from '../types';

interface DependencyAnalysisProps {
  files: FileInfo[];
  imports: ImportEdge[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
  metadata?: SnapshotMetadata | null;
}

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

// Compact stat card for KPI row
function StatCard({
  label,
  value,
  icon,
  status = 'neutral'
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-3 rounded-lg border min-w-0",
      status === 'good' && "bg-emerald-950/50 border-emerald-800/60",
      status === 'bad' && "bg-red-950/50 border-red-800/60",
      status === 'warning' && "bg-amber-950/50 border-amber-800/60",
      status === 'neutral' && "bg-neutral-900 border-neutral-700/60",
    )}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className={cn(
          "text-2xl font-bold tabular-nums",
          status === 'good' && "text-emerald-400",
          status === 'bad' && "text-red-400",
          status === 'warning' && "text-amber-400",
          status === 'neutral' && "text-foreground",
        )}>{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// Compact table with fixed height and no scroll capture
function CompactTable({
  title,
  rows,
  onFileSelect,
  selectedFile,
  countLabel,
  emptyMessage,
  maxItems = 10,
}: {
  title: string;
  rows: AnalysisRow[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
  countLabel: string;
  emptyMessage: string;
  maxItems?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, maxItems);
  const hasMore = rows.length > maxItems;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {rows.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3 flex-1">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
        ) : (
          <>
            <div
              className="max-h-[240px] overflow-y-auto "
              style={{ scrollbarWidth: 'thin' }}
            >
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 pr-2 text-muted-foreground font-medium">
                      File
                    </th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium w-16">
                      {countLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr
                      key={row.path}
                      className={cn(
                        'border-b border-border/30 cursor-pointer transition-colors',
                        selectedFile === row.path
                          ? 'bg-accent'
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => onFileSelect?.(row.path)}
                    >
                      <td className="py-1.5 pr-2">
                        <span
                          className="font-mono text-foreground truncate block max-w-[200px]"
                          title={row.path}
                        >
                          {getFileName(row.path)}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="font-mono text-primary tabular-nums">
                          {row.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-2 py-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                {expanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show {rows.length - maxItems} more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Compact circular deps card
function CircularDepsCard({
  cycles,
  onFileSelect,
}: {
  cycles: CircularDep[];
  onFileSelect?: (path: string) => void;
}) {
  const hasNoCycles = cycles.length === 0;
  const [expanded, setExpanded] = useState(false);
  const displayCycles = expanded ? cycles : cycles.slice(0, 5);
  const hasMore = cycles.length > 5;

  return (
    <Card className={cn(
      "flex flex-col",
      hasNoCycles ? 'border-emerald-800/30' : 'border-red-800/30'
    )}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {hasNoCycles ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            )}
            <CardTitle className="text-sm font-medium">Circular Dependencies</CardTitle>
          </div>
          <Badge
            variant={hasNoCycles ? 'secondary' : 'destructive'}
            className="text-[10px] px-1.5 py-0"
          >
            {hasNoCycles ? 'None' : cycles.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3 flex-1">
        {hasNoCycles ? (
          <p className="text-xs text-emerald-500/80">
            No circular dependencies detected
          </p>
        ) : (
          <>
            <div
              className="max-h-[240px] overflow-y-auto  space-y-2"
              style={{ scrollbarWidth: 'thin' }}
            >
              {displayCycles.map((cycle, i) => (
                <div
                  key={i}
                  className="bg-red-950/30 border border-red-900/40 rounded p-2"
                >
                  <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
                    {cycle.cycle.map((file, j) => (
                      <span key={j} className="flex items-center">
                        <button
                          className="text-foreground hover:text-primary transition-colors truncate max-w-[120px]"
                          onClick={() => onFileSelect?.(file)}
                          title={file}
                        >
                          {getFileName(file)}
                        </button>
                        {j < cycle.cycle.length - 1 && (
                          <span className="text-red-500 mx-0.5">{'\u2192'}</span>
                        )}
                      </span>
                    ))}
                    <span className="text-red-500">{'\u21BA'}</span>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-2 py-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
              >
                {expanded ? (
                  <>Show less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Show {cycles.length - 5} more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DependencyAnalysis({
  files,
  imports,
  onFileSelect,
  selectedFile,
  metadata,
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

  // Orphaned files: no imports AND no importers (isolated files)
  const orphanedFiles = useMemo<AnalysisRow[]>(() => {
    const rows: AnalysisRow[] = [];
    for (const file of files) {
      const importerCount = importers.get(file.path)?.size || 0;
      const depCount = dependencies.get(file.path)?.size || 0;
      if (importerCount === 0 && depCount === 0) {
        rows.push({
          path: file.path,
          count: 0,
          lines: file.lines,
        });
      }
    }
    return rows;
  }, [files, importers, dependencies]);

  // Deep import chains: files with >10 dependencies
  const deepImportChains = useMemo<AnalysisRow[]>(() => {
    const rows: AnalysisRow[] = [];
    for (const file of files) {
      const depCount = dependencies.get(file.path)?.size || 0;
      if (depCount > 10) {
        rows.push({
          path: file.path,
          count: depCount,
          lines: file.lines,
        });
      }
    }
    return rows.sort((a, b) => b.count - a.count);
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
          const cycleStart = pathStack.indexOf(dep);
          if (cycleStart !== -1) {
            const cycle = pathStack.slice(cycleStart);
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

  // Calculate health score
  const healthScore = useMemo(() => {
    const highCouplingCount = highestCoupling.filter(f => f.count > 10).length;
    const orphanRatio = files.length > 0 ? orphanedFiles.length / files.length : 0;

    return Math.max(0, Math.min(100,
      100
      - (circularDeps.length * 10)
      - Math.min(30, highCouplingCount * 2)
      - (orphanRatio > 0.1 ? 10 : 0)
    ));
  }, [circularDeps.length, highestCoupling, orphanedFiles.length, files.length]);

  // Get health status
  const getHealthStatus = (score: number): 'good' | 'warning' | 'bad' => {
    if (score >= 80) return 'good';
    if (score >= 50) return 'warning';
    return 'bad';
  };

  // Total import edges
  const totalImports = imports.filter(
    imp => fileSet.has(imp.source) && fileSet.has(imp.target)
  ).length;

  // Calculate totals from metadata
  const totalLines = useMemo(() => {
    return files.reduce((sum, f) => sum + f.lines, 0);
  }, [files]);

  const totalSymbols = useMemo(() => {
    if (!metadata?.symbolIndex) return 0;
    return Object.keys(metadata.symbolIndex).length;
  }, [metadata]);

  // Group files by extension for file type distribution
  const sortedExtensions = useMemo(() => {
    const extensionCounts = new Map<string, { count: number; lines: number }>();
    for (const file of files) {
      const ext = file.extension || 'other';
      const existing = extensionCounts.get(ext) || { count: 0, lines: 0 };
      extensionCounts.set(ext, {
        count: existing.count + 1,
        lines: existing.lines + file.lines,
      });
    }
    return Array.from(extensionCounts.entries())
      .sort((a, b) => b[1].count - a[1].count);
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        No file data available. Load a snapshot with enhanced metadata.
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="p-6 text-muted-foreground text-sm">
        No import data available. This snapshot may not include dependency
        information.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto  p-4 space-y-4">
      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard
          label="Total Files"
          value={files.length}
          icon={<FileCode2 className="h-4 w-4" />}
          status="neutral"
        />
        <StatCard
          label="Total Lines"
          value={totalLines.toLocaleString()}
          icon={<Code2 className="h-4 w-4" />}
          status="neutral"
        />
        <StatCard
          label="Symbols"
          value={totalSymbols.toLocaleString()}
          icon={<Package className="h-4 w-4" />}
          status="neutral"
        />
        <StatCard
          label="Imports"
          value={totalImports}
          icon={<ArrowRightLeft className="h-4 w-4" />}
          status="neutral"
        />
        <StatCard
          label="Entry Points"
          value={entryPoints.length}
          icon={<GitBranch className="h-4 w-4" />}
          status="neutral"
        />
        <StatCard
          label="Circular Deps"
          value={circularDeps.length}
          icon={<Link2 className="h-4 w-4" />}
          status={circularDeps.length === 0 ? 'good' : 'bad'}
        />
        <StatCard
          label="Health Score"
          value={healthScore}
          icon={<Activity className="h-4 w-4" />}
          status={getHealthStatus(healthScore)}
        />
      </div>

      {/* Main Grid - 2 columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompactTable
          title="Entry Points"
          rows={entryPoints}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          countLabel="Deps"
          emptyMessage="All files are imported by at least one other file"
        />

        <CompactTable
          title="Most Imported"
          rows={mostImported}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          countLabel="Importers"
          emptyMessage="No files are imported by other files"
        />

        <CompactTable
          title="Highest Coupling"
          rows={highestCoupling}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          countLabel="Imports"
          emptyMessage="No files have dependencies"
        />

        <CircularDepsCard cycles={circularDeps} onFileSelect={onFileSelect} />
      </div>

      {/* Additional Insights Section */}
      {(orphanedFiles.length > 0 || deepImportChains.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orphanedFiles.length > 0 && (
            <Card className="border-amber-800/30">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileWarning className="h-3.5 w-3.5 text-amber-500" />
                    <CardTitle className="text-sm font-medium">Orphaned Files</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-950/50 text-amber-400 border-amber-800/50">
                    {orphanedFiles.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <p className="text-[10px] text-muted-foreground mb-2">
                  Files with no imports and no importers - may be unused
                </p>
                <div
                  className="max-h-[160px] overflow-y-auto  space-y-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {orphanedFiles.slice(0, 10).map((file) => (
                    <button
                      key={file.path}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded text-xs font-mono truncate transition-colors",
                        selectedFile === file.path
                          ? "bg-accent"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => onFileSelect?.(file.path)}
                      title={file.path}
                    >
                      {getFileName(file.path)}
                    </button>
                  ))}
                  {orphanedFiles.length > 10 && (
                    <p className="text-[10px] text-muted-foreground px-2 py-1">
                      +{orphanedFiles.length - 10} more orphaned files
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {deepImportChains.length > 0 && (
            <Card className="border-amber-800/30">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-amber-500" />
                    <CardTitle className="text-sm font-medium">Deep Import Chains</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-950/50 text-amber-400 border-amber-800/50">
                    {deepImportChains.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <p className="text-[10px] text-muted-foreground mb-2">
                  Files importing 10+ other files - consider refactoring
                </p>
                <div
                  className="max-h-[160px] overflow-y-auto "
                  style={{ scrollbarWidth: 'thin' }}
                >
                  <table className="w-full text-xs">
                    <tbody>
                      {deepImportChains.slice(0, 8).map((file) => (
                        <tr
                          key={file.path}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedFile === file.path
                              ? "bg-accent"
                              : "hover:bg-muted/50"
                          )}
                          onClick={() => onFileSelect?.(file.path)}
                        >
                          <td className="py-1 pr-2">
                            <span
                              className="font-mono truncate block max-w-[180px]"
                              title={file.path}
                            >
                              {getFileName(file.path)}
                            </span>
                          </td>
                          <td className="py-1 text-right">
                            <span className="font-mono text-amber-400 tabular-nums">
                              {file.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {deepImportChains.length > 8 && (
                    <p className="text-[10px] text-muted-foreground px-2 py-1">
                      +{deepImportChains.length - 8} more files
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* File Type Distribution Section */}
      {sortedExtensions.length > 0 && (
        <div className="mt-6 pt-6 border-t border-neutral-800">
          <h3 className="text-sm font-medium text-neutral-400 mb-4">File Type Distribution</h3>
          <div className="flex flex-wrap gap-2">
            {sortedExtensions.map(([ext, stats]) => (
              <div
                key={ext}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs"
              >
                <span className="font-mono text-neutral-200">.{ext}</span>
                <span className="text-neutral-500">({stats.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
