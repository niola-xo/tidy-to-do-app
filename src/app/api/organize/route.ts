import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const TaskItemSchema = z.object({
  text: z.string().min(1, 'Task text cannot be empty'),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
  low_confidence: z.boolean().default(false),
});

const ListItemSchema = z.object({
  title: z.string().min(1, 'List title cannot be empty'),
  tasks: z.array(TaskItemSchema),
});

const SpaceItemSchema = z.object({
  space_name: z.string().min(1, 'Space name cannot be empty'),
  lists: z.array(ListItemSchema),
});

const OrganizeResponseSchema = z.object({
  spaces: z.array(SpaceItemSchema),
});

export type OrganizeResponse = z.infer<typeof OrganizeResponseSchema>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript, existing_spaces = [], today, timezone } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    if (transcript.length > 5000) {
      return NextResponse.json(
        { error: 'Transcript exceeds maximum allowed length of 5,000 characters' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to .env.local',
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const availableSpaces = Array.isArray(existing_spaces) && existing_spaces.length > 0
      ? existing_spaces.join(', ')
      : 'Work, Personal';

    const systemPrompt = `You are Tidy AI, an expert assistant that organizes chaotic voice brain dumps into clean, structured to-do lists.

Context:
- Today's date is: ${today || new Date().toISOString().split('T')[0]}
- User timezone is: ${timezone || 'UTC'}
- User's existing spaces are: [${availableSpaces}]

Strict Rules:
1. Extract every distinct, actionable task from the transcript.
2. Filter out conversational chatter, filler words ("um", "like", "you know"), and non-task musings.
3. Rewrite each task into clean, concise, action-oriented phrasing (e.g. "um so I need to like call the dentist tomorrow" becomes "Call the dentist").
4. Assign every task to a space. Prefer mapping to existing spaces [${availableSpaces}] when appropriate.
5. NEVER mix work and personal tasks in the same list.
6. Group related tasks inside a space into 1 or more lists with clear, short titles (e.g. "Dentist & Health", "Client Launch Prep", "Groceries").
7. Detect due dates and urgency strictly when explicitly stated (e.g. "tomorrow", "by Friday", "next Monday"). Use today's date (${today}) to resolve relative dates to YYYY-MM-DD format. If no date is stated, leave due_date as null. NEVER invent dates.
8. Detect priority if stated: "urgent", "asap", "critical" -> "high"; "standard", "normal" -> "medium"; "sometime", "low priority" -> "low". If not stated, priority is null.
9. If a task or space assignment is ambiguous (e.g. could be work or personal), choose the most likely space and set "low_confidence": true. Otherwise set "low_confidence": false.
10. Preserve the user's meaning exactly. NEVER fabricate or hallucinate tasks that were not mentioned.
11. If the transcript has no actionable tasks at all, return an empty spaces array: {"spaces": []}.

Output Format:
You MUST respond with pure JSON conforming to this schema:
{
  "spaces": [
    {
      "space_name": "Work",
      "lists": [
        {
          "title": "Client Launch Prep",
          "tasks": [
            {
              "text": "Send final proposal to Acme",
              "due_date": "2026-10-02",
              "priority": "high",
              "low_confidence": false
            }
          ]
        }
      ]
    }
  ]
}`;

    const prompt = `Please organize this voice brain dump transcript into structured spaces, lists, and tasks:\n\n"""\n${transcript}\n"""`;

    const CANDIDATE_MODELS = [
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
    ];

    let result: OrganizeResponse | null = null;
    let lastError: Error | null = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text || '';
        const parsedJson = JSON.parse(rawText);
        const validated = OrganizeResponseSchema.parse(parsedJson);
        result = validated;
        console.log(`Successfully organized tasks with model: ${model}`);
        break; // Succeeded
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed (${err?.status || err?.message}), trying fallback...`);
      }
    }

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Failed to organize tasks into the required format. Your transcript has been preserved so you can retry.',
          transcript,
          details: lastError?.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/organize:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error while organizing voice note' },
      { status: 500 }
    );
  }
}
