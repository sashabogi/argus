import { useMemo } from 'react';
import { FileCode } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p>File content not found</p>
          <p className="text-sm mt-2 font-mono">{selectedFile}</p>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const color = getExtensionColor(extension);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium truncate flex-1">{selectedFile}</span>
        <Badge variant="secondary" className="text-xs">
          {lines.length} lines
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <table className="w-full font-mono text-sm">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLine === lineNum;
              return (
                <tr
                  key={lineNum}
                  className={cn(
                    'hover:bg-muted/50',
                    isHighlighted && 'bg-primary/10'
                  )}
                  id={`line-${lineNum}`}
                >
                  <td className="px-4 py-0.5 text-right text-muted-foreground select-none w-12 border-r tabular-nums">
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
      </ScrollArea>
    </div>
  );
}
