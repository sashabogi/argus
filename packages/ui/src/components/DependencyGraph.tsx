import { useCallback, useMemo, useState, useEffect, memo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RotateCcw, ArrowDownUp, ArrowLeftRight, Filter, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileInfo, ImportEdge } from '../types';

interface DependencyGraphProps {
  files: FileInfo[];
  imports: ImportEdge[];
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}

// Node data type with index signature for ReactFlow compatibility
type CustomNodeData = {
  label: string;
  fullPath: string;
  importCount: number;
  importerCount: number;
  isEntryPoint: boolean;
  isHighCoupling: boolean;
  isSelected: boolean;
  isFaded: boolean;
  onDoubleClick: (path: string) => void;
  [key: string]: unknown;
};

type FileNodeType = Node<CustomNodeData, 'fileNode'>;

// Layout using dagre for hierarchical arrangement
const getLayoutedElements = (
  nodes: FileNodeType[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: FileNodeType[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  const nodeWidth = 200;
  const nodeHeight = 70;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node): FileNodeType => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Get filename from path
function getFileName(path: string): string {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  // Truncate if too long
  if (filename.length > 20) {
    return filename.slice(0, 17) + '...';
  }
  return filename;
}

// Custom Node Component
function FileNodeComponent({ data }: NodeProps<FileNodeType>) {
  const nodeClasses = cn(
    'px-4 py-3 rounded-md border-2 transition-all duration-200 cursor-pointer min-w-[160px] shadow-sm',
    'hover:shadow-lg hover:scale-105',
    {
      // Entry point styling (green) - solid background
      'bg-emerald-950 border-emerald-500 text-emerald-300': data.isEntryPoint && !data.isSelected,
      // High coupling styling (orange/red) - solid background
      'bg-red-950 border-red-500 text-red-300':
        data.isHighCoupling && !data.isEntryPoint && !data.isSelected,
      // Selected styling
      'bg-blue-950 border-blue-400 text-blue-200 ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/20': data.isSelected,
      // Default styling - solid dark background
      'bg-neutral-900 border-neutral-600 text-neutral-200':
        !data.isEntryPoint && !data.isHighCoupling && !data.isSelected,
      // Faded styling
      'opacity-20': data.isFaded,
    }
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={nodeClasses}
            onDoubleClick={() => data.onDoubleClick(data.fullPath)}
          >
            <Handle
              type="target"
              position={Position.Top}
              className="!bg-neutral-500 !w-3 !h-3 !border-2 !border-neutral-400"
            />
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-mono font-semibold text-center leading-tight">
                {data.label}
              </span>
              <div className="flex gap-1.5">
                {data.importerCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 h-5 bg-neutral-800 text-neutral-300 border border-neutral-600"
                  >
                    ↓{data.importerCount}
                  </Badge>
                )}
                {data.importCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 h-5 bg-neutral-800 text-neutral-300 border border-neutral-600"
                  >
                    ↑{data.importCount}
                  </Badge>
                )}
              </div>
            </div>
            <Handle
              type="source"
              position={Position.Bottom}
              className="!bg-neutral-500 !w-3 !h-3 !border-2 !border-neutral-400"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-mono text-xs break-all">{data.fullPath}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const FileNode = memo(FileNodeComponent);
FileNode.displayName = 'FileNode';

const nodeTypes = {
  fileNode: FileNode,
};

export function DependencyGraph({
  files,
  imports,
  onFileSelect,
  selectedFile,
}: DependencyGraphProps) {
  const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  // Build import/importer maps
  const { importers, dependencies, connectedFiles } = useMemo(() => {
    const fileSet = new Set(files.map((f) => f.path));
    const importersMap = new Map<string, Set<string>>();
    const depsMap = new Map<string, Set<string>>();
    const connected = new Set<string>();

    // Initialize all files
    for (const file of files) {
      importersMap.set(file.path, new Set());
      depsMap.set(file.path, new Set());
    }

    // Process imports
    for (const imp of imports) {
      if (fileSet.has(imp.source) && fileSet.has(imp.target)) {
        importersMap.get(imp.target)?.add(imp.source);
        depsMap.get(imp.source)?.add(imp.target);
        connected.add(imp.source);
        connected.add(imp.target);
      }
    }

    return { importers: importersMap, dependencies: depsMap, connectedFiles: connected };
  }, [files, imports]);

  // Calculate coupling threshold for "high coupling" designation
  const couplingThreshold = useMemo(() => {
    const counts = files.map((f) => dependencies.get(f.path)?.size || 0);
    counts.sort((a, b) => b - a);
    // Top 10% are considered high coupling
    const threshold = counts[Math.floor(counts.length * 0.1)] || 5;
    return Math.max(threshold, 5);
  }, [files, dependencies]);

  // Get connected nodes for focus mode
  const getConnectedNodes = useCallback(
    (nodeId: string): Set<string> => {
      const connected = new Set<string>();
      connected.add(nodeId);

      // Add all files this node imports
      const deps = dependencies.get(nodeId);
      if (deps) {
        deps.forEach((dep) => connected.add(dep));
      }

      // Add all files that import this node
      const imps = importers.get(nodeId);
      if (imps) {
        imps.forEach((imp) => connected.add(imp));
      }

      return connected;
    },
    [importers, dependencies]
  );

  // Handle double click to select file
  const handleDoubleClick = useCallback(
    (path: string) => {
      onFileSelect?.(path);
    },
    [onFileSelect]
  );

  // Build initial nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const connectedSet = focusedNode ? getConnectedNodes(focusedNode) : null;

    const filesToShow = showOnlyConnected
      ? files.filter((f) => connectedFiles.has(f.path))
      : files;

    const nodes: FileNodeType[] = filesToShow.map((file): FileNodeType => {
      const importCount = dependencies.get(file.path)?.size || 0;
      const importerCount = importers.get(file.path)?.size || 0;
      const isEntryPoint = importerCount === 0 && importCount > 0;
      const isHighCoupling = importCount >= couplingThreshold;
      const isSelected = selectedFile === file.path;
      const isFaded = connectedSet ? !connectedSet.has(file.path) : false;

      return {
        id: file.path,
        type: 'fileNode' as const,
        position: { x: 0, y: 0 },
        data: {
          label: getFileName(file.path),
          fullPath: file.path,
          importCount,
          importerCount,
          isEntryPoint,
          isHighCoupling,
          isSelected,
          isFaded,
          onDoubleClick: handleDoubleClick,
        },
      };
    });

    const filePathSet = new Set(filesToShow.map((f) => f.path));
    const edges: Edge[] = imports
      .filter((imp) => filePathSet.has(imp.source) && filePathSet.has(imp.target))
      .map((imp, index): Edge => {
        const isHighlighted =
          connectedSet &&
          connectedSet.has(imp.source) &&
          connectedSet.has(imp.target);
        const isFaded = connectedSet && !isHighlighted;

        return {
          id: `edge-${index}`,
          source: imp.source,
          target: imp.target,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: isHighlighted
              ? 'hsl(var(--primary))'
              : 'hsl(var(--border))',
          },
          style: {
            stroke: isHighlighted
              ? 'hsl(var(--primary))'
              : 'hsl(var(--border))',
            strokeWidth: isHighlighted ? 2 : 1,
            opacity: isFaded ? 0.1 : 1,
          },
          animated: isHighlighted || false,
        };
      });

    return { initialNodes: nodes, initialEdges: edges };
  }, [
    files,
    imports,
    importers,
    dependencies,
    connectedFiles,
    couplingThreshold,
    selectedFile,
    focusedNode,
    showOnlyConnected,
    getConnectedNodes,
    handleDoubleClick,
  ]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges, direction);
  }, [initialNodes, initialEdges, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes and edges when layout changes
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Handle node click for focus mode
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setFocusedNode((prev) => (prev === node.id ? null : node.id));
    },
    []
  );

  // Reset view
  const handleReset = useCallback(() => {
    setFocusedNode(null);
  }, []);

  // Toggle layout direction
  const toggleDirection = useCallback(() => {
    setDirection((prev) => (prev === 'TB' ? 'LR' : 'TB'));
  }, []);

  // Toggle connected filter
  const toggleConnectedFilter = useCallback(() => {
    setShowOnlyConnected((prev) => !prev);
  }, []);

  // Show warning for large codebases
  const isLargeCodebase = files.length > 500;
  const displayedFileCount = showOnlyConnected
    ? [...connectedFiles].length
    : files.length;

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No file data available. Load a snapshot with enhanced metadata.</p>
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No import data available. This snapshot may not include dependency information.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Controls toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleDirection}
          className="gap-1"
        >
          {direction === 'TB' ? (
            <>
              <ArrowDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">Vertical</span>
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden sm:inline">Horizontal</span>
            </>
          )}
        </Button>
        <Button
          variant={showOnlyConnected ? 'default' : 'secondary'}
          size="sm"
          onClick={toggleConnectedFilter}
          className="gap-1"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Connected Only</span>
        </Button>
        {focusedNode && (
          <Button variant="secondary" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Clear Focus</span>
          </Button>
        )}
      </div>

      {/* Large codebase warning */}
      {isLargeCodebase && !showOnlyConnected && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 text-warning-foreground px-3 py-2 rounded-md text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Large codebase ({files.length} files). Consider filtering by directory or enabling Connected Only.
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-4 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-md px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-950 border-2 border-emerald-500" />
          <span className="text-neutral-300">Entry Point</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-950 border-2 border-red-500" />
          <span className="text-neutral-300">High Coupling</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-neutral-900 border-2 border-neutral-600" />
          <span className="text-neutral-300">Normal</span>
        </div>
      </div>

      {/* File count badge */}
      <div className="absolute bottom-4 right-4 z-10">
        <Badge variant="secondary">
          {displayedFileCount} / {files.length} files
        </Badge>
      </div>

      {/* ReactFlow Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as CustomNodeData;
            if (data.isSelected) return '#3b82f6';
            if (data.isEntryPoint) return '#10b981';
            if (data.isHighCoupling) return '#ef4444';
            return '#525252';
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          className="!bg-neutral-900/90 !border-neutral-700"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
