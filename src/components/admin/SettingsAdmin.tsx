import { useState } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export function SettingsAdmin() {
  const { settings, updateSettings, adminUsername, isDefaultAdminPassword, updateAdminCreds, logoutAdmin } = useStore();
  const [s, setS] = useState(settings);
  const [creds, setCreds] = useState({ username: adminUsername, password: '', confirm: '' });

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(s);
    toast.success('Settings saved');
  };

  const saveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creds.username.trim() || !creds.password) return toast.error('Both required');
    if (creds.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (creds.password !== creds.confirm) return toast.error('Passwords do not match');
    await updateAdminCreds({ username: creds.username.trim(), password: creds.password });
    toast.success('Admin login updated');
    setCreds({ username: creds.username.trim(), password: '', confirm: '' });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Store Settings</h4>
        <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Store Name" value={s.storeName} onChange={(e) => setS({ ...s, storeName: e.target.value })} />
          <Input placeholder="Store Note" value={s.storeNote} onChange={(e) => setS({ ...s, storeNote: e.target.value })} />
          <Input placeholder="Hero Image URL" value={s.heroImageUrl || ''} onChange={(e) => setS({ ...s, heroImageUrl: e.target.value })} className="md:col-span-2" />
          <Input placeholder="Logo URL" value={s.logoImageUrl || ''} onChange={(e) => setS({ ...s, logoImageUrl: e.target.value })} className="md:col-span-2" />
          <div className="md:col-span-2">
            <Button type="submit">Save Store Settings</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Admin Credentials</h4>
        {isDefaultAdminPassword && (
          <div className="flex gap-2 items-start p-3 mb-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>You are still using the default password. Please change it now to secure this device.</span>
          </div>
        )}
        <form onSubmit={saveCreds} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="New Username" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} required maxLength={60} />
          <Input type="password" placeholder="New Password (min 8 chars)" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} required minLength={8} maxLength={200} />
          <Input type="password" placeholder="Confirm Password" value={creds.confirm} onChange={(e) => setCreds({ ...creds, confirm: e.target.value })} required minLength={8} maxLength={200} className="md:col-span-2" />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit">Update Admin Login</Button>
            <Button type="button" variant="outline" onClick={logoutAdmin}>Logout</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
