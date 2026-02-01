import { useState, useCallback } from 'react';
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
        <svg
          className="w-4 h-4 text-argus-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-argus-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    }

    // File icon with extension color
    const color = node.extension ? getExtensionColor(node.extension) : '#8b949e';
    return (
      <svg
        className="w-4 h-4"
        fill={color}
        viewBox="0 0 24 24"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
        <polyline points="14,2 14,8 20,8" fill="none" stroke={color} strokeWidth="1" />
      </svg>
    );
  };

  return (
    <>
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="text-argus-muted text-xs">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {getIcon()}
        <span className="truncate flex-1 text-sm">{node.name}</span>
        {node.lines !== undefined && (
          <span className="text-xs text-argus-muted">{node.lines}</span>
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
      <div className="p-4 text-argus-muted text-sm">
        No files loaded. Drop a snapshot file or enter a path.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-2 border-b border-argus-border">
        <button
          onClick={expandAll}
          className="text-xs text-argus-muted hover:text-argus-text px-2 py-1 rounded hover:bg-argus-dark transition-colors"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-argus-muted hover:text-argus-text px-2 py-1 rounded hover:bg-argus-dark transition-colors"
        >
          Collapse All
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
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
    </div>
  );
}
