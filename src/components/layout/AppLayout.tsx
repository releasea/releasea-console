import { ReactNode, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { PlatformReadinessBanner } from './PlatformReadinessBanner';
import { ApiLoadErrorBanner } from './ApiLoadErrorBanner';
import { fetchEnvironments } from '@/lib/data';
import { demoResetLabel } from '@/demo/simulate';

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
            {import.meta.env.RELEASEA_DEMO === 'true' ? (
              <div className="border-b border-info/40 bg-info/15 px-6 py-2.5 text-sm text-foreground">
                <span className="font-medium text-info">Demo.</span> Static demo of the Releasea console. {demoResetLabel()}
              </div>
            ) : null}
            <PlatformReadinessBanner />
            <ApiLoadErrorBanner />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
