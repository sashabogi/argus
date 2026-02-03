import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Maximize2, Minimize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TreeNode } from '../types';
import { getExtensionColor } from '../utils/parser';

interface FileExplorerProps {
  tree: TreeNode;
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  onFileSelect?: (path: string) => void;
  selectedFile?: string | null;
  expandedPaths: Set<string>;
  toggleExpanded: (path: string) => void;
}

function TreeItem({
  node,
  depth,
  onFileSelect,
  selectedFile,
  expandedPaths,
  toggleExpanded,
}: TreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedFile === node.path;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleExpanded(node.path);
    } else if (onFileSelect) {
      onFileSelect(node.path);
    }
  };

  const getIcon = () => {
    if (node.type === 'directory') {
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground" />
      );
    }

    // File icon with extension color
    const color = node.extension ? getExtensionColor(node.extension) : undefined;
    return (
      <File
        className="h-4 w-4"
        style={color ? { color } : undefined}
      />
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
        {node.type === 'file' && <span className="w-3" />}
        {getIcon()}
        <span className="truncate flex-1 text-sm">{node.name}</span>
        {node.lines !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {node.lines}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FileExplorer({
  tree,
  onFileSelect,
  selectedFile,
}: FileExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set([''])
  );

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    const collect = (node: TreeNode) => {
      if (node.type === 'directory') {
        allPaths.add(node.path);
        node.children?.forEach(collect);
      }
    };
    collect(tree);
    setExpandedPaths(allPaths);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['']));
  }, []);

  if (!tree.children || tree.children.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No files loaded. Drop a snapshot file or enter a path.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={expandAll}
          className="h-7 px-2 text-xs"
        >
          <Maximize2 className="h-3 w-3 mr-1" />
          Expand
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={collapseAll}
          className="h-7 px-2 text-xs"
        >
          <Minimize2 className="h-3 w-3 mr-1" />
          Collapse
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {tree.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
