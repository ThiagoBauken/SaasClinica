import { useAuth } from "@/core/AuthProvider";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useContext } from "react";
import { AuthContext } from "@/core/AuthProvider";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  // Try to get auth context safely
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const isLoading = authContext?.isLoading || false;
  
  // Modo de desenvolvimento - para bypass de autenticação
  const BYPASS_AUTH = true; // Remova ou defina como false em produção
  
  if (BYPASS_AUTH) {
    return <Route path={path} component={Component} />;
  }

  return (
    <Route path={path}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !user ? (
        <Redirect to="/auth" />
      ) : (
        <Component />
      )}
    </Route>
  );
}
