'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mic,
  MicOff,
  Sparkles,
  RotateCcw,
  Trash2,
  Plus,
  AlertCircle,
  Calendar,
  Flag,
  ArrowRight,
  CheckCircle2,
  X,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

export type ProposedTask = {
  id: string;
  text: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  low_confidence?: boolean;
};

export type ProposedList = {
  id: string;
  title: string;
  tasks: ProposedTask[];
};

export type ProposedSpace = {
  id: string;
  space_name: string;
  lists: ProposedList[];
};

interface VoiceBrainDumpProps {
  isOpen: boolean;
  onClose: () => void;
  existingSpaces: { id: string; name: string; color: string }[];
  userId: string;
  onSaved: () => Promise<void>;
}

export function VoiceBrainDump({
  isOpen,
  onClose,
  existingSpaces,
  userId,
  onSaved,
}: VoiceBrainDumpProps) {
  // Stage: 'record' | 'review'
  const [stage, setStage] = useState<'record' | 'review'>('record');

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [interimText, setInterimText] = useState('');

  // Organizing state
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeError, setOrganizeError] = useState<string | null>(null);

  // Review stage state
  const [proposedSpaces, setProposedSpaces] = useState<ProposedSpace[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');

  // Keep currentTranscriptRef in sync with transcript
  useEffect(() => {
    currentTranscriptRef.current = transcript;
  }, [transcript]);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSpeechSupported(false);
      }
    }
  }, []);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setStage('record');
      setTranscript('');
      setInterimText('');
      baseTranscriptRef.current = '';
      currentTranscriptRef.current = '';
      setOrganizeError(null);
      setProposedSpaces([]);
    }
  }, [isOpen]);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    shouldListenRef.current = true;
    setIsListening(true);
    setPermissionDenied(false);
    baseTranscriptRef.current = currentTranscriptRef.current.trim();

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      const recognition = new SpeechRecognition();
      // On mobile, single phrase mode avoids buffer repetition; on desktop, continuous mode keeps mic open
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      // Use user's local browser language and dialect (e.g. en-GB, en-NG, en-US) for maximum phonetic accuracy
      recognition.lang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          setPermissionDenied(true);
          toast.error('Microphone access denied. You can type or paste below.');
          return;
        }

        console.warn('Speech recognition notice:', event.error);
      };

      recognition.onend = () => {
        // If user hasn't explicitly paused, auto-restart seamlessly
        if (shouldListenRef.current) {
          baseTranscriptRef.current = currentTranscriptRef.current.trim();
          try {
            recognition.start();
          } catch (e) {
            setTimeout(() => {
              if (shouldListenRef.current) {
                try {
                  recognition.start();
                } catch (err) {}
              }
            }, 60);
          }
        } else {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognition.onresult = (event: any) => {
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            const piece = res[0].transcript.trim();
            if (piece) {
              const base = baseTranscriptRef.current;
              baseTranscriptRef.current = (base ? base + ' ' : '') + piece;
            }
          } else {
            interim += res[0].transcript;
          }
        }

        const base = baseTranscriptRef.current;
        const separator = base && interim.trim() ? ' ' : '';
        const combined = (base + separator + interim).replace(/\s+/g, ' ').trim();

        setTranscript(combined.slice(0, 5000));
        currentTranscriptRef.current = combined.slice(0, 5000);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      shouldListenRef.current = false;
    }
  };

  const stopListening = () => {
    shouldListenRef.current = false;
    setInterimText('');
    baseTranscriptRef.current = currentTranscriptRef.current.trim();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleOrganize = async () => {
    stopListening();
    if (!transcript.trim()) {
      toast.error('Please speak or type some tasks first.');
      return;
    }

    if (transcript.length > 5000) {
      toast.error('Transcript exceeds 5,000 characters. Please shorten it.');
      return;
    }

    setIsOrganizing(true);
    setOrganizeError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const spaceNames = existingSpaces.map((s) => s.name);

      const res = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.trim(),
          existing_spaces: spaceNames,
          today,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to organize tasks');
      }

      if (!data.spaces || data.spaces.length === 0) {
        toast.info('No actionable tasks were detected. Try adding more details!');
        setIsOrganizing(false);
        return;
      }

      // Add temporary client IDs for easy editing
      const formattedSpaces: ProposedSpace[] = data.spaces.map((sp: any, spIdx: number) => ({
        id: `space-${spIdx}-${Date.now()}`,
        space_name: sp.space_name,
        lists: sp.lists.map((ls: any, lsIdx: number) => ({
          id: `list-${spIdx}-${lsIdx}-${Date.now()}`,
          title: ls.title,
          tasks: ls.tasks.map((t: any, tIdx: number) => ({
            id: `task-${spIdx}-${lsIdx}-${tIdx}-${Date.now()}`,
            text: t.text,
            due_date: t.due_date || null,
            priority: t.priority || null,
            low_confidence: Boolean(t.low_confidence),
          })),
        })),
      }));

      setProposedSpaces(formattedSpaces);
      setStage('review');
    } catch (err: any) {
      console.error('Organize error:', err);
      setOrganizeError(err.message || 'Error communicating with AI service');
      toast.error(err.message || 'Could not organize. Transcript preserved!');
    } finally {
      setIsOrganizing(false);
    }
  };

  // ── Review Screen Interactions ──
  const updateTaskText = (spaceIdx: number, listIdx: number, taskIdx: number, newText: string) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].tasks[taskIdx].text = newText;
      return clone;
    });
  };

  const updateTaskDueDate = (spaceIdx: number, listIdx: number, taskIdx: number, newDate: string) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].tasks[taskIdx].due_date = newDate || null;
      return clone;
    });
  };

  const updateTaskPriority = (
    spaceIdx: number,
    listIdx: number,
    taskIdx: number,
    p: 'low' | 'medium' | 'high' | null
  ) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].tasks[taskIdx].priority = p;
      return clone;
    });
  };

  const deleteTask = (spaceIdx: number, listIdx: number, taskIdx: number) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].tasks.splice(taskIdx, 1);
      // Remove empty list if all tasks deleted
      if (clone[spaceIdx].lists[listIdx].tasks.length === 0) {
        clone[spaceIdx].lists.splice(listIdx, 1);
      }
      // Remove space if all lists deleted
      if (clone[spaceIdx].lists.length === 0) {
        clone.splice(spaceIdx, 1);
      }
      return clone;
    });
  };

  const updateListTitle = (spaceIdx: number, listIdx: number, newTitle: string) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].title = newTitle;
      return clone;
    });
  };

  const deleteList = (spaceIdx: number, listIdx: number) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists.splice(listIdx, 1);
      if (clone[spaceIdx].lists.length === 0) {
        clone.splice(spaceIdx, 1);
      }
      return clone;
    });
  };

  const addTaskToList = (spaceIdx: number, listIdx: number) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      clone[spaceIdx].lists[listIdx].tasks.push({
        id: `task-manual-${Date.now()}`,
        text: 'New task',
        due_date: null,
        priority: null,
        low_confidence: false,
      });
      return clone;
    });
  };

  const moveTaskToSpace = (fromSpaceIdx: number, fromListIdx: number, taskIdx: number, targetSpaceName: string) => {
    setProposedSpaces((prev) => {
      const clone = [...prev];
      const task = clone[fromSpaceIdx].lists[fromListIdx].tasks.splice(taskIdx, 1)[0];
      task.low_confidence = false; // Resolved ambiguity

      // Find or create target space
      let targetSpace = clone.find((s) => s.space_name.toLowerCase() === targetSpaceName.toLowerCase());
      if (!targetSpace) {
        targetSpace = {
          id: `space-${Date.now()}`,
          space_name: targetSpaceName,
          lists: [
            {
              id: `list-${Date.now()}`,
              title: 'General',
              tasks: [],
            },
          ],
        };
        clone.push(targetSpace);
      }

      if (targetSpace.lists.length === 0) {
        targetSpace.lists.push({
          id: `list-${Date.now()}`,
          title: 'General',
          tasks: [],
        });
      }

      targetSpace.lists[0].tasks.push(task);

      // Clean up empty containers
      if (clone[fromSpaceIdx].lists[fromListIdx].tasks.length === 0) {
        clone[fromSpaceIdx].lists.splice(fromListIdx, 1);
      }
      if (clone[fromSpaceIdx].lists.length === 0) {
        clone.splice(fromSpaceIdx, 1);
      }

      return clone;
    });
  };

  // ── Save to Database ──
  const handleSaveToDatabase = async () => {
    if (proposedSpaces.length === 0) {
      toast.error('No tasks to save.');
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      // 1. Ensure spaces exist or create them
      for (const sp of proposedSpaces) {
        let spaceRecord = existingSpaces.find(
          (s) => s.name.toLowerCase() === sp.space_name.toLowerCase()
        );

        let spaceId = spaceRecord?.id;

        if (!spaceId) {
          // Create new space
          const colors = ['blue', 'green', 'purple', 'red', 'orange', 'gray'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const { data: newSpace, error: spaceErr } = await supabase
            .from('spaces')
            .insert({
              name: sp.space_name,
              color: randomColor,
              user_id: userId,
            })
            .select()
            .single();

          if (spaceErr || !newSpace) {
            console.error('Failed to create space:', spaceErr);
            throw new Error(`Failed to create space "${sp.space_name}"`);
          }
          spaceId = newSpace.id;
        }

        // 2. Insert lists & tasks
        for (const ls of sp.lists) {
          // Check if list with title already exists in this space
          const { data: existingLists } = await supabase
            .from('lists')
            .select('*')
            .eq('space_id', spaceId)
            .eq('title', ls.title);

          let listId = existingLists && existingLists.length > 0 ? existingLists[0].id : null;

          if (!listId) {
            const { data: newList, error: listErr } = await supabase
              .from('lists')
              .insert({
                title: ls.title,
                space_id: spaceId,
                user_id: userId,
              })
              .select()
              .single();

            if (listErr || !newList) {
              console.error('Failed to create list:', listErr);
              throw new Error(`Failed to create list "${ls.title}"`);
            }
            listId = newList.id;
          }

          // 3. Insert tasks
          const taskRows = ls.tasks.map((t, idx) => ({
            text: t.text,
            is_done: false,
            due_date: t.due_date || null,
            priority: t.priority || null,
            space_id: spaceId,
            list_id: listId,
            user_id: userId,
            position: idx,
          }));

          if (taskRows.length > 0) {
            const { error: taskErr } = await supabase.from('tasks').insert(taskRows);
            if (taskErr) {
              console.error('Failed to insert tasks:', taskErr);
              throw new Error(`Failed to save tasks for list "${ls.title}"`);
            }
          }
        }
      }

      toast.success('Successfully added all tasks to your spaces!');
      await onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save organized tasks');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92dvh] flex flex-col p-4 sm:p-6 overflow-hidden rounded-2xl">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            {stage === 'record' ? 'Voice Brain Dump' : 'Review & Confirm Tasks'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {stage === 'record'
              ? 'Ramble out your thoughts freely. Tidy AI will categorize and turn them into organized checklists.'
              : 'Review proposed spaces, lists, and tasks. You can edit, delete, or reassign anything before saving.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'record' ? (
          <div className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-y-auto py-2 sm:py-3 min-h-0">
            {/* Live Visualizer & Mic Control */}
            <div className="shrink-0 flex flex-col items-center justify-center py-5 px-4 rounded-2xl bg-secondary/30 border border-border/50 relative">
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl bg-indigo-500/10 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              {/* Pulsing Animated Mic Button */}
              <div className="relative my-2 flex items-center justify-center">
                {isListening && (
                  <motion.div
                    className="absolute -inset-3 rounded-full bg-indigo-500/25 pointer-events-none"
                    animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0.2, 0.7] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                  />
                )}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full shadow-lg transition-all duration-300 relative z-10 flex items-center justify-center text-white active:scale-95 ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 ring-4 ring-rose-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-500/10'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
                  ) : (
                    <Mic className="h-7 w-7 sm:h-8 sm:w-8" />
                  )}
                </button>
              </div>

              <div className="text-center mt-1">
                <p className="font-semibold text-xs sm:text-sm">
                  {isListening ? (
                    <span className="text-rose-500 flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      Listening... tap to pause
                    </span>
                  ) : transcript ? (
                    'Paused — tap mic to resume speaking'
                  ) : (
                    'Tap to start speaking'
                  )}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Speak naturally about both work and personal tasks. We’ll sort it out.
                </p>
              </div>
            </div>

            {/* Permission or Unsupported Fallback Notice */}
            {(!isSpeechSupported || permissionDenied) && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {permissionDenied
                      ? 'Microphone permission was denied.'
                      : 'Speech Recognition is not supported in this browser.'}
                  </p>
                  <p className="mt-0.5 opacity-90">
                    No worries! You can type or paste your thoughts directly in the box below and click
                    Organize.
                  </p>
                </div>
              </div>
            )}

            {/* Editable Transcript Area */}
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-medium">Transcript (Editable):</span>
                <span className={transcript.length > 4500 ? 'text-rose-500 font-semibold' : ''}>
                  {transcript.length} / 5,000 chars
                </span>
              </div>
              <textarea
                value={transcript}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 5000);
                  setTranscript(val);
                  baseTranscriptRef.current = val;
                }}
                placeholder="I need to submit the tax report by Friday and review the client contract for work tomorrow. Also remind me to buy groceries like almond milk and apples, and schedule a haircut for Saturday."
                rows={5}
                className="w-full flex-1 min-h-[140px] p-3.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans leading-relaxed"
              />
              {interimText && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                  <span className="italic truncate">Listening: &ldquo;{interimText}&rdquo;</span>
                </div>
              )}
            </div>

            {organizeError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center justify-between">
                <span>{organizeError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOrganize}
                  className="h-7 text-xs ml-2"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ── STAGE: REVIEW ── */
          <div className="flex-1 overflow-y-auto py-3 space-y-5 pr-1">
            {proposedSpaces.map((sp, spIdx) => (
              <div
                key={sp.id}
                className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm"
              >
                {/* Space Header */}
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <h3 className="font-bold text-base tracking-tight">{sp.space_name} Space</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {sp.lists.reduce((acc, l) => acc + l.tasks.length, 0)} tasks
                  </span>
                </div>

                {/* Lists */}
                <div className="space-y-4 pl-1">
                  {sp.lists.map((ls, lsIdx) => (
                    <div key={ls.id} className="space-y-2.5 bg-muted/20 p-3 rounded-xl border border-border/40">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={ls.title}
                          onChange={(e) => updateListTitle(spIdx, lsIdx, e.target.value)}
                          className="h-7 font-semibold text-sm bg-transparent border-none px-1 focus-visible:ring-1 focus-visible:ring-indigo-500"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => addTaskToList(spIdx, lsIdx)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Add task to this list"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteList(spIdx, lsIdx)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Delete this list"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Tasks in List */}
                      <div className="space-y-2">
                        {ls.tasks.map((t, tIdx) => (
                          <div
                            key={t.id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border text-sm bg-background/90 ${
                              t.low_confidence
                                ? 'border-amber-500/50 bg-amber-500/5'
                                : 'border-border'
                            }`}
                          >
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <Input
                                value={t.text}
                                onChange={(e) =>
                                  updateTaskText(spIdx, lsIdx, tIdx, e.target.value)
                                }
                                className="h-8 text-sm border-none bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-indigo-500 flex-1"
                              />
                            </div>

                            {/* Metadata & Controls */}
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {/* Low confidence flag */}
                              {t.low_confidence && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="h-3 w-3" />
                                  Check Space
                                </span>
                              )}

                              {/* Due Date selector */}
                              <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <input
                                  type="date"
                                  value={t.due_date || ''}
                                  onChange={(e) =>
                                    updateTaskDueDate(spIdx, lsIdx, tIdx, e.target.value)
                                  }
                                  className="bg-transparent text-xs text-foreground focus:outline-none"
                                />
                              </div>

                              {/* Priority selector */}
                              <select
                                value={t.priority || ''}
                                onChange={(e) =>
                                  updateTaskPriority(
                                    spIdx,
                                    lsIdx,
                                    tIdx,
                                    (e.target.value as any) || null
                                  )
                                }
                                className="bg-muted text-xs text-foreground rounded-md px-2 py-1 border-none focus:outline-none cursor-pointer"
                              >
                                <option value="">No Priority</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>

                              {/* Move Space dropdown if ambiguous */}
                              <select
                                value={sp.space_name}
                                onChange={(e) =>
                                  moveTaskToSpace(spIdx, lsIdx, tIdx, e.target.value)
                                }
                                className="bg-muted text-xs text-muted-foreground hover:text-foreground rounded-md px-2 py-1 border-none focus:outline-none cursor-pointer"
                                title="Move task to another space"
                              >
                                {['Work', 'Personal', ...existingSpaces.map((s) => s.name)]
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .map((sName) => (
                                    <option key={sName} value={sName}>
                                      → {sName}
                                    </option>
                                  ))}
                              </select>

                              {/* Delete task */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTask(spIdx, lsIdx, tIdx)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom clean footer without negative margin clipping */}
        <div className="pt-3 border-t mt-auto shrink-0 flex items-center justify-between gap-2 w-full">
          {stage === 'record' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTranscript('');
                  baseTranscriptRef.current = '';
                  stopListening();
                }}
                disabled={!transcript || isOrganizing}
                className="text-xs text-muted-foreground px-2 h-9"
              >
                Clear text
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={isOrganizing} className="h-9">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleOrganize}
                  disabled={!transcript.trim() || isOrganizing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-9 px-4 shadow-sm"
                >
                  {isOrganizing ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Organizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Organize
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStage('record')}
                disabled={isSaving}
                className="text-xs h-9"
              >
                ← Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-9">
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving || proposedSpaces.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9 px-4 shadow-sm"
                >
                  {isSaving ? (
                    'Saving...'
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Add to my lists
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
