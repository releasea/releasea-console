import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'developer';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <ListPageHeader
            title="Access denied"
            description="You don't have permission to access this page."
          />
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Required role: <span className="font-medium text-foreground">{requiredRole}</span>
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
