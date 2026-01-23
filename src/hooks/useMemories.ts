import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Memory,
  MemoryStats,
  MemoryFilters,
  PaginatedMemories,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryTimeGroup,
  SemanticSearchResponse,
} from "../types/memory";

const API_BASE = "http://localhost:3000/api";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Build query string from filters and pagination
 */
function buildQueryString(
  filters: MemoryFilters,
  page: number,
  limit: number,
  sortBy: string,
  sortOrder: string,
): string {
  const params = new URLSearchParams();

  if (filters.type) params.append("type", filters.type);
  if (filters.timeScale) params.append("timeScale", filters.timeScale);
  if (filters.tags?.length) params.append("tags", filters.tags.join(","));
  if (filters.minImportance !== undefined)
    params.append("minImportance", String(filters.minImportance));
  if (filters.maxImportance !== undefined)
    params.append("maxImportance", String(filters.maxImportance));
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.isArchived !== undefined)
    params.append("isArchived", String(filters.isArchived));
  if (filters.isPinned !== undefined)
    params.append("isPinned", String(filters.isPinned));
  if (filters.search) params.append("search", filters.search);

  params.append("page", String(page));
  params.append("limit", String(limit));
  params.append("sortBy", sortBy);
  params.append("sortOrder", sortOrder);

  return params.toString();
}

/**
 * Group memories by date for timeline display
 */
function groupMemoriesByDate(memories: Memory[]): MemoryTimeGroup[] {
  const groups: Map<string, Memory[]> = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  memories.forEach((memory) => {
    const memoryDate = new Date(memory.createdAt);
    memoryDate.setHours(0, 0, 0, 0);

    let groupKey: string;
    let groupLabel: string;

    if (memoryDate.getTime() === today.getTime()) {
      groupKey = "today";
      groupLabel = "Aujourd'hui";
    } else if (memoryDate.getTime() === yesterday.getTime()) {
      groupKey = "yesterday";
      groupLabel = "Hier";
    } else if (memoryDate >= weekAgo) {
      groupKey = "this-week";
      groupLabel = "Cette semaine";
    } else if (memoryDate >= monthAgo) {
      groupKey = "this-month";
      groupLabel = "Ce mois";
    } else {
      // Group by month-year for older memories
      const monthYear = memoryDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      groupKey = `${memoryDate.getFullYear()}-${memoryDate.getMonth()}`;
      groupLabel = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(memory);
  });

  // Convert to array and maintain order
  const orderedKeys = [
    "today",
    "yesterday",
    "this-week",
    "this-month",
    ...Array.from(groups.keys())
      .filter(
        (k) => !["today", "yesterday", "this-week", "this-month"].includes(k),
      )
      .sort((a, b) => b.localeCompare(a)), // Sort older months descending
  ];

  const result: MemoryTimeGroup[] = [];
  const seenKeys = new Set<string>();

  for (const key of orderedKeys) {
    if (groups.has(key) && !seenKeys.has(key)) {
      seenKeys.add(key);
      const memories = groups.get(key)!;
      let label = key;

      if (key === "today") label = "Aujourd'hui";
      else if (key === "yesterday") label = "Hier";
      else if (key === "this-week") label = "Cette semaine";
      else if (key === "this-month") label = "Ce mois";
      else {
        const firstMemory = memories[0];
        const date = new Date(firstMemory.createdAt);
        const monthYear = date.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
        label = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      }

      result.push({
        date: key,
        label,
        memories,
      });
    }
  }

  return result;
}

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MemoryFilters>({ isArchived: false });
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Memory[]>([]);

  // Group memories by date for timeline
  const timelineGroups = useMemo(() => {
    const memoriesToGroup =
      isSemanticSearch && searchQuery ? semanticResults : memories;
    return groupMemoriesByDate(memoriesToGroup);
  }, [memories, semanticResults, isSemanticSearch, searchQuery]);

  // Load memories with filters
  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryString = buildQueryString(
        filters,
        page,
        limit,
        sortBy,
        sortOrder,
      );
      const data = await apiRequest<PaginatedMemories>(
        `/memories?${queryString}`,
      );

      if (page === 1) {
        setMemories(data.memories);
      } else {
        setMemories((prev) => [...prev, ...data.memories]);
      }

      setTotalPages(data.pagination.totalPages);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      console.error("Failed to load memories:", err);
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, limit, sortBy, sortOrder]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest<MemoryStats>("/memories/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load memory stats:", err);
    }
  }, []);

  // Semantic search using Weaviate
  const semanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSemanticResults([]);
      setIsSemanticSearch(false);
      return;
    }

    setIsSearching(true);
    setIsSemanticSearch(true);
    setError(null);

    try {
      const data = await apiRequest<SemanticSearchResponse>(
        `/memories/search/semantic?query=${encodeURIComponent(query)}&limit=50`,
      );
      setSemanticResults(data.results.map((r) => r.memory));
    } catch (err) {
      // Fallback to text search if semantic search fails
      console.warn("Semantic search failed, falling back to text search:", err);
      setIsSemanticSearch(false);
      setFilters((prev) => ({ ...prev, search: query }));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Text search (fallback)
  const textSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSemanticSearch(false);
    setSemanticResults([]);
    setPage(1);
    setFilters((prev) => ({ ...prev, search: query || undefined }));
  }, []);

  // Combined search function
  const search = useCallback(
    async (query: string, useSemanticSearch = true) => {
      setSearchQuery(query);
      if (useSemanticSearch && query.trim()) {
        await semanticSearch(query);
      } else {
        textSearch(query);
      }
    },
    [semanticSearch, textSearch],
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setIsSemanticSearch(false);
    setSemanticResults([]);
    setFilters((prev) => {
      const { search, ...rest } = prev;
      return rest;
    });
    setPage(1);
  }, []);

  // Create memory
  const createMemory = useCallback(
    async (input: CreateMemoryInput) => {
      try {
        const memory = await apiRequest<Memory>("/memories", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setMemories((prev) => [memory, ...prev]);
        loadStats();
        return memory;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create memory";
        setError(message);
        throw new Error(message);
      }
    },
    [loadStats],
  );

  // Update memory
  const updateMemory = useCallback(
    async (memoryId: string, input: UpdateMemoryInput) => {
      try {
        const memory = await apiRequest<Memory>(`/memories/${memoryId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        setMemories((prev) =>
          prev.map((m) => (m.id === memoryId ? memory : m)),
        );
        return memory;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update memory";
        setError(message);
        throw new Error(message);
      }
    },
    [],
  );

  // Delete memory
  const deleteMemory = useCallback(
    async (memoryId: string) => {
      try {
        await apiRequest(`/memories/${memoryId}`, { method: "DELETE" });
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        loadStats();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete memory";
        setError(message);
        throw new Error(message);
      }
    },
    [loadStats],
  );

  // Pin/Unpin memory
  const togglePin = useCallback(
    async (memoryId: string, isPinned: boolean) => {
      const endpoint = isPinned
        ? `/memories/${memoryId}/unpin`
        : `/memories/${memoryId}/pin`;
      try {
        const memory = await apiRequest<Memory>(endpoint, { method: "POST" });
        setMemories((prev) =>
          prev.map((m) => (m.id === memoryId ? memory : m)),
        );
        loadStats();
        return memory;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to toggle pin";
        setError(message);
        throw new Error(message);
      }
    },
    [loadStats],
  );

  // Archive/Unarchive memory
  const toggleArchive = useCallback(
    async (memoryId: string, isArchived: boolean) => {
      const endpoint = isArchived
        ? `/memories/${memoryId}/unarchive`
        : `/memories/${memoryId}/archive`;
      try {
        const memory = await apiRequest<Memory>(endpoint, { method: "POST" });
        // Remove from current view if archiving
        if (!isArchived) {
          setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        } else {
          setMemories((prev) =>
            prev.map((m) => (m.id === memoryId ? memory : m)),
          );
        }
        loadStats();
        return memory;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to toggle archive";
        setError(message);
        throw new Error(message);
      }
    },
    [loadStats],
  );

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, isLoading]);

  // Refresh data
  const refresh = useCallback(() => {
    setPage(1);
    setMemories([]);
    loadMemories();
    loadStats();
  }, [loadMemories, loadStats]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<MemoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
    setMemories([]);
  }, []);

  // Initial load
  useEffect(() => {
    loadMemories();
    loadStats();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!isSemanticSearch) {
      loadMemories();
    }
  }, [filters, page, sortBy, sortOrder, isSemanticSearch]);

  return {
    // Data
    memories: isSemanticSearch && searchQuery ? semanticResults : memories,
    stats,
    timelineGroups,

    // State
    isLoading,
    isSearching,
    error,
    filters,
    page,
    totalPages,
    hasMore,
    searchQuery,
    isSemanticSearch,

    // Actions
    loadMemories,
    loadStats,
    loadMore,
    refresh,
    search,
    clearSearch,
    createMemory,
    updateMemory,
    deleteMemory,
    togglePin,
    toggleArchive,
    updateFilters,
    setFilters,
    setSortBy,
    setSortOrder,
  };
}
