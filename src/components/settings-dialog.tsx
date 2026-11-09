'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings,
  User,
  Palette,
  FolderKanban,
  AlertTriangle,
  Sun,
  Moon,
  Laptop,
  Trash2,
  Check,
  LogOut,
  Pencil,
} from 'lucide-react';
import { logout } from '@/app/login/actions';
import { toast } from 'sonner';

export type SpaceItem = {
  id: string;
  name: string;
  color: string;
};

const AVAILABLE_COLORS = [
  { name: 'blue', bg: 'bg-blue-500', text: 'text-blue-500' },
  { name: 'green', bg: 'bg-emerald-500', text: 'text-emerald-500' },
  { name: 'purple', bg: 'bg-purple-500', text: 'text-purple-500' },
  { name: 'red', bg: 'bg-rose-500', text: 'text-rose-500' },
  { name: 'orange', bg: 'bg-amber-500', text: 'text-amber-500' },
  { name: 'gray', bg: 'bg-slate-500', text: 'text-slate-500' },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  userId: string | null;
  spaces: SpaceItem[];
  onUpdateSpace: (id: string, name: string, color: string) => Promise<void>;
  onDeleteSpace: (space: SpaceItem) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  onDeleteAllData: () => Promise<void>;
  totalTasksCount?: number;
}

export function SettingsDialog({
  open,
  onOpenChange,
  userEmail,
  userId,
  spaces,
  onUpdateSpace,
  onDeleteSpace,
  theme,
  setTheme,
  onDeleteAllData,
  totalTasksCount = 0,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'spaces' | 'danger'>('profile');
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState('');
  const [editSpaceColor, setEditSpaceColor] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');

  const startEditSpace = (s: SpaceItem) => {
    setEditingSpaceId(s.id);
    setEditSpaceName(s.name);
    setEditSpaceColor(s.color || 'blue');
  };

  const saveEditSpace = async () => {
    if (!editingSpaceId || !editSpaceName.trim()) return;
    try {
      await onUpdateSpace(editingSpaceId, editSpaceName.trim(), editSpaceColor);
      setEditingSpaceId(null);
      toast.success('Space updated');
    } catch {
      toast.error('Failed to update space');
    }
  };

  const handleDeleteAll = async () => {
    if (confirmDeleteInput.trim().toLowerCase() !== 'delete') {
      toast.error('Please type "delete" to confirm.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await onDeleteAllData();
      toast.success('All data deleted successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete data';
      toast.error(msg);
      setIsDeletingAccount(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl gap-0 border border-border/80 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <Settings className="h-5 w-5 text-primary" />
            <span>Settings</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Manage your account preferences, themes, spaces, and data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row min-h-[380px]">
          {/* Navigation Sidebar */}
          <nav
            aria-label="Settings sections"
            className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-border/60 p-2 sm:p-3 space-y-1 bg-muted/10 shrink-0"
          >
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left ${
                activeTab === 'profile'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              <User size={16} />
              <span>Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left ${
                activeTab === 'appearance'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              <Palette size={16} />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => setActiveTab('spaces')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left ${
                activeTab === 'spaces'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              <FolderKanban size={16} />
              <span>Manage Spaces</span>
            </button>

            <button
              onClick={() => setActiveTab('danger')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left ${
                activeTab === 'danger'
                  ? 'bg-destructive text-destructive-foreground font-semibold shadow-xs'
                  : 'text-rose-500/80 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <AlertTriangle size={16} />
              <span>Danger Zone</span>
            </button>
          </nav>

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[460px]">
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">User Profile</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Account credentials and status.</p>
                </div>

                <div className="space-y-3 rounded-xl border border-border/80 p-4 bg-card/60">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email address</label>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{userEmail}</p>
                  </div>

                  {userId && (
                    <div className="pt-2 border-t border-border/50">
                      <label className="text-xs font-medium text-muted-foreground">User ID</label>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{userId}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/50 flex gap-6 text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">{spaces.length}</span> Spaces
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{totalTasksCount}</span> Active Tasks
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <form action={logout}>
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full sm:w-auto text-xs font-semibold gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut size={14} />
                      Sign out of Tidy
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">Theme & Appearance</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose how Tidy looks on your device.</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    aria-label="Switch to light theme"
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border transition-all text-xs font-medium ${
                      theme === 'light'
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30'
                        : 'border-border/80 hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sun size={20} className={theme === 'light' ? 'text-primary' : ''} />
                    <span>Light</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    aria-label="Switch to dark theme"
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border transition-all text-xs font-medium ${
                      theme === 'dark'
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30'
                        : 'border-border/80 hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Moon size={20} className={theme === 'dark' ? 'text-primary' : ''} />
                    <span>Dark</span>
                  </button>

                  <button
                    onClick={() => setTheme('system')}
                    aria-label="Switch to system theme"
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border transition-all text-xs font-medium ${
                      theme === 'system'
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30'
                        : 'border-border/80 hover:bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Laptop size={20} className={theme === 'system' ? 'text-primary' : ''} />
                    <span>System</span>
                  </button>
                </div>
              </div>
            )}

            {/* SPACES TAB */}
            {activeTab === 'spaces' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">Manage Spaces</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Rename spaces or customize their colors.</p>
                </div>

                <div className="space-y-2">
                  {spaces.map((s) => {
                    const isEditing = editingSpaceId === s.id;
                    const colorDef = AVAILABLE_COLORS.find((c) => c.name === (isEditing ? editSpaceColor : s.color)) || AVAILABLE_COLORS[0];

                    return (
                      <div
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border/70 bg-card gap-2"
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editSpaceName}
                              onChange={(e) => setEditSpaceName(e.target.value)}
                              className="h-8 text-sm font-medium"
                              placeholder="Space name"
                              autoFocus
                            />
                            <div className="flex items-center gap-1.5 pt-1">
                              {AVAILABLE_COLORS.map((c) => (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => setEditSpaceColor(c.name)}
                                  className={`h-5 w-5 rounded-full ${c.bg} transition-all ${
                                    editSpaceColor === c.name ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                                  }`}
                                  aria-label={`Select ${c.name} color`}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button size="sm" onClick={saveEditSpace} className="h-7 text-xs gap-1">
                                <Check size={12} /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingSpaceId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`h-3 w-3 rounded-full shrink-0 ${colorDef.bg}`} />
                              <span className="text-sm font-semibold truncate">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditSpace(s)}
                                aria-label={`Edit ${s.name} space`}
                              >
                                <Pencil size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  onOpenChange(false);
                                  onDeleteSpace(s);
                                }}
                                aria-label={`Delete ${s.name} space`}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DANGER ZONE TAB */}
            {activeTab === 'danger' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Irreversible actions affecting your account data.
                  </p>
                </div>

                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground text-sm">Delete Account & All Data</p>
                      <p>
                        This will permanently delete all your spaces, lists, tasks, and account history. This action
                        cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <label className="text-xs font-medium text-foreground">
                      Type <span className="font-bold text-destructive">delete</span> below to confirm:
                    </label>
                    <Input
                      value={confirmDeleteInput}
                      onChange={(e) => setConfirmDeleteInput(e.target.value)}
                      placeholder="delete"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={confirmDeleteInput.trim().toLowerCase() !== 'delete' || isDeletingAccount}
                    onClick={handleDeleteAll}
                    className="w-full text-xs font-semibold gap-2 mt-2"
                  >
                    <Trash2 size={13} />
                    {isDeletingAccount ? 'Deleting...' : 'Permanently Delete Account & Data'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
