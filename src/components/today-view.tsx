'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Calendar,
  Clock,
  Mic,
  Sparkles,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { createGoogleCalendarUrl } from '@/utils/calendar';

export interface TodayTask {
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

export interface TodaySpace {
  id: string;
  name: string;
  color: string;
}

export interface TodayList {
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

interface TodayViewProps {
  tasks: TodayTask[];
  spaces: TodaySpace[];
  lists: TodayList[];
  onToggleTask: (task: TodayTask) => void;
  onDeleteTask: (task: TodayTask) => void;
  onOpenVoice: () => void;
  onNavigateToSpace: (spaceId: string) => void;
}

export function TodayView({
  tasks,
  spaces,
  lists,
  onToggleTask,
  onDeleteTask,
  onOpenVoice,
  onNavigateToSpace,
}: TodayViewProps) {
  // Client today date string YYYY-MM-DD
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const formattedHeaderDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Filter tasks due today
  const todayTasks = tasks.filter((t) => t.due_date === todayStr);
  const incompleteCount = todayTasks.filter((t) => !t.is_done).length;

  const spaceMap = new Map(spaces.map((s) => [s.id, s]));
  const listMap = new Map(lists.map((l) => [l.id, l.title]));

  // Group tasks by space
  const spaceGroups = spaces
    .map((space) => {
      const spaceTasks = todayTasks.filter((t) => t.space_id === space.id);
      return {
        space,
        tasks: spaceTasks,
      };
    })
    .filter((group) => group.tasks.length > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {formattedHeaderDate} •{' '}
            <span className="font-semibold text-foreground">
              {incompleteCount} task{incompleteCount === 1 ? '' : 's'} remaining
            </span>
          </p>
        </div>

        <Button
          onClick={onOpenVoice}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-sm text-xs font-semibold px-3.5 h-9 transition-all hover:shadow self-start sm:self-auto"
        >
          <Mic size={14} />
          <span>Voice Brain Dump</span>
          <Sparkles size={13} className="opacity-80" />
        </Button>
      </div>

      {/* Content */}
      {todayTasks.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4 bg-card/40 rounded-2xl border border-dashed border-border/80 p-8">
          <div className="text-4xl">☀️</div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">All clear for today!</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              No tasks scheduled for today. Take a breather or tap the mic to dump what&apos;s on your mind.
            </p>
          </div>
          <Button
            onClick={onOpenVoice}
            className="flex items-center gap-2 mt-2 rounded-xl text-xs font-semibold px-4 py-2"
          >
            <Mic size={14} />
            <span>Tap mic and talk</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {spaceGroups.map(({ space, tasks: groupTasks }) => {
            const accent = ACCENT_COLORS[space.color] || ACCENT_COLORS.gray;
            const completedInSpace = groupTasks.filter((t) => t.is_done).length;

            return (
              <div
                key={space.id}
                className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 shadow-xs space-y-3"
              >
                {/* Space Group Title */}
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <button
                    onClick={() => onNavigateToSpace(space.id)}
                    className="flex items-center gap-2.5 font-semibold text-sm sm:text-base hover:underline text-foreground group text-left"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${accent.bg}`} />
                    <span>{space.name}</span>
                    <span className="text-xs font-normal text-muted-foreground group-hover:text-foreground">
                      ({groupTasks.length} task{groupTasks.length === 1 ? '' : 's'})
                    </span>
                  </button>

                  {completedInSpace === groupTasks.length && groupTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> All completed
                    </span>
                  )}
                </div>

                {/* Tasks in Space */}
                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {groupTasks.map((task) => {
                      const listTitle = task.list_id ? listMap.get(task.list_id) : null;
                      const gcalUrl = task.due_date
                        ? createGoogleCalendarUrl({
                            title: task.text,
                            date: task.due_date,
                            time: task.due_time,
                            spaceName: space.name,
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
                          className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
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

                            <span
                              className={`text-xs sm:text-sm truncate select-none ${
                                task.is_done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                              }`}
                            >
                              {task.text}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* List Name Tag */}
                            {listTitle && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground truncate max-w-[120px]">
                                {listTitle}
                              </span>
                            )}

                            {/* Time Pill */}
                            {task.due_time ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                <Clock size={11} />
                                {formatDueTime(task.due_time)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-muted-foreground">All day</span>
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

                            {/* Delete Button */}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
