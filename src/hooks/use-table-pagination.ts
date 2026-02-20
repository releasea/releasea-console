import { useEffect, useState, useMemo } from 'react';

const DEFAULT_PAGE_SIZE = 20;
const STORAGE_KEY = 'releasea.preferences';

const getStoredPageSize = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.defaultPageSize ?? DEFAULT_PAGE_SIZE;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PAGE_SIZE;
};

export const useTablePagination = (totalItems: number) => {
  const [page, setPage] = useState(1);
  const pageSize = useMemo(() => getStoredPageSize(), []);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const slice = <T,>(items: T[]) => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  };

  return {
    page,
    pageSize,
    totalPages,
    setPage,
    slice,
  };
};
