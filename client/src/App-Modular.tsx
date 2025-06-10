import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/core/AuthProvider";
import DynamicRouter from "@/core/DynamicRouter";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DynamicRouter />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}