'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Menu,
  Plus,
  Trash2,
  LogOut,
  Sun,
  Moon,
  GripVertical,
  Pencil,
  Check,
  X,
  Mic,
  Sparkles,
  Calendar,
  Clock,
  Download,
  Settings,
  Search,
  CalendarDays,
} from 'lucide-react';
import { createGoogleCalendarUrl, generateIcs, downloadIcsFile } from '@/utils/calendar';
import { VoiceBrainDump } from '@/components/voice-brain-dump';
import { SettingsDialog } from '@/components/settings-dialog';
import { TodayView } from '@/components/today-view';
import { SearchView } from '@/components/search-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { logout } from '@/app/login/actions';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ───────────────────────────────────────────────────────────────────
type Space = { id: string; name: string; color: string };
type List = { id: string; space_id: string; title: string };
type Task = {
  id: string;
  list_id: string | null;
  space_id: string;
  text: string;
  is_done: boolean;
  position: number;
  due_date?: string | null;
  due_time?: string | null;
  created_at: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  red: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  orange: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  gray: { bg: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-500' },
};

const SPACE_COLORS = ['blue', 'green', 'purple', 'red', 'orange', 'gray'];

function getAccent(color: string) {
  return ACCENT_COLORS[color] ?? ACCENT_COLORS.gray;
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDueTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const clean = timeStr.slice(0, 5);
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// ─── Sortable Task Item ───────────────────────────────────────────────────────
function SortableTask({
  task,
  spaceName,
  listName,
  onToggle,
  onDelete,
  onUpdate,
}: {
  task: Task;
  spaceName?: string;
  listName?: string;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: { text?: string; due_date?: string | null; due_time?: string | null }) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editDate, setEditDate] = useState(task.due_date || '');
  const [editTime, setEditTime] = useState(task.due_time || '');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    if (onUpdate) {
      await onUpdate(task.id, {
        text: editText.trim(),
        due_date: editDate || null,
        due_time: editTime || null,
      });
    }
    setIsEditing(false);
  };

  const gcalUrl = task.due_date
    ? createGoogleCalendarUrl({
        title: task.text,
        date: task.due_date,
        time: task.due_time,
        spaceName,
        listName,
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex flex-col rounded-xl border border-border/50 bg-card hover:border-border transition-all shadow-2xs hover:shadow-xs"
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Reorder task"
          className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors touch-none"
        >
          <GripVertical size={14} />
        </button>

        {/* Checkbox */}
        <Checkbox
          checked={task.is_done}
          onCheckedChange={() => onToggle(task)}
          aria-label={`Mark "${task.text}" as ${task.is_done ? 'incomplete' : 'complete'}`}
          className="h-4 w-4 rounded-md"
        />

        {/* Text / Inline Edit */}
        {isEditing ? (
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="h-7 text-xs flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-7 px-2 text-[11px] rounded-md border border-border bg-background"
                aria-label="Edit due date"
              />
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="h-7 px-2 text-[11px] rounded-md border border-border bg-background"
                aria-label="Edit due time"
              />
              <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleSaveEdit} aria-label="Save task edits">
                <Check size={12} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setIsEditing(false)}
                aria-label="Cancel edits"
              >
                <X size={12} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
            <span
              onClick={() => setIsEditing(true)}
              className={`text-xs sm:text-sm cursor-pointer select-none truncate transition-colors ${
                task.is_done
                  ? 'line-through text-muted-foreground/60'
                  : 'text-foreground hover:text-foreground/80'
              }`}
            >
              {task.text}
            </span>

            {/* Date and Calendar Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {task.due_date && (
                <div
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground hover:bg-secondary cursor-pointer transition-colors"
                  title="Click to edit date/time"
                >
                  <Calendar size={11} />
                  <span>{formatDateDisplay(task.due_date)}</span>
                  {task.due_time && (
                    <span className="flex items-center gap-0.5 text-indigo-500 font-semibold ml-0.5">
                      <Clock size={10} />
                      {formatDueTime(task.due_time)}
                    </span>
                  )}
                </div>
              )}

              {/* 1-Click Google Calendar Event Link */}
              {gcalUrl && (
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                  title="Add to Google Calendar"
                  aria-label="Add to Google Calendar"
                >
                  <Calendar size={13} />
                </a>
              )}

              {/* Edit button */}
              <button
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-opacity"
                aria-label="Edit task"
              >
                <Pencil size={12} />
              </button>

              {/* Delete button */}
              <button
                onClick={() => onDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="Delete task"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List Section ────────────────────────────────────────────────────────────
function ListSection({
  list,
  tasks,
  spaceName,
  accent,
  onToggle,
  onDeleteTask,
  onDeleteList,
  onRenameList,
  onAddTask,
  onUpdateTask,
  sensors,
  onDragEnd,
}: {
  list: List;
  tasks: Task[];
  spaceName: string;
  accent: { bg: string; text: string; border: string };
  onToggle: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onDeleteList: (list: List) => void;
  onRenameList: (id: string, title: string) => void;
  onAddTask: (listId: string, text: string, dueDate?: string | null, dueTime?: string | null) => void;
  onUpdateTask?: (id: string, updates: { text?: string; due_date?: string | null; due_time?: string | null }) => Promise<void>;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent, listId: string) => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [newTaskText, setNewTaskText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');

  const completedCount = tasks.filter((t) => t.is_done).length;

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onRenameList(list.id, title.trim());
      setIsEditingTitle(false);
    }
  };

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      onAddTask(list.id, newTaskText.trim(), newDueDate || null, newDueTime || null);
      setNewTaskText('');
      setNewDueDate('');
      setNewDueTime('');
      setShowDatePicker(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-xs space-y-4 mb-6">
      {/* List Header */}
      <div className="flex items-center justify-between gap-3">
        {isEditingTitle ? (
          <form onSubmit={handleTitleSubmit} className="flex items-center gap-1.5 flex-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm font-semibold"
              autoFocus
              onBlur={handleTitleSubmit}
            />
            <Button size="icon" className="h-8 w-8 shrink-0" type="submit">
              <Check size={14} />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2
              onClick={() => setIsEditingTitle(true)}
              className="text-sm sm:text-base font-bold tracking-tight cursor-pointer hover:underline truncate"
            >
              {list.title}
            </h2>
            <span className="text-[11px] font-medium text-muted-foreground shrink-0">
              {completedCount}/{tasks.length}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditingTitle(true)}
            aria-label="Rename list"
          >
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteList(list)}
            aria-label="Delete list"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, list.id)}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 min-h-[4px]">
            {tasks.map((task) => (
              <SortableTask
                key={task.id}
                task={task}
                spaceName={spaceName}
                listName={list.title}
                onToggle={onToggle}
                onDelete={onDeleteTask}
                onUpdate={onUpdateTask}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty List friendly helper */}
      {tasks.length === 0 && (
        <p className="text-xs text-muted-foreground/70 italic text-center py-2">
          No tasks in this list yet. Type below to add one.
        </p>
      )}

      {/* Add Task Form */}
      <form onSubmit={handleAddTaskSubmit} className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a task to this list…"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            className="h-9 text-xs sm:text-sm rounded-xl"
            aria-label={`Add task to ${list.title}`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowDatePicker((prev) => !prev)}
            className={`h-9 w-9 rounded-xl shrink-0 transition-colors ${
              newDueDate || showDatePicker ? 'border-primary text-primary bg-primary/10' : 'text-muted-foreground'
            }`}
            title="Set due date & time"
            aria-label="Set due date and time"
          >
            <Calendar size={14} />
          </Button>
          <Button type="submit" size="sm" className="h-9 rounded-xl px-3 text-xs font-semibold shrink-0">
            Add
          </Button>
        </div>

        {/* Date/Time pickers toggle */}
        {showDatePicker && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-muted-foreground" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                aria-label="New task due date"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-muted-foreground" />
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                aria-label="New task due time"
              />
            </div>

            {(newDueDate || newDueTime) && (
              <button
                type="button"
                onClick={() => {
                  setNewDueDate('');
                  setNewDueTime('');
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive underline ml-auto"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  spaces,
  activeView,
  onSelectView,
  newSpaceName,
  setNewSpaceName,
  onCreateSpace,
  onDeleteSpace,
  userEmail,
  todayDueCount,
  onOpenVoice,
  onOpenExport,
  onOpenSettings,
}: {
  spaces: Space[];
  activeView: string;
  onSelectView: (view: string) => void;
  newSpaceName: string;
  setNewSpaceName: (v: string) => void;
  onCreateSpace: (e: React.FormEvent) => void;
  onDeleteSpace: (s: Space) => void;
  userEmail: string;
  todayDueCount: number;
  onOpenVoice: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-64 shrink-0 border-r bg-card px-3 py-4 gap-4 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Tidy
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings size={16} />
        </Button>
      </div>

      {/* Voice Brain Dump CTA Button */}
      <button
        onClick={onOpenVoice}
        className="flex items-center justify-center gap-2.5 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200 group"
      >
        <Mic className="h-4 w-4 group-hover:scale-110 transition-transform" />
        <span>Voice Brain Dump</span>
        <Sparkles className="h-3.5 w-3.5 opacity-80" />
      </button>

      {/* Navigation: Today View */}
      <div className="space-y-1">
        <button
          onClick={() => onSelectView('today')}
          aria-label="View tasks due today"
          className={`flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeView === 'today'
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'text-foreground hover:bg-secondary/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4" />
            <span>Today</span>
          </div>
          {todayDueCount > 0 && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeView === 'today'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {todayDueCount}
            </span>
          )}
        </button>
      </div>

      {/* Spaces List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Spaces</p>
          <button
            onClick={onOpenExport}
            className="text-[11px] text-muted-foreground hover:text-indigo-500 flex items-center gap-1"
            title="Export to calendar (.ics)"
          >
            <Download size={11} />
            <span>Export</span>
          </button>
        </div>

        <div className="space-y-0.5 pr-2">
          {spaces.map((space) => {
            const accent = getAccent(space.color);
            const isActive = activeView === space.id;
            return (
              <div key={space.id} className="group flex items-center gap-1">
                <button
                  onClick={() => onSelectView(space.id)}
                  className={`flex items-center gap-2.5 flex-1 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors text-left truncate ${
                    isActive
                      ? 'bg-secondary text-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${accent.bg}`} />
                  <span className="truncate">{space.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDeleteSpace(space)}
                  aria-label={`Delete ${space.name} space`}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            );
          })}

          {/* New space form */}
          <form onSubmit={onCreateSpace} className="flex gap-1 mt-2 pr-0">
            <Input
              placeholder="New space…"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              className="h-8 text-xs flex-1 min-w-0 rounded-lg"
              aria-label="Create new space"
            />
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0 rounded-lg" aria-label="Add space">
              <Plus size={14} />
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 pt-3 flex items-center justify-between px-1">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground truncate flex-1 text-left py-1"
        >
          <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center font-bold text-[10px] text-foreground">
            {userEmail[0]?.toUpperCase() || 'U'}
          </div>
          <span className="truncate font-medium">{userEmail}</span>
        </button>

        <form action={logout}>
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Log out"
          >
            <LogOut size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard({ userEmail }: { userEmail: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<string>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'space' | 'list'; item: Space | List } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Keyboard shortcut Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // ── Load spaces and all user data
  const loadAllData = useCallback(async (uid: string) => {
    const [{ data: spacesData }, { data: listsData }, { data: tasksData }] = await Promise.all([
      supabase.from('spaces').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
      supabase.from('lists').select('*').order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').order('position', { ascending: true }),
    ]);

    let userSpaces = spacesData ?? [];

    if (userSpaces.length === 0) {
      // First login: create defaults
      const { data: inserted } = await supabase
        .from('spaces')
        .insert([
          { name: 'Work', color: 'blue', user_id: uid },
          { name: 'Personal', color: 'green', user_id: uid },
        ])
        .select();
      userSpaces = inserted ?? [];
    }

    setSpaces(userSpaces);
    setLists(listsData ?? []);
    setTasks(tasksData ?? []);

    // Set initial view
    if (userSpaces.length > 0) {
      setActiveView((prev) => (prev === 'today' ? 'today' : userSpaces[0].id));
    }
  }, [supabase]);

  // ── Init: get user, then load data
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      await loadAllData(user.id);
      setInitialized(true);
    });
  }, [loadAllData, supabase]);

  // ── Space actions
  const createSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim() || !userId) return;
    const color = SPACE_COLORS[spaces.length % SPACE_COLORS.length];
    const { data, error } = await supabase
      .from('spaces')
      .insert([{ name: newSpaceName.trim(), color, user_id: userId }])
      .select()
      .single();

    if (error) {
      toast.error('A space with this name already exists.');
      return;
    }
    if (data) {
      setSpaces((prev) => [...prev, data]);
      setActiveView(data.id);
      setNewSpaceName('');
      toast.success(`Space "${data.name}" created`);
    }
  };

  const updateSpace = async (id: string, name: string, color: string) => {
    const { error } = await supabase.from('spaces').update({ name, color }).eq('id', id);
    if (error) throw error;
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name, color } : s)));
  };

  const deleteSpaceConfirmed = async (space: Space) => {
    const { error } = await supabase.from('spaces').delete().eq('id', space.id);
    if (error) {
      toast.error('Failed to delete space');
      return;
    }
    const remaining = spaces.filter((s) => s.id !== space.id);
    setSpaces(remaining);
    setLists((prev) => prev.filter((l) => l.space_id !== space.id));
    setTasks((prev) => prev.filter((t) => t.space_id !== space.id));
    if (activeView === space.id) {
      setActiveView(remaining[0]?.id ?? 'today');
    }
    setDeleteTarget(null);
    toast.success(`Space "${space.name}" deleted`);
  };

  // ── List actions
  const createList = async (spaceId: string) => {
    if (!userId) return;
    const count = lists.filter((l) => l.space_id === spaceId).length;
    const { data, error } = await supabase
      .from('lists')
      .insert([{ title: `List ${count + 1}`, space_id: spaceId, user_id: userId }])
      .select()
      .single();
    if (error) {
      toast.error('Failed to create list');
      return;
    }
    if (data) setLists((prev) => [...prev, data]);
  };

  const renameList = async (listId: string, title: string) => {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, title } : l)));
    await supabase.from('lists').update({ title }).eq('id', listId);
  };

  const deleteListConfirmed = async (list: List) => {
    const { error } = await supabase.from('lists').delete().eq('id', list.id);
    if (error) {
      toast.error('Failed to delete list');
      return;
    }
    setLists((prev) => prev.filter((l) => l.id !== list.id));
    setTasks((prev) => prev.filter((t) => t.list_id !== list.id));
    setDeleteTarget(null);
    toast.success(`List "${list.title}" deleted`);
  };

  // ── Task actions
  const addTask = async (listId: string, text: string, dueDate?: string | null, dueTime?: string | null) => {
    if (!userId) return;
    const listTasks = tasks.filter((t) => t.list_id === listId);
    const position = listTasks.length;

    const listObj = lists.find((l) => l.id === listId);
    const spaceId = listObj?.space_id || (activeView !== 'today' ? activeView : spaces[0]?.id);

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          list_id: listId,
          space_id: spaceId,
          user_id: userId,
          text,
          position,
          due_date: dueDate || null,
          due_time: dueTime || null,
        },
      ])
      .select()
      .single();

    if (error) {
      toast.error('Failed to add task');
      return;
    }
    if (data) setTasks((prev) => [...prev, data]);
  };

  const toggleTask = async (task: Task) => {
    const nextState = !task.is_done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_done: nextState } : t)));
    const { error } = await supabase.from('tasks').update({ is_done: nextState }).eq('id', task.id);
    if (error) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_done: task.is_done } : t)));
      toast.error('Failed to update task');
    }
  };

  const updateTask = async (
    taskId: string,
    updates: { text?: string; due_date?: string | null; due_time?: string | null }
  ) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
    if (error) {
      toast.error('Failed to save task update');
      throw error;
    }
    toast.success('Task updated');
  };

  const deleteTask = async (taskId: string) => {
    const deletedTask = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      if (deletedTask) setTasks((prev) => [...prev, deletedTask]);
      toast.error('Failed to delete task');
      return;
    }

    toast('Task deleted', {
      action: deletedTask
        ? {
            label: 'Undo',
            onClick: async () => {
              const { data } = await supabase.from('tasks').insert([deletedTask]).select().single();
              if (data) setTasks((prev) => [...prev, data]);
            },
          }
        : undefined,
    });
  };

  const handleDragEnd = async (event: DragEndEvent, listId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const listTasks = tasks.filter((t) => t.list_id === listId);
    const oldIndex = listTasks.findIndex((t) => t.id === active.id);
    const newIndex = listTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(listTasks, oldIndex, newIndex).map((t, idx) => ({ ...t, position: idx }));

    setTasks((prev) => {
      const rest = prev.filter((t) => t.list_id !== listId);
      return [...rest, ...reordered];
    });

    await Promise.all(reordered.map((t) => supabase.from('tasks').update({ position: t.position }).eq('id', t.id)));
  };

  // ── Delete all data and account (AC6.5)
  const deleteAllData = async () => {
    if (!userId) return;
    await supabase.from('tasks').delete().eq('user_id', userId);
    await supabase.from('lists').delete().eq('user_id', userId);
    await supabase.from('spaces').delete().eq('user_id', userId);
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // ── Calendar Export Handlers
  const exportCurrentSpace = () => {
    const currentSpace = spaces.find((s) => s.id === activeView);
    if (!currentSpace) {
      toast.info('Please select a specific space to export its calendar.');
      return;
    }
    const currentSpaceTasks = tasks.filter((t) => t.space_id === currentSpace.id && !t.is_done && t.due_date);

    if (currentSpaceTasks.length === 0) {
      toast.info(`No incomplete dated tasks in "${currentSpace.name}".`);
      return;
    }

    const icsContent = generateIcs({
      tasks: currentSpaceTasks,
      spaces,
      lists,
      timezone: 'Africa/Lagos',
    });

    const filename = `tidy-${currentSpace.name.toLowerCase().replace(/\s+/g, '-')}-tasks.ics`;
    downloadIcsFile(icsContent, filename);
    toast.success(`Exported ${currentSpaceTasks.length} task(s) to ${filename}`);
    setIsExportDialogOpen(false);
  };

  const exportAllSpaces = () => {
    const datedIncompleteTasks = tasks.filter((t) => !t.is_done && t.due_date);

    if (datedIncompleteTasks.length === 0) {
      toast.info('No incomplete dated tasks found across any spaces.');
      return;
    }

    const icsContent = generateIcs({
      tasks: datedIncompleteTasks,
      spaces,
      lists,
      timezone: 'Africa/Lagos',
    });

    downloadIcsFile(icsContent, 'tidy-all-spaces-tasks.ics');
    toast.success(`Exported ${datedIncompleteTasks.length} task(s) to tidy-all-spaces-tasks.ics`);
    setIsExportDialogOpen(false);
  };

  // ── Computed helpers
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(
    new Date().getDate()
  ).padStart(2, '0')}`;
  const todayDueCount = tasks.filter((t) => t.due_date === todayStr && !t.is_done).length;

  const activeSpace = spaces.find((s) => s.id === activeView);
  const accent = getAccent(activeSpace?.color ?? 'gray');
  const spaceLists = activeSpace ? lists.filter((l) => l.space_id === activeSpace.id) : [];

  // Delete dialog counts
  const deleteDialogInfo = (() => {
    if (!deleteTarget) return null;
    if (deleteTarget.type === 'space') {
      const sp = deleteTarget.item as Space;
      const spLists = lists.filter((l) => l.space_id === sp.id);
      const spTasks = tasks.filter((t) => t.space_id === sp.id);
      return {
        title: `Delete Space "${sp.name}"?`,
        description: `This will permanently delete "${sp.name}", along with ${spLists.length} list(s) and ${spTasks.length} task(s). This cannot be undone.`,
        onConfirm: () => deleteSpaceConfirmed(sp),
      };
    } else {
      const li = deleteTarget.item as List;
      const liTasks = tasks.filter((t) => t.list_id === li.id);
      return {
        title: `Delete List "${li.title}"?`,
        description: `This will permanently delete "${li.title}" and its ${liTasks.length} task(s).`,
        onConfirm: () => deleteListConfirmed(li),
      };
    }
  })();

  const sidebarProps = {
    spaces,
    activeView,
    onSelectView: (v: string) => {
      setActiveView(v);
      setSearchQuery('');
    },
    newSpaceName,
    setNewSpaceName,
    onCreateSpace: createSpace,
    onDeleteSpace: (s: Space) => setDeleteTarget({ type: 'space', item: s }),
    userEmail,
    todayDueCount,
    onOpenVoice: () => setIsVoiceOpen(true),
    onOpenExport: () => setIsExportDialogOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
  };

  const SidebarEl = <Sidebar {...sidebarProps} />;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{SidebarEl}</div>

      {/* Main content container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header with Global Search and Quick Actions */}
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/70 bg-card/70 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            {/* Mobile drawer toggle */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open sidebar menu">
                      <Menu size={18} />
                    </Button>
                  }
                />
                <SheetContent side="left" className="p-0 w-64 flex">
                  {SidebarEl}
                </SheetContent>
              </Sheet>
            </div>

            {/* Global Search Bar (AC6.3) */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search all tasks... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8.5 pr-8 h-8 text-xs rounded-xl bg-muted/40 border-border/70 focus-visible:bg-background"
                aria-label="Search all tasks"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              onClick={() => setIsVoiceOpen(true)}
              title="Voice Brain Dump"
              aria-label="Voice Brain Dump"
            >
              <Mic size={17} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExportDialogOpen(true)}
              title="Export to calendar (.ics)"
              aria-label="Export to calendar"
            >
              <Download size={15} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              aria-label="Open settings"
            >
              <Settings size={15} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle light or dark theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-2xl mx-auto px-4 py-6 md:px-8 md:py-8">
            {/* 1. Loading Skeleton state (AC6.2) */}
            {!initialized ? (
              <div className="space-y-6 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-8 w-44 rounded-xl" />
                  </div>
                  <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl" />
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-28 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            ) : searchQuery.trim() ? (
              /* 2. Global Search Results View (AC6.3) */
              <SearchView
                query={searchQuery}
                tasks={tasks}
                spaces={spaces}
                lists={lists}
                onToggleTask={toggleTask}
                onDeleteTask={(t) => deleteTask(t.id)}
                onNavigateToSpace={(spaceId) => {
                  setActiveView(spaceId);
                  setSearchQuery('');
                }}
                onClearSearch={() => setSearchQuery('')}
              />
            ) : activeView === 'today' ? (
              /* 3. Today View (AC6.4) */
              <TodayView
                tasks={tasks}
                spaces={spaces}
                lists={lists}
                onToggleTask={toggleTask}
                onDeleteTask={(t) => deleteTask(t.id)}
                onOpenVoice={() => setIsVoiceOpen(true)}
                onNavigateToSpace={(spaceId) => setActiveView(spaceId)}
              />
            ) : !activeSpace ? (
              /* No spaces empty state */
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <p className="text-lg font-bold">No spaces found</p>
                <p className="text-sm text-muted-foreground">Create a space in the sidebar to get started.</p>
              </div>
            ) : (
              /* 4. Active Space View with Friendly Empty States (AC6.1) */
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSpace.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Space Header */}
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <span className={`h-3.5 w-3.5 rounded-full ${accent.bg}`} />
                      <h1 className="text-2xl font-bold tracking-tight">{activeSpace.name}</h1>
                    </div>
                    <Button
                      onClick={() => setIsVoiceOpen(true)}
                      className="hidden sm:flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm text-xs font-semibold px-3.5 h-9 transition-all hover:shadow"
                    >
                      <Mic size={14} />
                      <span>Voice Brain Dump</span>
                      <Sparkles size={13} className="opacity-80" />
                    </Button>
                  </div>

                  {/* Empty State vs Lists */}
                  {spaceLists.length === 0 ? (
                    /* Friendly Empty State with Call to Action (AC6.1) */
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4 bg-card/40 rounded-3xl border border-dashed border-border/80 p-8">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="max-w-md space-y-1.5">
                        <h3 className="text-lg font-bold text-foreground">Nothing here yet</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          Tap the mic and just talk. Tidy will organize your thoughts into clean tasks and lists automatically.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <Button
                          onClick={() => setIsVoiceOpen(true)}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs px-4 h-9 shadow-sm hover:shadow"
                        >
                          <Mic size={14} />
                          <span>Tap mic and talk</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => createList(activeSpace.id)}
                          className="flex items-center gap-2 rounded-xl text-xs font-semibold px-4 h-9"
                        >
                          <Plus size={14} />
                          <span>Create a list</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Named lists */}
                      {spaceLists.map((list) => (
                        <ListSection
                          key={list.id}
                          list={list}
                          tasks={tasks.filter((t) => t.list_id === list.id)}
                          spaceName={activeSpace.name}
                          accent={accent}
                          onToggle={toggleTask}
                          onDeleteTask={deleteTask}
                          onDeleteList={(l) => setDeleteTarget({ type: 'list', item: l })}
                          onRenameList={renameList}
                          onAddTask={addTask}
                          onUpdateTask={updateTask}
                          sensors={sensors}
                          onDragEnd={handleDragEnd}
                        />
                      ))}

                      {/* Add new list button */}
                      <button
                        onClick={() => createList(activeSpace.id)}
                        className="flex items-center gap-2 text-xs sm:text-sm font-medium mt-2 px-3 py-2 rounded-xl transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      >
                        <Plus size={15} />
                        New list
                      </button>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>

      {/* Settings Dialog (AC6.5) */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        userEmail={userEmail}
        userId={userId}
        spaces={spaces}
        onUpdateSpace={updateSpace}
        onDeleteSpace={(s) => setDeleteTarget({ type: 'space', item: s })}
        theme={theme}
        setTheme={setTheme}
        onDeleteAllData={deleteAllData}
        totalTasksCount={tasks.filter((t) => !t.is_done).length}
      />

      {/* Calendar Export Dialog (Phase 3.5) */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Export to calendar (.ics)
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Download an iCalendar (.ics) file to import your scheduled tasks into Google Calendar, Apple Calendar, or
              Outlook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <p className="text-xs text-muted-foreground">
              Only incomplete tasks with a scheduled date will be included. Timezone is set to{' '}
              <strong className="text-foreground">Africa/Lagos (WAT, UTC+1)</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                className="flex flex-col items-start gap-1 h-auto p-3.5 rounded-xl border-border/80 hover:border-primary/50 text-left"
                onClick={exportCurrentSpace}
                disabled={isExporting}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
                  <span>Current Space</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Export dated tasks from &ldquo;{activeSpace?.name ?? 'selected space'}&rdquo;
                </span>
              </Button>

              <Button
                variant="outline"
                className="flex flex-col items-start gap-1 h-auto p-3.5 rounded-xl border-border/80 hover:border-primary/50 text-left"
                onClick={exportAllSpaces}
                disabled={isExporting}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Download className="h-3.5 w-3.5 text-indigo-500" />
                  <span>All Spaces</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Export all dated tasks across all spaces
                </span>
              </Button>
            </div>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExportDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{deleteDialogInfo?.title}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{deleteDialogInfo?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={deleteDialogInfo?.onConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Brain Dump Dialog */}
      <VoiceBrainDump
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        existingSpaces={spaces}
        userId={userId || ''}
        onSaved={async () => {
          if (userId) await loadAllData(userId);
        }}
      />
    </div>
  );
}
