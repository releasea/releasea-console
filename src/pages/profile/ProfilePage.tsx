import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera,
  AlertCircle,
  CheckCircle,
  KeyRound,
  Lock,
  Save,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ConfirmActionModal } from '@/components/modals/ConfirmActionModal';
import { SettingsGrid, SettingsSection } from '@/components/layout/SettingsSection';
import { DangerZone } from '@/components/service/DangerZone';
import { changePassword, deleteAccount, fetchProfile, updateProfile } from '@/lib/data';
import type { UserProfile } from '@/types/releasea';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await fetchProfile();
      if (!active) return;
      setProfile(data);
      setName(data.name);
      setEmail(data.email);
      setTwoFactorEnabled(data.twoFactorEnabled);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const identityProviderLabel = useMemo(() => {
    switch (profile?.identityProvider) {
      case 'saml':
        return 'SAML SSO';
      case 'oidc':
        return 'OIDC SSO';
      case 'keycloak':
        return 'Keycloak';
      case 'azure-ad':
        return 'Azure AD';
      case 'okta':
        return 'Okta';
      case 'google':
        return 'Google Workspace';
      case 'microsoft':
        return 'Microsoft Entra ID';
      default:
        return null;
    }
  }, [profile?.identityProvider]);

  const isIdpManaged = Boolean(identityProviderLabel);

  const handleSaveProfile = async () => {
    if (isIdpManaged) {
      toast({
        title: 'Managed by identity provider',
        description: 'Profile updates must be made through your IdP.',
      });
      return;
    }
    setIsSaving(true);
    await updateProfile({
      name,
      email,
      twoFactorEnabled,
    });
    setIsSaving(false);
    toast({
      title: 'Profile updated',
      description: 'Your profile information has been saved.',
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match.',
        variant: 'destructive',
      });
      return;
    }
    
    if (newPassword.length < 4) {
      toast({
        title: 'Error',
        description: 'Password must be at least 4 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    await changePassword({ currentPassword, newPassword });
    setIsSaving(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast({
      title: 'Password changed',
      description: 'Your password has been updated successfully.',
    });
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    await logout();
    navigate('/auth');
    toast({
      title: 'Account deleted',
      description: 'Your account has been permanently deleted.',
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <ListPageHeader
          title="Profile"
          description="Manage your account settings and preferences"
        />

        <div className="space-y-6">
          <SettingsSection
            title="Profile"
            description="Update your personal details."
          >
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <button
                      className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        toast({
                          title: 'Avatar upload',
                          description: 'Avatar upload is not available yet.',
                        });
                      }}
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {user?.role || 'developer'}
                      </Badge>
                      {identityProviderLabel && (
                        <Badge variant="secondary" className="text-[10px]">
                          {identityProviderLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isIdpManaged && (
                <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 p-3">
                  <KeyRound className="w-4 h-4 text-info mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Managed by {identityProviderLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Profile details are synced from your identity provider and cannot be edited here.
                    </p>
                  </div>
                </div>
              )}

              <SettingsGrid columns={2}>
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-muted/40"
                    disabled={isIdpManaged}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-muted/40"
                    disabled={isIdpManaged}
                  />
                </div>
              </SettingsGrid>

              {!isIdpManaged && (
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              )}
            </div>
          </SettingsSection>

          <SettingsSection
            title="Team & organization"
            description="Your team membership and role."
          >
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/60">
              <div>
                <p className="text-sm font-medium text-foreground">{user?.teamName || 'Core Platform'}</p>
                <p className="text-xs text-muted-foreground">Team ID: {user?.teamId || 'team-1'}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {user?.role || 'developer'}
              </Badge>
            </div>
          </SettingsSection>

          {isIdpManaged ? (
            <SettingsSection
              title="Security"
              description="Authentication is managed by your identity provider."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-info" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Single sign-on enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Password and multi-factor settings are managed in {identityProviderLabel}.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {identityProviderLabel}
                </Badge>
              </div>
            </SettingsSection>
          ) : (
            <>
              <SettingsSection
                title="Password"
                description="Update your password to keep your account secure."
              >
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-muted/40"
                      required
                    />
                  </div>
                  <SettingsGrid columns={2}>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-muted/40"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm new password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-muted/40"
                        required
                      />
                    </div>
                  </SettingsGrid>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving} className="gap-2">
                      <Lock className="w-4 h-4" />
                      {isSaving ? 'Updating...' : 'Update password'}
                    </Button>
                  </div>
                </form>
              </SettingsSection>

              <SettingsSection
                title="Two-factor authentication"
                description="Add an extra layer of security to your account."
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    {twoFactorEnabled ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {twoFactorEnabled ? '2FA is enabled' : '2FA is not enabled'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {twoFactorEnabled 
                          ? 'Your account is protected with two-factor authentication.' 
                          : 'Enable 2FA to add an extra layer of security.'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={(checked) => {
                      setTwoFactorEnabled(checked);
                      toast({
                        title: checked ? '2FA Enabled' : '2FA Disabled',
                        description: checked
                          ? 'Two-factor authentication is now enabled. In a real app, you would scan a QR code to set up your authenticator.'
                          : 'Two-factor authentication has been disabled.',
                      });
                    }}
                  />
                </div>
              </SettingsSection>
            </>
          )}

          <DangerZone
            title="Danger zone"
            description="Irreversible actions for your account."
            actionLabel="Delete account"
            actionDescription="Permanently delete your account and all associated data."
            onAction={() => setShowDeleteModal(true)}
          />
        </div>
      </div>

      <ConfirmActionModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Account"
        description="This action cannot be undone. All your data, projects, and services will be permanently deleted."
        confirmText="delete my account"
        variant="destructive"
        onConfirm={handleDeleteAccount}
      />
    </AppLayout>
  );
};

export default Profile;
