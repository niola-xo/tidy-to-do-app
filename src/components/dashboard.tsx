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
import { Menu, Plus, Trash2, LogOut, Sun, Moon, GripVertical, Pencil, Check, X, Mic, Sparkles, Calendar, Clock, Download } from 'lucide-react';
import { createGoogleCalendarUrl, generateIcs, downloadIcsFile } from '@/utils/calendar';
import { VoiceBrainDump } from '@/components/voice-brain-dump';
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
  priority?: 'low' | 'medium' | 'high' | null;
  note?: string | null;
};

// ─── Accent colours per space ─────────────────────────────────────────────
const ACCENT_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-500',   ring: 'ring-blue-500' },
  green:  { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500' },
  purple: { bg: 'bg-violet-500',  text: 'text-violet-500',  ring: 'ring-violet-500' },
  red:    { bg: 'bg-rose-500',    text: 'text-rose-500',    ring: 'ring-rose-500' },
  orange: { bg: 'bg-orange-500',  text: 'text-orange-500',  ring: 'ring-orange-500' },
  gray:   { bg: 'bg-zinc-500',    text: 'text-zinc-500',    ring: 'ring-zinc-500' },
};
const SPACE_COLORS = Object.keys(ACCENT_COLORS);
const getAccent = (color: string) => ACCENT_COLORS[color] ?? ACCENT_COLORS.gray;


function formatDateDisplay(dateStr: string, timeStr?: string | null): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    let res = `${month} ${d}`;
    if (timeStr) {
      const clean = timeStr.slice(0, 5);
      const [hh, mm] = clean.split(':').map(Number);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const fH = hh % 12 || 12;
      res += ` at ${fH}:${String(mm).padStart(2, '0')} ${ampm}`;
    }
    return res;
  } catch {
    return dateStr;
  }
}

// ─── SortableTask ─────────────────────────────────────────────────────────
function SortableTask({
  task,
  spaceName,
  listName,
  accent,
  onToggle,
  onDelete,
  onUpdateTask,
}: {
  task: Task;
  spaceName?: string;
  listName?: string;
  accent: typeof ACCENT_COLORS[string];
  onToggle: (t: Task) => void;
  onDelete: (task: Task) => void;
  onUpdateTask?: (task: Task, updates: { text: string; due_date: string | null; due_time: string | null }) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const [editDueTime, setEditDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : '');

  const handleSave = async () => {
    if (!editText.trim()) return;
    if (onUpdateTask) {
      await onUpdateTask(task, {
      text: editText.trim(),
      due_date: editDueDate || null,
      due_time: editDueTime || null,
    });
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border bg-card transition-shadow ${isDragging ? 'shadow-xl ring-2 ' + accent.ring : 'shadow-sm hover:shadow-md'}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 touch-none">
        <GripVertical size={15} />
      </button>
      <Checkbox
        checked={task.is_done}
        onCheckedChange={() => onToggle(task)}
        className={`shrink-0 ${task.is_done ? accent.ring : ''}`}
      />

      {isEditing ? (
        <div className="flex-1 flex flex-col gap-2 py-0.5">
          <div className="flex items-center gap-2">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="h-8 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={handleSave}>
              <Check size={14} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setIsEditing(false)}>
              <X size={14} />
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <input
                type="time"
                value={editDueTime}
                onChange={(e) => setEditDueTime(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
                title="Due time"
              />
            </div>
            {(editDueDate || editDueTime) && (
              <button
                type="button"
                onClick={() => { setEditDueDate(''); setEditDueTime(''); }}
                className="text-[11px] text-muted-foreground hover:text-destructive underline"
              >
                Clear date/time
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <span
            onClick={() => {
              setEditText(task.text);
              setEditDueDate(task.due_date || '');
              setEditDueTime(task.due_time ? task.due_time.slice(0, 5) : '');
              setIsEditing(true);
            }}
            className={`flex-1 text-sm cursor-pointer transition-all ${task.is_done ? 'line-through text-muted-foreground' : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'}`}
            title="Click to edit task"
          >
            {task.text}
          </span>

          {/* Date & Time Chip + Prefilled Google Calendar 1-Click Link (AC5.2) */}
          {task.due_date && (
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                  task.is_done
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50'
                }`}
              >
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatDateDisplay(task.due_date, task.due_time)}</span>
              </span>

              <a
                href={createGoogleCalendarUrl({
                  title: task.text,
                  date: task.due_date,
                  time: task.due_time,
                  spaceName,
                  listName,
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Add to Google Calendar"
                aria-label="Add to Google Calendar"
              >
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              </a>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditText(task.text);
              setEditDueDate(task.due_date || '');
              setEditDueTime(task.due_time ? task.due_time.slice(0, 5) : '');
              setIsEditing(true);
            }}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit task"
          >
            <Pencil size={13} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(task)}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            title="Delete task"
          >
            <Trash2 size={14} />
          </Button>
        </>
      )}
    </motion.div>
  );
}

// ─── ListSection ──────────────────────────────────────────────────────────
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
  list: List | null; // null = "no list" / default group
  tasks: Task[];
  spaceName?: string;
  accent: typeof ACCENT_COLORS[string];
  onToggle: (t: Task) => void;
  onDeleteTask: (t: Task) => void;
  onDeleteList?: (l: List) => void;
  onRenameList?: (l: List, name: string) => void;
  onAddTask: (text: string, listId: string | null, dueDate?: string | null, dueTime?: string | null) => void;
  onUpdateTask: (task: Task, updates: { text: string; due_date: string | null; due_time: string | null }) => Promise<void>;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent, listId: string | null) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(list?.title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onAddTask(newTask.trim(), list?.id ?? null, newDueDate || null, newDueTime || null);
    setNewTask('');
    setNewDueDate('');
    setNewDueTime('');
    setShowDatePicker(false);
  };

  const handleRename = () => {
    if (editTitle.trim() && list && onRenameList) {
      onRenameList(list, editTitle.trim());
    }
    setEditing(false);
  };

  const done = tasks.filter(t => t.is_done).length;
  const total = tasks.length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="mb-8">
      {/* List header - only show for named lists */}
      {list && (
        <div className="flex items-center gap-2 mb-3 group/header">
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                ref={inputRef}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
                className="h-8 text-base font-semibold"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRename}><Check size={14} /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X size={14} /></Button>
            </div>
          ) : (
            <>
              <h3
                className="text-base font-semibold tracking-tight cursor-pointer hover:underline flex-1"
                onClick={() => { setEditing(true); setEditTitle(list.title); }}
              >
                {list.title}
              </h3>
              {total > 0 && (
                <span className="text-xs text-muted-foreground">{done}/{total}</span>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onDeleteList?.(list)}
              >
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Progress bar for named lists */}
      {list && total > 0 && (
        <div className="h-1 rounded-full bg-muted mb-3 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${accent.bg}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Tasks */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onDragEnd(e, list?.id ?? null)}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <AnimatePresence>
              {tasks.map(task => (
                <SortableTask key={task.id} task={task} spaceName={spaceName} listName={list?.title} accent={accent} onToggle={onToggle} onDelete={onDeleteTask} onUpdateTask={onUpdateTask} />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

            {/* Add task input */}
      <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            ref={list === null ? inputRef : undefined}
            placeholder={list ? `Add task to "${list.title}"…` : 'What needs to be done?'}
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            className="flex-1 h-10 rounded-xl border-dashed focus:border-solid"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`h-10 w-10 rounded-xl border ${showDatePicker || newDueDate ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-800' : 'text-muted-foreground'}`}
            title="Add due date & time"
          >
            <Calendar size={16} />
          </Button>
          <Button type="submit" size="icon" className={`h-10 w-10 rounded-xl ${newTask.trim() ? accent.bg : ''}`} disabled={!newTask.trim()}>
            <Plus size={18} />
          </Button>
        </div>

        {showDatePicker && (
          <div className="flex items-center gap-2 px-1 text-xs">
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
                title="Due time (optional)"
              />
            </div>
            {(newDueDate || newDueTime) && (
              <button
                type="button"
                onClick={() => { setNewDueDate(''); setNewDueTime(''); }}
                className="text-[11px] text-muted-foreground hover:text-destructive underline"
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

// ─── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({
  spaces,
  activeSpaceId,
  newSpaceName,
  setNewSpaceName,
  onSelectSpace,
  onCreateSpace,
  onDeleteSpace,
  userEmail,
  theme,
  setTheme,
  onOpenVoice,
  onOpenExport,
}: {
  spaces: Space[];
  activeSpaceId: string | null;
  newSpaceName: string;
  setNewSpaceName: (v: string) => void;
  onSelectSpace: (id: string) => void;
  onCreateSpace: (e: React.FormEvent) => void;
  onDeleteSpace: (s: Space) => void;
  userEmail: string;
  theme: string | undefined;
  setTheme: (t: string) => void;
  onOpenVoice: () => void;
  onOpenExport: () => void;
}) {
  return (
    <div className="flex flex-col h-full w-64 shrink-0 border-r bg-card px-3 py-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xl font-bold tracking-tight">Tidy</span>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>


      {/* Calendar Export Button */}
      <button
        onClick={onOpenExport}
        className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl border border-border/80 bg-secondary/30 hover:bg-secondary text-foreground font-medium text-xs transition-colors"
      >
        <Calendar className="h-3.5 w-3.5 text-indigo-500" />
        <span>Export to calendar (.ics)</span>
      </button>

      {/* Voice Brain Dump CTA Button */}
      <button
        onClick={onOpenVoice}
        className="flex items-center justify-center gap-2.5 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200 group"
      >
        <Mic className="h-4 w-4 group-hover:scale-110 transition-transform" />
        <span>Voice Brain Dump</span>
        <Sparkles className="h-3.5 w-3.5 opacity-80" />
      </button>

      {/* Spaces */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">Spaces</p>
        <div className="space-y-0.5 pr-2">
            {spaces.map(space => {
              const accent = getAccent(space.color);
              const isActive = activeSpaceId === space.id;
              return (
                <div key={space.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => onSelectSpace(space.id)}
                    className={`flex items-center gap-2.5 flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors text-left
                      ${isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${accent.bg}`} />
                    {space.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteSpace(space)}
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
                onChange={e => setNewSpaceName(e.target.value)}
                className="h-8 text-sm flex-1 min-w-0 rounded-lg"
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0 rounded-lg">
                <Plus size={15} />
              </Button>
            </form>
          </div>
        </div>

      {/* Footer */}
      <div className="border-t pt-3">
        <form action={logout}>
          <Button variant="ghost" type="submit" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2 px-2">
            <LogOut size={14} className="shrink-0" />
            <span className="truncate">{userEmail}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard({ userEmail }: { userEmail: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'space' | 'list'; item: Space | List } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadSpaces = useCallback(async (uid: string) => {
    const { data } = await supabase.from('spaces').select('*').eq('user_id', uid).order('created_at', { ascending: true });
    if (!data) return;

    if (data.length === 0) {
      // First login: create defaults
      const { data: inserted } = await supabase.from('spaces').insert([
        { name: 'Work', color: 'blue', user_id: uid },
        { name: 'Personal', color: 'green', user_id: uid },
      ]).select();
      const created = inserted ?? [];
      setSpaces(created);
      if (created.length > 0) setActiveSpaceId(created[0].id);
    } else {
      setSpaces(data);
      setActiveSpaceId(prev => prev ?? data[0].id);
    }
  }, []);

  const loadListsAndTasks = useCallback(async (spaceId: string) => {
    const [{ data: listData }, { data: taskData }] = await Promise.all([
      supabase.from('lists').select('*').eq('space_id', spaceId).order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('space_id', spaceId).order('position', { ascending: true }),
    ]);
    setLists(listData ?? []);
    setTasks(taskData ?? []);
  }, []);

  // ── Init: get user, then load spaces
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      await loadSpaces(user.id);
      setInitialized(true);
    });
  }, [loadSpaces]);

  // ── Load lists + tasks when space changes
  useEffect(() => {
    if (!activeSpaceId) return;
    loadListsAndTasks(activeSpaceId);
  }, [activeSpaceId, loadListsAndTasks]);

  // ── Space actions
  const createSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim() || !userId) return;
    const color = SPACE_COLORS[spaces.length % SPACE_COLORS.length];
    const { data, error } = await supabase
      .from('spaces')
      .insert({ name: newSpaceName.trim(), color, user_id: userId })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setSpaces(prev => [...prev, data]);
    setActiveSpaceId(data.id);
    setNewSpaceName('');
  };

  const confirmDeleteSpace = async () => {
    if (!deleteTarget || deleteTarget.type !== 'space') return;
    const space = deleteTarget.item as Space;
    await supabase.from('spaces').delete().eq('id', space.id);
    setSpaces(prev => prev.filter(s => s.id !== space.id));
    setLists(prev => prev.filter(l => l.space_id !== space.id));
    setTasks(prev => prev.filter(t => t.space_id !== space.id));
    if (activeSpaceId === space.id) {
      const remaining = spaces.filter(s => s.id !== space.id);
      setActiveSpaceId(remaining.length > 0 ? remaining[0].id : null);
    }
    setDeleteTarget(null);
    toast.success(`"${space.name}" deleted`);
  };

  // ── List actions
  const createList = async (spaceId: string) => {
    if (!userId) return;
    const title = `List ${lists.filter(l => l.space_id === spaceId).length + 1}`;
    const { data, error } = await supabase
      .from('lists')
      .insert({ title, space_id: spaceId, user_id: userId })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setLists(prev => [...prev, data]);
  };

  const renameList = async (list: List, title: string) => {
    await supabase.from('lists').update({ title }).eq('id', list.id);
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, title } : l));
  };

  const confirmDeleteList = async () => {
    if (!deleteTarget || deleteTarget.type !== 'list') return;
    const list = deleteTarget.item as List;
    await supabase.from('lists').delete().eq('id', list.id);
    // Tasks with this list_id go to default (null) group
    await supabase.from('tasks').update({ list_id: null }).eq('list_id', list.id);
    setLists(prev => prev.filter(l => l.id !== list.id));
    setTasks(prev => prev.map(t => t.list_id === list.id ? { ...t, list_id: null } : t));
    setDeleteTarget(null);
    toast.success(`"${list.title}" deleted`);
  };

  // ── Task actions
  const addTask = async (text: string, listId: string | null, dueDate?: string | null, dueTime?: string | null) => {
    if (!activeSpaceId || !userId) return;
    const position = tasks.filter(t => t.list_id === listId).length;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        text,
        list_id: listId,
        space_id: activeSpaceId,
        user_id: userId,
        position,
        due_date: dueDate || null,
        due_time: dueTime || null,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setTasks(prev => [...prev, data]);
  };

  const updateTask = async (
    task: Task,
    updates: { text: string; due_date: string | null; due_time: string | null }
  ) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        text: updates.text,
        due_date: updates.due_date,
        due_time: updates.due_time,
      })
      .eq('id', task.id)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
      toast.success('Task updated');
    }
  };

  const toggleTask = async (task: Task) => {
    const { data } = await supabase.from('tasks').update({ is_done: !task.is_done, done_at: !task.is_done ? new Date().toISOString() : null }).eq('id', task.id).select().single();
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data : t));
  };

  const deleteTask = async (task: Task) => {
    // Optimistic removal with undo
    setTasks(prev => prev.filter(t => t.id !== task.id));
    const tid = setTimeout(async () => {
      await supabase.from('tasks').delete().eq('id', task.id);
    }, 4000);

    toast('Task deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(tid);
          setTasks(prev => [...prev, task].sort((a, b) => a.position - b.position));
        },
      },
      duration: 4000,
    });
  };

  const handleDragEnd = async (event: DragEndEvent, listId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const listTasks = tasks.filter(t => t.list_id === listId);
    const oldIndex = listTasks.findIndex(t => t.id === active.id);
    const newIndex = listTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(listTasks, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }));
    setTasks(prev => {
      const others = prev.filter(t => t.list_id !== listId);
      return [...others, ...reordered].sort((a, b) => a.position - b.position);
    });
    for (const t of reordered) {
      await supabase.from('tasks').update({ position: t.position }).eq('id', t.id);
    }
  };

  // ── Calendar Export Handlers (Phase 3.5)
  const handleExportCurrentSpace = () => {
    if (!activeSpace) return;
    const currentSpaceTasks = tasks.filter(
      (t) => t.space_id === activeSpace.id && !t.is_done && t.due_date
    );

    if (currentSpaceTasks.length === 0) {
      toast.info(`No incomplete dated tasks in "${activeSpace.name}".`);
      return;
    }

    const icsContent = generateIcs({
      tasks: currentSpaceTasks,
      spaces,
      lists,
      timezone: 'Africa/Lagos',
    });

    const filename = `tidy-${activeSpace.name.toLowerCase().replace(/\s+/g, '-')}-tasks.ics`;
    downloadIcsFile(icsContent, filename);
    toast.success(`Exported ${currentSpaceTasks.length} task(s) to ${filename}`);
    setIsExportDialogOpen(false);
  };

  const handleExportAllSpaces = async () => {
    if (!userId) return;
    setIsExporting(true);
    try {
      const { data: allTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_done', false)
        .not('due_date', 'is', null);

      if (error) throw error;

      if (!allTasks || allTasks.length === 0) {
        toast.info('No incomplete dated tasks found across all spaces.');
        return;
      }

      const { data: allLists } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', userId);

      const icsContent = generateIcs({
        tasks: allTasks,
        spaces,
        lists: allLists || lists,
        timezone: 'Africa/Lagos',
      });

      downloadIcsFile(icsContent, 'tidy-all-spaces-tasks.ics');
      toast.success(`Exported ${allTasks.length} task(s) to tidy-all-spaces-tasks.ics`);
      setIsExportDialogOpen(false);
    } catch (err: unknown) {
      console.error('Export error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to export calendar';
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Computed
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const accent = getAccent(activeSpace?.color ?? 'gray');
  const spaceLists = lists.filter(l => l.space_id === activeSpaceId);

  // Delete dialog counts
  const deleteDialogInfo = (() => {
    if (!deleteTarget) return null;
    if (deleteTarget.type === 'space') {
      const s = deleteTarget.item as Space;
      const spLists = lists.filter(l => l.space_id === s.id);
      const spTasks = tasks.filter(t => t.space_id === s.id);
      return { title: `Delete "${s.name}"?`, desc: `This will permanently delete ${spLists.length} list(s) and ${spTasks.length} task(s).` };
    } else {
      const l = deleteTarget.item as List;
      const lTasks = tasks.filter(t => t.list_id === l.id);
      return { title: `Delete "${l.title}"?`, desc: `${lTasks.length} task(s) will be moved to the default group.` };
    }
  })();

  const sidebarProps = {
    spaces, activeSpaceId, newSpaceName, setNewSpaceName, userEmail, theme, setTheme,
    onSelectSpace: setActiveSpaceId,
    onCreateSpace: createSpace,
    onDeleteSpace: (s: Space) => setDeleteTarget({ type: 'space', item: s }),
    onOpenVoice: () => setIsVoiceOpen(true),
    onOpenExport: () => setIsExportDialogOpen(true),
  };

  const SidebarEl = <Sidebar {...sidebarProps} />;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{SidebarEl}</div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><Menu size={18} /></Button>} />
            <SheetContent side="left" className="p-0 w-64 flex">
              {SidebarEl}
            </SheetContent>
          </Sheet>
          <span className="font-bold text-sm">{activeSpace?.name ?? 'Tidy'}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              onClick={() => setIsVoiceOpen(true)}
              title="Voice Brain Dump"
            >
              <Mic size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <main className="max-w-2xl mx-auto px-4 py-8 md:px-8 md:py-10">
            {!initialized ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
            ) : !activeSpace ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                <p className="text-lg font-medium">No spaces yet</p>
                <p className="text-sm">Create a space in the sidebar to get started.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSpaceId!}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Space header with prominent Voice Brain Dump button */}
                  <div className="flex items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${accent.bg}`} />
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

                  {spaceLists.length === 0 ? (
                    /* Empty state — no lists yet */
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                      <div className="text-5xl">📋</div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">No lists yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Create a list to start adding tasks to this space.</p>
                      </div>
                      <button
                        onClick={() => createList(activeSpaceId!)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg ${accent.bg}`}
                      >
                        <Plus size={16} />
                        Create your first list
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Named lists */}
                      {spaceLists.map(list => (
                        <ListSection
                          key={list.id}
                          list={list}
                          tasks={tasks.filter(t => t.list_id === list.id)}
                          spaceName={activeSpace.name}
                          accent={accent}
                          onToggle={toggleTask}
                          onDeleteTask={deleteTask}
                          onDeleteList={l => setDeleteTarget({ type: 'list', item: l })}
                          onRenameList={renameList}
                          onAddTask={addTask}
                          onUpdateTask={updateTask}
                          sensors={sensors}
                          onDragEnd={handleDragEnd}
                        />
                      ))}

                      {/* Add new list */}
                      <button
                        onClick={() => createList(activeSpaceId!)}
                        className="flex items-center gap-2 text-sm font-medium mt-2 px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
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


      {/* Calendar Export Dialog (Phase 3.5) */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Export to calendar (.ics)
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Download an iCalendar (.ics) file to import your scheduled tasks into Google Calendar, Apple Calendar, or Outlook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3.5 rounded-xl border bg-card hover:bg-secondary/40 transition-colors flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Current Space ({activeSpace?.name})</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tasks.filter((t) => t.space_id === activeSpaceId && !t.is_done && t.due_date).length} incomplete dated task(s)
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleExportCurrentSpace}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
            </div>

            <div className="p-3.5 rounded-xl border bg-card hover:bg-secondary/40 transition-colors flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">All Spaces</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Export all incomplete dated tasks across your entire account
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportAllSpaces}
                disabled={isExporting}
                className="text-xs h-8 px-3"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {isExporting ? 'Preparing...' : 'Download'}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Scheduled in Africa/Lagos (WAT, UTC+1). No Google login required.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsExportDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteDialogInfo?.title}</DialogTitle>
            <DialogDescription>{deleteDialogInfo?.desc}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={deleteTarget?.type === 'space' ? confirmDeleteSpace : confirmDeleteList}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Floating Action Button (Always reachable) */}
      <button
        onClick={() => setIsVoiceOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-xl flex items-center justify-center ring-4 ring-indigo-500/20 active:scale-95 transition-transform z-30"
        aria-label="Voice Brain Dump"
      >
        <Mic className="h-6 w-6" />
      </button>

      {/* Voice Brain Dump Dialog & Review Screen */}
      {userId && (
        <VoiceBrainDump
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
          existingSpaces={spaces}
          userId={userId}
          onSaved={async () => {
            await loadSpaces(userId);
            if (activeSpaceId) await loadListsAndTasks(activeSpaceId);
          }}
        />
      )}
    </div>
  );
}
