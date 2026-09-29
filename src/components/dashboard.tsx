'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Menu, Plus, Trash2, LogOut, Sun, Moon, GripVertical, Pencil, Check, X } from 'lucide-react';
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
type Task = { id: string; list_id: string | null; space_id: string; text: string; is_done: boolean; position: number };

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

// ─── SortableTask ─────────────────────────────────────────────────────────
function SortableTask({
  task,
  accent,
  onToggle,
  onDelete,
}: {
  task: Task;
  accent: typeof ACCENT_COLORS[string];
  onToggle: (t: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

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
      <span className={`flex-1 text-sm transition-all ${task.is_done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {task.text}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(task)}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 size={14} />
      </Button>
    </motion.div>
  );
}

// ─── ListSection ──────────────────────────────────────────────────────────
function ListSection({
  list,
  tasks,
  accent,
  onToggle,
  onDeleteTask,
  onDeleteList,
  onRenameList,
  onAddTask,
  sensors,
  onDragEnd,
}: {
  list: List | null; // null = "no list" / default group
  tasks: Task[];
  accent: typeof ACCENT_COLORS[string];
  onToggle: (t: Task) => void;
  onDeleteTask: (t: Task) => void;
  onDeleteList?: (l: List) => void;
  onRenameList?: (l: List, name: string) => void;
  onAddTask: (text: string, listId: string | null) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent, listId: string | null) => void;
}) {
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(list?.title ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onAddTask(newTask.trim(), list?.id ?? null);
    setNewTask('');
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
                <SortableTask key={task.id} task={task} accent={accent} onToggle={onToggle} onDelete={onDeleteTask} />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {/* Add task input */}
      <form onSubmit={handleAdd} className="flex gap-2 mt-3">
        <Input
          ref={list === null ? inputRef : undefined}
          placeholder={list ? `Add task to "${list.title}"…` : 'What needs to be done?'}
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          className="flex-1 h-10 rounded-xl border-dashed focus:border-solid"
        />
        <Button type="submit" size="icon" className={`h-10 w-10 rounded-xl ${newTask.trim() ? accent.bg : ''}`} disabled={!newTask.trim()}>
          <Plus size={18} />
        </Button>
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
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Init: get user, then load spaces
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      await loadSpaces(user.id);
      setInitialized(true);
    });
  }, []);

  // ── Load lists + tasks when space changes
  useEffect(() => {
    if (!activeSpaceId) return;
    loadListsAndTasks(activeSpaceId);
  }, [activeSpaceId]);

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
  const addTask = async (text: string, listId: string | null) => {
    if (!activeSpaceId || !userId) return;
    const position = tasks.filter(t => t.list_id === listId).length;
    const { data, error } = await supabase
      .from('tasks')
      .insert({ text, list_id: listId, space_id: activeSpaceId, user_id: userId, position })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setTasks(prev => [...prev, data]);
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

  // ── Computed
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const accent = getAccent(activeSpace?.color ?? 'gray');
  const spaceLists = lists.filter(l => l.space_id === activeSpaceId);
  const unlistedTasks = tasks.filter(t => t.space_id === activeSpaceId && t.list_id === null);

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
          <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
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
                  {/* Space header */}
                  <div className="flex items-center gap-3 mb-8">
                    <span className={`h-3 w-3 rounded-full ${accent.bg}`} />
                    <h1 className="text-2xl font-bold tracking-tight">{activeSpace.name}</h1>
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
                          accent={accent}
                          onToggle={toggleTask}
                          onDeleteTask={deleteTask}
                          onDeleteList={l => setDeleteTarget({ type: 'list', item: l })}
                          onRenameList={renameList}
                          onAddTask={addTask}
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
    </div>
  );
}
