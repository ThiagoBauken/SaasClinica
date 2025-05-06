import { ReactNode } from "react";
import Header from "@/components/dashboard/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import { useAuth } from "@/hooks/use-auth";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  currentPath: string;
}

export default function DashboardLayout({ children, title, currentPath }: DashboardLayoutProps) {
  const { user } = useAuth();

  if (!user) {
    return null; // Protected route should handle this
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentPath={currentPath} />
        
        <main className="flex-1 overflow-y-auto bg-neutral-lightest">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-neutral-dark mb-6">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
