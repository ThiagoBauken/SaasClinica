import { ReactNode, useState } from "react";
import Header from "@/components/dashboard/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import { useAuth } from "@/core/AuthProvider";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  currentPath: string;
}

export default function DashboardLayout({ children, title, currentPath }: DashboardLayoutProps) {
  const { user } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user!} onMenuToggle={handleMenuToggle} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentPath={currentPath}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
