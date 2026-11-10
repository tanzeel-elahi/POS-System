import { useQuery } from '@tanstack/react-query';
import { CategoryService } from '@services/categoryService';

export const useCategories = (enabled = true) =>
  useQuery({
    queryKey: ['categories', 'list'],
    queryFn: CategoryService.getCategories,
    enabled,
    staleTime: 60_000,
  });