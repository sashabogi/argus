import { useState, useMemo } from 'react';
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
      <div className="p-3 border-b border-argus-border">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in codebase... (regex supported)"
            className="search-input pr-10"
          />
          <svg
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-argus-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2 text-xs text-argus-muted cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-argus-border bg-argus-dark"
            />
            Case sensitive
          </label>
          {results.length > 0 && (
            <span className="text-xs text-argus-muted">
              {results.length} result{results.length !== 1 ? 's' : ''} in{' '}
              {groupedResults.size} file{groupedResults.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {query.length > 0 && query.length < 2 && (
          <div className="p-4 text-argus-muted text-sm">
            Type at least 2 characters to search
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div className="p-4 text-argus-muted text-sm">
            No results found for "{query}"
          </div>
        )}

        {Array.from(groupedResults.entries()).map(([file, matches]) => (
          <div key={file} className="border-b border-argus-border">
            <div className="px-3 py-2 bg-argus-dark text-sm font-medium text-argus-accent truncate">
              {file}
              <span className="text-argus-muted ml-2">
                ({matches.length})
              </span>
            </div>
            <div className="divide-y divide-argus-border">
              {matches.map((match, idx) => (
                <div
                  key={`${match.line}-${idx}`}
                  className="px-3 py-2 hover:bg-argus-dark cursor-pointer transition-colors"
                  onClick={() => handleResultClick(file, match.line)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-argus-muted font-mono min-w-[40px]">
                      {match.line}
                    </span>
                    <code className="text-sm break-all text-argus-text">
                      {highlightMatch(match.content, query, caseSensitive)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
          <span key={i} className="bg-argus-yellow text-argus-darker px-0.5 rounded">
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
