import { ReactNode, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { PlatformReadinessBanner } from './PlatformReadinessBanner';
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
          <div className="flex min-w-0 flex-1 flex-col">
            <PlatformReadinessBanner />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
