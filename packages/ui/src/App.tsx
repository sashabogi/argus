import { useState, useCallback, useEffect, useMemo } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import {
  DependencyAnalysis,
  DependencyGraph,
  FileExplorer,
  FileViewer,
  SearchResults,
} from './components';
import { AppSidebar } from './components/layout/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseSnapshot, buildFileTree } from './utils/parser';
import type { SnapshotData, TreeNode } from './types';

type Tab = 'analysis' | 'files' | 'search' | 'graph';

interface Project {
  path: string;
  name: string;
  lastUsed: number;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [isDragging, setIsDragging] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load available projects on startup
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
          // Set current project to first one if not already set
          if (data.length > 0 && !currentProject) {
            setCurrentProject(data[0].path);
          }
        }
      } catch (error) {
        // Projects API not available, continue without project selector
        console.log('Projects API not available');
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  // Load snapshot when project changes or on startup
  useEffect(() => {
    const loadSnapshot = async () => {
      setLoading(true);
      try {
        const url = currentProject
          ? `/api/snapshot?project=${encodeURIComponent(currentProject)}`
          : '/api/snapshot';

        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          const parsed = parseSnapshot(content);
          setSnapshot(parsed);
          console.log('Loaded snapshot' + (currentProject ? ` for ${currentProject}` : ''));
        } else {
          setSnapshot(null);
        }
      } catch (error) {
        // No snapshot available
        console.log('No snapshot found');
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    };

    // Only load if we have a project selected, or if no projects are available (fallback mode)
    if (currentProject || projects.length === 0) {
      loadSnapshot();
    }
  }, [currentProject, projects.length]);

  // Build file tree from snapshot
  const fileTree = useMemo<TreeNode>(() => {
    if (!snapshot?.metadata?.files) {
      return { name: 'root', path: '', type: 'directory', children: [] };
    }
    return buildFileTree(snapshot.metadata.files);
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

  // Load demo snapshot from textarea
  const handleLoadSnapshot = useCallback((content: string) => {
    if (content.trim()) {
      const parsed = parseSnapshot(content);
      setSnapshot(parsed);
      setSelectedFile(null);
      setHighlightLine(undefined);
    }
  }, []);

  const handleClear = useCallback(() => {
    setSnapshot(null);
    setSelectedFile(null);
    setHighlightLine(undefined);
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <div
        className="flex min-h-screen w-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <AppSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasSnapshot={!!snapshot}
          fileCount={snapshot?.metadata?.files.length || 0}
          importCount={snapshot?.metadata?.imports.length || 0}
          onClear={handleClear}
          currentProjectPath={currentProject}
        />

        <SidebarInset>
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            {projects.length > 0 && (
              <Select value={currentProject} onValueChange={setCurrentProject}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Select project">
                    {currentProject && (
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {projects.find(p => p.path === currentProject)?.name || 'Select project'}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.path} value={project.path}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{project.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Separator orientation="vertical" className="mx-2 h-4" />
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-medium">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              {loading && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
              )}
            </div>
          </header>

          {/* Drop overlay */}
          {isDragging && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <Card className="border-dashed border-2 border-primary">
                <CardContent className="flex flex-col items-center gap-2 p-8">
                  <Upload className="h-8 w-8 text-primary" />
                  <p className="text-lg font-medium">Drop snapshot file here</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main content */}
          {!snapshot ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <Card className="max-w-2xl w-full">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Load a Snapshot</CardTitle>
                  <CardDescription>
                    Drag and drop a snapshot file, or paste content below
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
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
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Click to browse or drag & drop
                      </p>
                    </label>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-2 text-xs text-muted-foreground uppercase">
                        or
                      </span>
                    </div>
                  </div>

                  <textarea
                    placeholder="Paste snapshot content here..."
                    className="w-full h-48 p-4 bg-muted/50 border border-input rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    onPaste={(e) => {
                      const content = e.clipboardData.getData('text');
                      if (content) {
                        handleLoadSnapshot(content);
                      }
                    }}
                  />

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Create a snapshot with:{' '}
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        argus snapshot . -o snapshot.txt
                      </code>
                    </p>
                    {projects.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Or run{' '}
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          argus snapshot
                        </code>
                        {' '}in your project directories to register them for quick switching.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {activeTab === 'analysis' ? (
                <div className="flex-1 overflow-hidden">
                  {snapshot.metadata ? (
                    <DependencyAnalysis
                      files={snapshot.metadata.files}
                      imports={snapshot.metadata.imports}
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                      metadata={snapshot.metadata}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No dependency data available (basic snapshot)</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'graph' ? (
                <div className="flex-1 overflow-hidden">
                  {snapshot.metadata ? (
                    <DependencyGraph
                      files={snapshot.metadata.files}
                      imports={snapshot.metadata.imports}
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No dependency data available (basic snapshot)</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'files' ? (
                <div className="flex flex-1 overflow-hidden">
                  <div className="w-72 border-r overflow-hidden flex flex-col">
                    <FileExplorer
                      tree={fileTree}
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <FileViewer
                      data={snapshot}
                      selectedFile={selectedFile}
                      highlightLine={highlightLine}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 overflow-hidden">
                  <div className="w-80 border-r overflow-hidden flex flex-col">
                    <SearchResults
                      data={snapshot}
                      onFileSelect={handleFileSelect}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <FileViewer
                      data={snapshot}
                      selectedFile={selectedFile}
                      highlightLine={highlightLine}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
