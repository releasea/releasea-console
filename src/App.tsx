import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlatformPreferencesProvider } from "@/contexts/PlatformPreferencesContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
const Index = lazy(() => import("./pages/dashboard/IndexPage"));
const Auth = lazy(() => import("./pages/auth/AuthPage"));
const Profile = lazy(() => import("./pages/profile/ProfilePage"));
const Projects = lazy(() => import("./pages/projects/ProjectsPage"));
const ProjectDetails = lazy(() => import("./pages/projects/ProjectDetailsPage"));
const Services = lazy(() => import("./pages/services/ServicesPage"));
const CreateService = lazy(() => import("./pages/services/CreateServicePage"));
const ServiceDetails = lazy(() => import("./pages/services/details/ServiceDetailsPage"));
const Workers = lazy(() => import("./pages/workers/WorkersPage"));
const WorkerDetails = lazy(() => import("./pages/workers/WorkerDetailsPage"));
const WorkerPoolDetails = lazy(() => import("./pages/workers/WorkerPoolDetailsPage"));
const Environments = lazy(() => import("./pages/environments/EnvironmentsPage"));
const Teams = lazy(() => import("./pages/teams/TeamsPage"));
const IdentityProvider = lazy(() => import("./pages/identity-provider/IdentityProviderPage"));
const Governance = lazy(() => import("./pages/governance/GovernancePage"));
const Settings = lazy(() => import("./pages/settings/SettingsPage"));
const DocsRedirect = lazy(() => import("./pages/docs/DocsRedirectPage"));
const NotFound = lazy(() => import("./pages/not-found/NotFoundPage"));
const RuntimeProfiles = lazy(() => import("./pages/runtime-profiles/RuntimeProfilesPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PlatformPreferencesProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <ScrollToTop />
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading Releasea…</div>}>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
              <Route path="/services/new" element={<ProtectedRoute requiredRole="developer"><CreateService /></ProtectedRoute>} />
              <Route path="/services/:id" element={<ProtectedRoute><ServiceDetails /></ProtectedRoute>} />
              <Route path="/workers" element={<ProtectedRoute requiredRole="admin"><Workers /></ProtectedRoute>} />
              <Route path="/workers/pools/:id" element={<ProtectedRoute requiredRole="admin"><WorkerPoolDetails /></ProtectedRoute>} />
              <Route path="/workers/:id" element={<ProtectedRoute requiredRole="admin"><WorkerDetails /></ProtectedRoute>} />
              <Route path="/environments" element={<ProtectedRoute requiredRole="admin"><Environments /></ProtectedRoute>} />
              <Route path="/teams" element={<ProtectedRoute requiredRole="admin"><Teams /></ProtectedRoute>} />
              <Route path="/identity-provider" element={<ProtectedRoute requiredRole="admin"><IdentityProvider /></ProtectedRoute>} />
              <Route path="/governance" element={<ProtectedRoute requiredRole="admin"><Governance /></ProtectedRoute>} />
              <Route path="/runtime-profiles" element={<ProtectedRoute requiredRole="admin"><RuntimeProfiles /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
              <Route path="/docs" element={<DocsRedirect />} />
              <Route path="/docs/:slug" element={<DocsRedirect />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </PlatformPreferencesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
