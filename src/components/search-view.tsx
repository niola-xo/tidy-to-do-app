'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Search,
  Calendar,
  Clock,
  Trash2,
  X,
} from 'lucide-react';
import { createGoogleCalendarUrl } from '@/utils/calendar';

export interface SearchTask {
  id: string;
  list_id: string | null;
  space_id: string;
  text: string;
  is_done: boolean;
  position: number;
  due_date?: string | null;
  due_time?: string | null;
  created_at: string;
}

export interface SearchSpace {
  id: string;
  name: string;
  color: string;
}

export interface SearchList {
  id: string;
  space_id: string;
  title: string;
}

const ACCENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  red: { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  orange: { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  gray: { bg: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-500' },
};

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

interface SearchViewProps {
  query: string;
  tasks: SearchTask[];
  spaces: SearchSpace[];
  lists: SearchList[];
  onToggleTask: (task: SearchTask) => void;
  onDeleteTask: (task: SearchTask) => void;
  onNavigateToSpace: (spaceId: string) => void;
  onClearSearch: () => void;
}

export function SearchView({
  query,
  tasks,
  spaces,
  lists,
  onToggleTask,
  onDeleteTask,
  onNavigateToSpace,
  onClearSearch,
}: SearchViewProps) {
  const cleanQuery = query.trim().toLowerCase();

  const spaceMap = new Map(spaces.map((s) => [s.id, s]));
  const listMap = new Map(lists.map((l) => [l.id, l.title]));

  // Search filtering across task text, space name, or list title
  const matchingTasks = tasks.filter((t) => {
    if (!cleanQuery) return false;
    const taskTextMatch = t.text.toLowerCase().includes(cleanQuery);
    const space = spaceMap.get(t.space_id);
    const spaceMatch = space?.name.toLowerCase().includes(cleanQuery);
    const listTitle = t.list_id ? listMap.get(t.list_id) : '';
    const listMatch = listTitle?.toLowerCase().includes(cleanQuery);
    return taskTextMatch || spaceMatch || listMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Search Results</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Found {matchingTasks.length} result{matchingTasks.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSearch}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <X size={14} />
          <span>Clear search</span>
        </Button>
      </div>

      {/* Results */}
      {matchingTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-card/40 rounded-2xl border border-dashed border-border/80 p-8">
          <div className="text-3xl">🔍</div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-semibold text-foreground">No tasks found</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              We couldn&apos;t find any tasks matching &ldquo;{query}&rdquo;. Try another word or search for a space name.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {matchingTasks.map((task) => {
              const space = spaceMap.get(task.space_id);
              const listTitle = task.list_id ? listMap.get(task.list_id) : null;
              const accent = space ? (ACCENT_COLORS[space.color] || ACCENT_COLORS.gray) : ACCENT_COLORS.gray;

              const gcalUrl = task.due_date
                ? createGoogleCalendarUrl({
                    title: task.text,
                    date: task.due_date,
                    time: task.due_time,
                    spaceName: space?.name,
                    listName: listTitle || undefined,
                  })
                : null;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                    task.is_done
                      ? 'bg-muted/30 border-transparent opacity-60'
                      : 'bg-background hover:bg-muted/40 border-border/60 hover:border-border shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={task.is_done}
                      onCheckedChange={() => onToggleTask(task)}
                      aria-label={`Mark "${task.text}" as ${task.is_done ? 'incomplete' : 'complete'}`}
                      className="h-4 w-4 rounded-md"
                    />

                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-xs sm:text-sm block truncate select-none ${
                          task.is_done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                        }`}
                      >
                        {task.text}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Space Label with color dot */}
                    {space && (
                      <button
                        onClick={() => {
                          onClearSearch();
                          onNavigateToSpace(space.id);
                        }}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                        title={`Go to space "${space.name}"`}
                      >
                        <span className={`h-2 w-2 rounded-full shrink-0 ${accent.bg}`} />
                        <span>{space.name}</span>
                      </button>
                    )}

                    {/* List tag */}
                    {listTitle && (
                      <span className="hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground truncate max-w-[100px]">
                        {listTitle}
                      </span>
                    )}

                    {/* Date / Time */}
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Calendar size={11} />
                        {formatDateDisplay(task.due_date)}
                        {task.due_time && (
                          <span className="flex items-center gap-0.5 text-indigo-500 font-semibold">
                            <Clock size={10} />
                            {formatDueTime(task.due_time)}
                          </span>
                        )}
                      </span>
                    )}

                    {/* Google Calendar Link */}
                    {gcalUrl && (
                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Add to Google Calendar"
                        aria-label="Add to Google Calendar"
                        className="p-1 text-muted-foreground hover:text-indigo-500 transition-colors"
                      >
                        <Calendar size={13} />
                      </a>
                    )}

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteTask(task)}
                      aria-label={`Delete task "${task.text}"`}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
