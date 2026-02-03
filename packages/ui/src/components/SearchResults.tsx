import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { SnapshotData } from '../types';
import { searchSnapshot } from '../utils/parser';

interface SearchResultsProps {
  data: SnapshotData | null;
  onFileSelect?: (path: string, line?: number) => void;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export function SearchResults({ data, onFileSelect }: SearchResultsProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const results = useMemo<SearchResult[]>(() => {
    if (!data || !query.trim() || query.length < 2) {
      return [];
    }

    try {
      return searchSnapshot(data, query, {
        caseSensitive,
        maxResults: 100,
      });
    } catch {
      // Invalid regex
      return [];
    }
  }, [data, query, caseSensitive]);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const result of results) {
      const existing = groups.get(result.file) || [];
      existing.push(result);
      groups.set(result.file, existing);
    }
    return groups;
  }, [results]);

  const handleResultClick = (file: string, line: number) => {
    if (onFileSelect) {
      onFileSelect(file, line);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in codebase... (regex supported)"
            className="pl-9"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="case-sensitive"
              checked={caseSensitive}
              onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
            />
            <Label
              htmlFor="case-sensitive"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Case sensitive
            </Label>
          </div>
          {results.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {results.length} in {groupedResults.size} file{groupedResults.size !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {query.length > 0 && query.length < 2 && (
          <div className="p-4 text-muted-foreground text-sm">
            Type at least 2 characters to search
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div className="p-4 text-muted-foreground text-sm">
            No results found for "{query}"
          </div>
        )}

        {Array.from(groupedResults.entries()).map(([file, matches]) => (
          <div key={file} className="border-b">
            <div className="px-3 py-2 bg-muted/50 text-sm font-medium text-primary truncate flex items-center justify-between">
              <span className="truncate">{file}</span>
              <Badge variant="outline" className="text-xs ml-2 shrink-0">
                {matches.length}
              </Badge>
            </div>
            <div className="divide-y divide-border/50">
              {matches.map((match, idx) => (
                <div
                  key={`${match.line}-${idx}`}
                  className="px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleResultClick(file, match.line)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground font-mono min-w-[40px] tabular-nums">
                      {match.line}
                    </span>
                    <code className="text-sm break-all">
                      {highlightMatch(match.content, query, caseSensitive)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function highlightMatch(
  content: string,
  query: string,
  caseSensitive: boolean
): React.ReactNode {
  try {
    const regex = new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi');
    const parts = content.split(regex);

    return parts.map((part, i) => {
      if (regex.test(part)) {
        regex.lastIndex = 0; // Reset after test
        return (
          <span key={i} className="bg-chart-4/30 text-chart-4 px-0.5 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  } catch {
    return content;
  }
}
