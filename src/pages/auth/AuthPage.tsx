import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Cog, LogIn, User, Lock, AlertCircle, Mail, Github, ArrowLeft, CheckCircle, UserPlus, Server, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ReleaseaLogo, ReleaseaMark } from '@/components/branding/ReleaseaLogo';
import { buildAuthSSOStartUrl, fetchAuthSSOConfig } from '@/lib/data';

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-sent' | 'reset-password' | 'reset-success';
const signupEnabled = import.meta.env.RELEASEA_ENABLE_SIGNUP === 'true';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithSSOTicket, signUp, requestPasswordReset, confirmPasswordReset, isLoading } = useAuth();
  
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState('');
  const [isSSOEnabled, setIsSSOEnabled] = useState(false);
  const [isSSOProcessing, setIsSSOProcessing] = useState(false);
  
  const search = new URLSearchParams(location.search);
  const queryFrom = search.get('from');
  const ssoTicket = search.get('ssoTicket');
  const ssoErrorCode = search.get('ssoError');
  const from = queryFrom || (location.state as { from?: string })?.from || '/';

  const clearTransientSSOParams = useCallback(() => {
    const next = new URLSearchParams(location.search);
    next.delete('ssoTicket');
    next.delete('ssoError');
    const query = next.toString();
    window.history.replaceState({}, '', `${location.pathname}${query ? `?${query}` : ''}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;
    fetchAuthSSOConfig()
      .then((config) => {
        if (!active) return;
        setIsSSOEnabled(Boolean(config.enabled));
      })
      .catch(() => {
        if (!active) return;
        setIsSSOEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ssoErrorCode || view !== 'login') return;
    const messageByCode: Record<string, string> = {
      sso_access_denied: 'SSO access was denied by the identity provider.',
      sso_access_restricted: 'Your identity is not allowed by SSO security policies.',
      oidc_token_exchange_failed: 'Unable to complete SSO token exchange.',
      sso_user_provisioning_failed: 'SSO user mapping failed. Contact your administrator.',
      invalid_or_expired_sso_state: 'SSO login expired. Please try again.',
    };
    setError(messageByCode[ssoErrorCode] || 'SSO login failed. Please try again.');
    clearTransientSSOParams();
  }, [ssoErrorCode, view, clearTransientSSOParams]);

  useEffect(() => {
    if (!ssoTicket) return;
    let active = true;
    setError(null);
    setIsSSOProcessing(true);
    loginWithSSOTicket(ssoTicket)
      .then((result) => {
        if (!active) return;
        clearTransientSSOParams();
        if (result.success) {
          navigate(from, { replace: true });
          return;
        }
        setError(result.error || 'SSO login failed');
      })
      .finally(() => {
        if (!active) return;
        setIsSSOProcessing(false);
      });
    return () => {
      active = false;
    };
  }, [ssoTicket, from, loginWithSSOTicket, navigate, clearTransientSSOParams]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setError(null);
  };

  const handleSSOLogin = () => {
    setError(null);
    setIsSSOProcessing(true);
    const redirect = `${window.location.origin}/auth`;
    const startURL = buildAuthSSOStartUrl(redirect, from && from !== '/' ? from : undefined);
    window.location.assign(startURL);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    const result = await login(email, password);
    
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    const result = await signUp(name, email, password);
    
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Sign up failed');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    const result = await requestPasswordReset(email);
    
    if (result.success) {
      setResetToken(result.token ?? '');
      setView('reset-sent');
    } else {
      setError(result.error || 'Failed to send reset email');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!password) {
      setError('Please enter a new password');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    const result = await confirmPasswordReset(resetToken, password);
    
    if (result.success) {
      setView('reset-success');
    } else {
      setError(result.error || 'Failed to reset password');
    }
  };

  const highlights = [
    { icon: Server, label: 'Multi-Cluster', desc: 'Workers across N clusters - AWS, GCP, on-prem.' },
    { icon: Globe, label: 'Multi-Environment', desc: 'Unlimited environments with full isolation.' },
    { icon: Cog, label: 'Infra Abstracted', desc: 'No YAML, no kubectl. Full control for platform teams.' },
  ];

  const renderLeftPanel = () => (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden border-r border-border/40"
      style={{
        background:
          'linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background)) 62%, hsl(var(--card)) 100%)',
      }}
    >
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border/40 to-transparent" />

      <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] p-12">
        {/* Logo */}
        <ReleaseaLogo textClassName="text-lg font-bold" />

        {/* Hero copy */}
        <div className="space-y-6 self-center -translate-y-8">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/5 px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success">100% Open Source</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
              <Github className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-primary">Apache 2.0</span>
            </div>
          </div>

          <h2 className="text-3xl xl:text-4xl font-bold text-foreground leading-tight">
            The{' '}
            <span className="bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400 bg-clip-text text-transparent">
              open source
            </span>{' '}
            Internal Developer Portal
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-md">
            Stop exposing Kubernetes complexity to your developers. Create, deploy, monitor and govern services across any cluster, any environment.
          </p>

          {/* Highlight cards */}
          <div className="space-y-3 pt-2">
            {highlights.map((item) => (
              <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          Built for engineering teams that need full control without the complexity of raw Kubernetes.
        </p>
      </div>
    </div>
  );

  const renderMobileLogo = () => (
    <div className="lg:hidden text-center mb-8">
      <div className="flex justify-center mb-4">
        <ReleaseaMark className="h-14 w-14" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Releasea</h1>
      <p className="text-muted-foreground">Platform Orchestrator</p>
    </div>
  );

  const renderLoginForm = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
        <p className="text-muted-foreground mt-2">Sign in to continue to your dashboard</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <button
              type="button"
              onClick={() => { resetForm(); setView('forgot-password'); }}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gap-2 font-medium" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Signing in...
            </div>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Sign in
            </>
          )}
        </Button>

        {isSSOEnabled ? (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2 font-medium"
              onClick={handleSSOLogin}
              disabled={isLoading || isSSOProcessing}
            >
              {isSSOProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                  Redirecting...
                </div>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Sign in with SSO
                </>
              )}
            </Button>
          </>
        ) : null}
      </form>

      {signupEnabled ? (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account?</span>{' '}
          <button
            type="button"
            onClick={() => { resetForm(); setView('signup'); }}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Sign up
          </button>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground">
          User onboarding is managed by platform administrators.
        </div>
      )}

    </div>
  );

  const renderSignUpForm = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
        <p className="text-muted-foreground mt-2">Start managing your infrastructure today</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-sm font-medium">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password (4+ characters)"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gap-2 font-medium" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Creating account...
            </div>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Create account
            </>
          )}
        </Button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account?</span>{' '}
        <button
          type="button"
          onClick={() => { resetForm(); setView('login'); }}
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Sign in
        </button>
      </div>
    </div>
  );

  const renderForgotPasswordForm = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <button
        type="button"
        onClick={() => { resetForm(); setView('login'); }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>

      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">Reset your password</h2>
        <p className="text-muted-foreground mt-2">
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email" className="text-sm font-medium">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gap-2 font-medium" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Sending...
            </div>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Send reset instructions
            </>
          )}
        </Button>
      </form>
    </div>
  );

  const renderResetSent = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
          <p className="text-muted-foreground mt-2">
            We've sent password reset instructions to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
      </div>

      {resetToken ? (
        <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            We received a reset token for this request. You can continue to set a new password now.
          </p>
          <Button
            onClick={() => setView('reset-password')}
            variant="outline"
            className="w-full"
          >
            Continue to reset password
          </Button>
        </div>
      ) : null}

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Didn't receive the email?</span>{' '}
        <button
          type="button"
          onClick={() => setView('forgot-password')}
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Try again
        </button>
      </div>

      <button
        type="button"
        onClick={() => { resetForm(); setView('login'); }}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>
    </div>
  );

  const renderResetPasswordForm = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-foreground">Set new password</h2>
        <p className="text-muted-foreground mt-2">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-sm font-medium">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password (4+ characters)"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="pl-10 h-11 bg-card border-border"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 gap-2 font-medium" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Resetting...
            </div>
          ) : (
            'Reset password'
          )}
        </Button>
      </form>
    </div>
  );

  const renderResetSuccess = () => (
    <div className="w-full max-w-md space-y-6">
      {renderMobileLogo()}

      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Password reset successful</h2>
          <p className="text-muted-foreground mt-2">
            Your password has been reset. You can now sign in with your new password.
          </p>
        </div>
      </div>

      <Button
        onClick={() => { resetForm(); setView('login'); }}
        className="w-full h-11 gap-2 font-medium"
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </Button>
    </div>
  );

  const renderCurrentView = () => {
    switch (view) {
      case 'signup':
        return signupEnabled ? renderSignUpForm() : renderLoginForm();
      case 'forgot-password':
        return renderForgotPasswordForm();
      case 'reset-sent':
        return renderResetSent();
      case 'reset-password':
        return renderResetPasswordForm();
      case 'reset-success':
        return renderResetSuccess();
      default:
        return renderLoginForm();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        {renderLeftPanel()}

        {/* Right Side - Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md lg:-translate-y-4">{renderCurrentView()}</div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
