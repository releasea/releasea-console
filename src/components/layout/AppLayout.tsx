import { ReactNode, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { fetchEnvironments } from '@/lib/data';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  useEffect(() => {
    void fetchEnvironments();
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full">
        <TopBar />
        <div className="flex flex-1 w-full">
          <AppSidebar />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
