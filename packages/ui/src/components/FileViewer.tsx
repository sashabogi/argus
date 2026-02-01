import { useMemo } from 'react';
import type { SnapshotData } from '../types';
import { getExtensionColor } from '../utils/parser';

interface FileViewerProps {
  data: SnapshotData | null;
  selectedFile: string | null;
  highlightLine?: number;
}

export function FileViewer({ data, selectedFile, highlightLine }: FileViewerProps) {
  const content = useMemo(() => {
    if (!data || !selectedFile) return null;
    return data.fileContents.get(selectedFile) || null;
  }, [data, selectedFile]);

  const extension = useMemo(() => {
    if (!selectedFile) return '';
    return selectedFile.split('.').pop() || '';
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-argus-muted">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-argus-muted">
        <div className="text-center">
          <p>File content not found</p>
          <p className="text-sm mt-2">{selectedFile}</p>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const color = getExtensionColor(extension);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-argus-border flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium truncate">{selectedFile}</span>
        <span className="text-xs text-argus-muted ml-auto">
          {lines.length} lines
        </span>
      </div>
      <div className="overflow-auto flex-1 font-mono text-sm">
        <table className="w-full">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLine === lineNum;
              return (
                <tr
                  key={lineNum}
                  className={`hover:bg-argus-dark ${
                    isHighlighted ? 'bg-argus-accent/20' : ''
                  }`}
                  id={`line-${lineNum}`}
                >
                  <td className="px-4 py-0.5 text-right text-argus-muted select-none w-12 border-r border-argus-border">
                    {lineNum}
                  </td>
                  <td className="px-4 py-0.5 whitespace-pre overflow-x-auto">
                    {line || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
