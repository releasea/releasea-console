import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlatformPreferencesProvider } from "@/contexts/PlatformPreferencesContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/dashboard/IndexPage";
import Auth from "./pages/auth/AuthPage";
import Profile from "./pages/profile/ProfilePage";
import Projects from "./pages/projects/ProjectsPage";
import ProjectDetails from "./pages/projects/ProjectDetailsPage";
import Services from "./pages/services/ServicesPage";
import CreateService from "./pages/services/CreateServicePage";
import ServiceDetails from "./pages/services/details/ServiceDetailsPage";
import Workers from "./pages/workers/WorkersPage";
import Environments from "./pages/environments/EnvironmentsPage";
import Teams from "./pages/teams/TeamsPage";
import IdentityProvider from "./pages/identity-provider/IdentityProviderPage";
import Governance from "./pages/governance/GovernancePage";
import Settings from "./pages/settings/SettingsPage";
import DocsRedirect from "./pages/docs/DocsRedirectPage";
import NotFound from "./pages/not-found/NotFoundPage";
import RuntimeProfiles from "./pages/runtime-profiles/RuntimeProfilesPage";

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
          </AuthProvider>
        </BrowserRouter>
      </PlatformPreferencesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
