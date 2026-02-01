import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DependencyGraph,
  FileExplorer,
  FileViewer,
  SearchResults,
  Stats,
} from './components';
import { parseSnapshot, buildFileTree, getGroupFromPath } from './utils/parser';
import type { SnapshotData, GraphNode, GraphLink, TreeNode } from './types';

type Tab = 'graph' | 'files' | 'search' | 'stats';

export default function App() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<Tab>('graph');
  const [isDragging, setIsDragging] = useState(false);

  // Parse query params for snapshot path (future feature for URL-based loading)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const _snapshotPath = params.get('snapshot');
    // Future: Could fetch snapshot from a local server endpoint
    if (_snapshotPath) {
      console.log('Snapshot path from URL:', _snapshotPath);
    }
  }, []);

  // Build file tree from snapshot
  const fileTree = useMemo<TreeNode>(() => {
    if (!snapshot?.metadata?.files) {
      return { name: 'root', path: '', type: 'directory', children: [] };
    }
    return buildFileTree(snapshot.metadata.files);
  }, [snapshot]);

  // Build graph data from snapshot
  const { nodes, links } = useMemo(() => {
    if (!snapshot?.metadata) {
      return { nodes: [], links: [] };
    }

    const nodeMap = new Map<string, GraphNode>();
    const linkSet = new Set<string>();
    const graphLinks: GraphLink[] = [];

    // Add nodes for each file
    for (const file of snapshot.metadata.files) {
      nodeMap.set(file.path, {
        id: file.path,
        group: getGroupFromPath(file.path),
        lines: file.lines,
        extension: file.extension,
      });
    }

    // Add links from imports
    for (const imp of snapshot.metadata.imports) {
      // Only add if both source and target exist as nodes
      if (nodeMap.has(imp.source) && nodeMap.has(imp.target)) {
        const key = `${imp.source}->${imp.target}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          graphLinks.push({ source: imp.source, target: imp.target });
        }
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      links: graphLinks,
    };
  }, [snapshot]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const parsed = parseSnapshot(content);
          setSnapshot(parsed);
          setSelectedFile(null);
          setHighlightLine(undefined);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((path: string, line?: number) => {
    setSelectedFile(path);
    setHighlightLine(line);

    // Scroll to line if specified
    if (line) {
      setTimeout(() => {
        const element = document.getElementById(`line-${line}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, []);

  // Handle node click in graph
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedFile(nodeId);
    setHighlightLine(undefined);
  }, []);

  // Load demo snapshot from textarea
  const handleLoadSnapshot = useCallback((content: string) => {
    if (content.trim()) {
      const parsed = parseSnapshot(content);
      setSnapshot(parsed);
      setSelectedFile(null);
      setHighlightLine(undefined);
    }
  }, []);

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'text-argus-accent border-b-2 border-argus-accent'
        : 'text-argus-muted hover:text-argus-text'
    }`;

  return (
    <div
      className="min-h-screen flex flex-col"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <header className="px-6 py-4 border-b border-argus-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg
            className="w-8 h-8 text-argus-accent"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="10" fillOpacity="0.2" />
            <circle cx="12" cy="12" r="3" />
            <path
              d="M12 2v4M12 18v4M2 12h4M18 12h4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <h1 className="text-xl font-bold tracking-tight">Argus</h1>
          <span className="text-argus-muted text-sm">Codebase Explorer</span>
        </div>

        {snapshot && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-argus-muted">
              {snapshot.metadata?.files.length || 0} files
            </span>
            <span className="text-argus-muted">
              {snapshot.metadata?.imports.length || 0} imports
            </span>
            <button
              onClick={() => {
                setSnapshot(null);
                setSelectedFile(null);
              }}
              className="text-argus-red hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </header>

      {/* Drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-argus-accent/20 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="text-2xl font-bold text-argus-accent">
            Drop snapshot file here
          </div>
        </div>
      )}

      {/* Main content */}
      {!snapshot ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Load a Snapshot</h2>
              <p className="text-argus-muted">
                Drag and drop a snapshot file, or paste content below
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-argus-border rounded-lg p-8 text-center hover:border-argus-accent transition-colors cursor-pointer">
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  accept=".txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) {
                          handleLoadSnapshot(content);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <svg
                    className="w-12 h-12 mx-auto text-argus-muted mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-argus-muted">
                    Click to browse or drag & drop
                  </p>
                </label>
              </div>

              <div className="text-center text-argus-muted text-sm">or</div>

              <textarea
                placeholder="Paste snapshot content here..."
                className="w-full h-48 p-4 bg-argus-dark border border-argus-border rounded-lg text-argus-text font-mono text-sm resize-none focus:outline-none focus:border-argus-accent"
                onPaste={(e) => {
                  const content = e.clipboardData.getData('text');
                  if (content) {
                    handleLoadSnapshot(content);
                  }
                }}
              />

              <div className="text-center">
                <p className="text-sm text-argus-muted">
                  Create a snapshot with:{' '}
                  <code className="bg-argus-dark px-2 py-1 rounded">
                    argus snapshot . -o snapshot.txt
                  </code>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <aside className="w-72 border-r border-argus-border flex flex-col">
            <div className="flex border-b border-argus-border">
              <button
                className={tabClass('graph')}
                onClick={() => setActiveTab('graph')}
              >
                Graph
              </button>
              <button
                className={tabClass('files')}
                onClick={() => setActiveTab('files')}
              >
                Files
              </button>
              <button
                className={tabClass('search')}
                onClick={() => setActiveTab('search')}
              >
                Search
              </button>
              <button
                className={tabClass('stats')}
                onClick={() => setActiveTab('stats')}
              >
                Stats
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {activeTab === 'files' && (
                <FileExplorer
                  tree={fileTree}
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                />
              )}
              {activeTab === 'search' && (
                <SearchResults
                  data={snapshot}
                  onFileSelect={handleFileSelect}
                />
              )}
              {activeTab === 'stats' && (
                <Stats metadata={snapshot.metadata} />
              )}
              {activeTab === 'graph' && (
                <div className="p-4 text-sm text-argus-muted">
                  <p>Dependency graph is displayed in the main area.</p>
                  <p className="mt-2">Click a node to view the file.</p>
                  <p className="mt-1">Scroll to zoom, drag to pan.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'graph' ? (
              <div className="flex-1 p-4">
                {nodes.length > 0 ? (
                  <DependencyGraph
                    nodes={nodes}
                    links={links}
                    selectedNode={selectedFile}
                    onNodeClick={handleNodeClick}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-argus-muted">
                    <p>No dependency data available (basic snapshot)</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <FileViewer
                  data={snapshot}
                  selectedFile={selectedFile}
                  highlightLine={highlightLine}
                />
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
