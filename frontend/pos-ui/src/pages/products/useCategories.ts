import { useQuery } from '@tanstack/react-query';
import { CategoryService } from '@services/categoryService';

/** Flat list in tree order, each item has a `path`. */
export const useCategories = (enabled = true) =>
  useQuery({
    queryKey: ['categories', 'list'],
    queryFn: CategoryService.getCategories,
    enabled,
    staleTime: 60_000,
  });

/** Nested tree, for the manager and the pickers. */
export const useCategoryTree = (enabled = true) =>
  useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: CategoryService.getTree,
    enabled,
    staleTime: 60_000,
  });