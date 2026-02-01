import type { SnapshotMetadata } from '../types';

interface StatsProps {
  metadata: SnapshotMetadata | null;
}

export function Stats({ metadata }: StatsProps) {
  if (!metadata) {
    return (
      <div className="p-4 text-argus-muted text-sm">
        No snapshot loaded
      </div>
    );
  }

  const totalFiles = metadata.files.length;
  const totalLines = metadata.files.reduce((sum, f) => sum + f.lines, 0);
  const totalImports = metadata.imports.length;
  const totalExports = metadata.exports.reduce((sum, e) => sum + e.symbols.length, 0);
  const totalSymbols = Object.keys(metadata.symbolIndex).length;

  // Group by extension
  const extensionCounts = new Map<string, { count: number; lines: number }>();
  for (const file of metadata.files) {
    const ext = file.extension || 'other';
    const existing = extensionCounts.get(ext) || { count: 0, lines: 0 };
    extensionCounts.set(ext, {
      count: existing.count + 1,
      lines: existing.lines + file.lines,
    });
  }

  const sortedExtensions = Array.from(extensionCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="stat-value">{totalFiles.toLocaleString()}</div>
          <div className="stat-label">Files</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalLines.toLocaleString()}</div>
          <div className="stat-label">Lines</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalImports.toLocaleString()}</div>
          <div className="stat-label">Imports</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalSymbols.toLocaleString()}</div>
          <div className="stat-label">Symbols</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">By Extension</div>
        <div className="p-3 space-y-2">
          {sortedExtensions.map(([ext, stats]) => {
            const percentage = (stats.count / totalFiles) * 100;
            return (
              <div key={ext} className="flex items-center gap-3">
                <span className="text-sm font-mono w-12">.{ext}</span>
                <div className="flex-1 h-2 bg-argus-darker rounded-full overflow-hidden">
                  <div
                    className="h-full bg-argus-accent rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-argus-muted w-16 text-right">
                  {stats.count} files
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Top Exported Symbols</div>
        <div className="p-3">
          {totalExports > 0 ? (
            <div className="text-sm text-argus-muted">
              {totalExports.toLocaleString()} symbols exported across{' '}
              {metadata.exports.length} files
            </div>
          ) : (
            <div className="text-sm text-argus-muted">
              No export data available (basic snapshot)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
