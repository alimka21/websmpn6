import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // data dianggap segar selama 30 detik
      retry: 1,                // 1x retry saat gagal
      refetchOnWindowFocus: true,
    },
  },
});
