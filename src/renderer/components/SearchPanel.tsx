/**
 * Search Panel Component
 * Advanced search interface for database elements
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
} from '@mui/material';
import { Search, FilterList, Clear, ExpandMore, Visibility, GetApp } from '@mui/icons-material';

interface SearchPanelProps {
  projectId: string | null;
}

interface SearchResult {
  id: string;
  type: 'table' | 'field' | 'script' | 'layout' | 'relationship';
  name: string;
  context: string;
  description?: string;
  matches: string[];
}

interface SearchFilters {
  types: string[];
  searchIn: string[];
  caseSensitive: boolean;
  wholeWords: boolean;
  regex: boolean;
}

const ELEMENT_TYPES = [
  { value: 'table', label: 'Tables' },
  { value: 'field', label: 'Fields' },
  { value: 'script', label: 'Scripts' },
  { value: 'layout', label: 'Layouts' },
  { value: 'relationship', label: 'Relationships' },
];

const SEARCH_SCOPES = [
  { value: 'name', label: 'Names' },
  { value: 'comment', label: 'Comments' },
  { value: 'calculation', label: 'Calculations' },
  { value: 'script_step', label: 'Script Steps' },
];

const SearchPanel: React.FC<SearchPanelProps> = ({ projectId }) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    searchIn: ['name'],
    caseSensitive: false,
    wholeWords: false,
    regex: false,
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    // Load search history from localStorage
    const saved = localStorage.getItem('yada-search-history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load search history:', e);
      }
    }
  }, []);

  const saveSearchToHistory = useCallback(
    (searchQuery: string) => {
      const updated = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
      setSearchHistory(updated);
      localStorage.setItem('yada-search-history', JSON.stringify(updated));
    },
    [searchHistory]
  );

  const performSearch = useCallback(async () => {
    if (!projectId || !query.trim()) {
      setError('Please select a project and enter a search query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          query,
          entityTypes: filters.types && filters.types.length > 0 ? filters.types : undefined,
          // Optional parameters (not currently used by backend but sent for future support)
          searchIn: filters.searchIn,
          caseSensitive: filters.caseSensitive,
          wholeWords: filters.wholeWords,
          regex: filters.regex,
          maxResults: 200,
        }),
      });

      if (!response.ok) {
        // Attempt to parse error body
        let errorMessage = `Search failed: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody?.error?.message) {
            errorMessage = errBody.error.message;
          }
        } catch (e) {
          // ignore parse error of error body
        }
        throw new Error(errorMessage);
      }

      const payload = await response.json();
      const backendResults = Array.isArray(payload?.results) ? payload.results : [];
      type BackendResult = {
        entityId?: string;
        entityType?: SearchResult['type'];
        entityName?: string;
        id?: string;
        type?: SearchResult['type'];
        name?: string;
        context?: string;
        description?: string;
        matches?: string[];
      };

      const mapped: SearchResult[] = backendResults.map((r: BackendResult) => ({
        id: r.entityId || r.id || `${r.entityType || 'unknown'}-${r.entityName || 'result'}`,
        type: (r.entityType || r.type || 'table') as SearchResult['type'],
        name: r.entityName || r.name || '(unnamed)',
        context: r.context || '',
        description: r.description || undefined,
        matches: Array.isArray(r.matches) ? r.matches : [],
      }));

      setResults(mapped);
      saveSearchToHistory(query);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [projectId, query, filters, saveSearchToHistory]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      performSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  const clearFilters = () => {
    setFilters({
      types: [],
      searchIn: ['name'],
      caseSensitive: false,
      wholeWords: false,
      regex: false,
    });
  };

  const exportResults = async () => {
    if (results.length === 0) return;

    try {
      const response = await fetch(`/api/search/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          query,
          results,
          filters,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `search-results-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export results');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'table':
        return '📋';
      case 'field':
        return '🏷️';
      case 'script':
        return '📜';
      case 'layout':
        return '📄';
      case 'relationship':
        return '🔗';
      default:
        return '📄';
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Advanced Search
      </Typography>

      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Search across tables, fields, scripts, layouts, and relationships in your FileMaker
        database.
      </Typography>

      {!projectId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Please select a project first to enable search functionality.
        </Alert>
      )}

      {/* Search Input */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Autocomplete
                freeSolo
                options={searchHistory}
                value={query}
                onInputChange={(_, newValue) => setQuery(newValue || '')}
                renderInput={params => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Search Query"
                    placeholder="Enter search terms..."
                    onKeyPress={handleKeyPress}
                    disabled={!projectId || loading}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={performSearch}
                  disabled={!projectId || !query.trim() || loading}
                  startIcon={<Search />}
                  fullWidth
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  onClick={clearSearch}
                  disabled={!query && results.length === 0}
                  startIcon={<Clear />}
                >
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Search Filters */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterList sx={{ mr: 1 }} />
            Search Filters
            {(filters.types.length > 0 ||
              filters.searchIn.length > 1 ||
              filters.caseSensitive ||
              filters.wholeWords ||
              filters.regex) && <Chip label="Active" size="small" color="primary" sx={{ ml: 2 }} />}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Element Types</InputLabel>
                <Select
                  multiple
                  value={filters.types}
                  onChange={e => setFilters({ ...filters, types: e.target.value as string[] })}
                  renderValue={selected => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map(value => (
                        <Chip
                          key={value}
                          label={ELEMENT_TYPES.find(t => t.value === value)?.label}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                >
                  {ELEMENT_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Search In</InputLabel>
                <Select
                  multiple
                  value={filters.searchIn}
                  onChange={e => setFilters({ ...filters, searchIn: e.target.value as string[] })}
                  renderValue={selected => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map(value => (
                        <Chip
                          key={value}
                          label={SEARCH_SCOPES.find(s => s.value === value)?.label}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                >
                  {SEARCH_SCOPES.map(scope => (
                    <MenuItem key={scope.value} value={scope.value}>
                      {scope.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant={filters.caseSensitive ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setFilters({ ...filters, caseSensitive: !filters.caseSensitive })}
                >
                  Case Sensitive
                </Button>
                <Button
                  variant={filters.wholeWords ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setFilters({ ...filters, wholeWords: !filters.wholeWords })}
                >
                  Whole Words
                </Button>
                <Button
                  variant={filters.regex ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setFilters({ ...filters, regex: !filters.regex })}
                >
                  Regex
                </Button>
                <Button variant="text" size="small" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <Card>
          <CardContent>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="h6">Search Results ({results.length})</Typography>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={exportResults}
                size="small"
              >
                Export
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <List>
              {results.map((result, index) => (
                <React.Fragment key={result.id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{getTypeIcon(result.type)}</span>
                          <Typography variant="subtitle1" component="span">
                            {result.name}
                          </Typography>
                          <Chip label={result.type} size="small" variant="outlined" />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" color="textSecondary">
                            {result.context}
                          </Typography>
                          {result.description && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {result.description}
                            </Typography>
                          )}
                          {result.matches.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              {result.matches.map((match, idx) => (
                                <Chip
                                  key={idx}
                                  label={match}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => {
                          console.log('View entity:', result);
                          // TODO: Navigate to entity detail or open in a dialog
                        }}
                        title={`View ${result.type}: ${result.name}`}
                      >
                        <Visibility />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < results.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1">Searching...</Typography>
        </Box>
      )}

      {!loading && results.length === 0 && query && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="textSecondary">
            No results found for “{query}”
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SearchPanel;
