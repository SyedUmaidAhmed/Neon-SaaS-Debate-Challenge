import { GoogleGenAI, Type } from '@google/genai';
import { Agent, Article, Message } from '../types';

let aiInstance: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function* streamAgentResponse(
  topic: string,
  agent: Agent,
  opponent: Agent,
  history: Message[]
) {
  const ai = getAI();
  const historyText = history.map(msg => {
    const speakerName = msg.agentId === agent.id ? agent.name : opponent.name;
    return `${speakerName}: ${msg.content}`;
  }).join('\n');

  const prompt = `Topic: ${topic}\nHistory of Debate:\n${historyText ? historyText : "No previous history."}\n\nRespond as ${agent.name}. Debate your perspective. Keep your response extremely short and punchy (1-2 sentences maximum). Make it sound conversational, highly engaging, and easily scannable, like a fast-paced podcast. NEVER write long paragraphs. Less text is better!`;

  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: agent.persona, temperature: 0.8 }
  });

  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 3000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if ((e?.status === 429 || String(e).includes('429') || String(e).includes('quota')) && i < retries - 1) {
        console.warn(`429 Rate Limit hit. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backend
      } else {
        throw e;
      }
    }
  }
  throw new Error("Unreachable");
}

export async function generateAgentTurn(prompt: string): Promise<string> {
  const ai = getAI();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: { temperature: 0.8 }
    });
    return response.text || '';
  }, 3, 4000); // Allow up to 3 retries starting at 4 seconds
}

export async function generateAgentSpeech(text: string, voiceName: string): Promise<string | null> {
  const ai = getAI();
  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"] as any,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    }, 2, 3000); // Retry TTS once just in case
  } catch (e) {
    console.error("Failed to generate speech after retries", e);
    return null;
  }
}

export async function compileArticle(
  topic: string,
  history: Message[],
  agents: Agent[]
): Promise<Article> {
  const ai = getAI();
  if (history.length === 0) {
    return { body: "The debate has not started yet. Waiting for arguments...", summaryPoints: [] };
  }
  const historyText = history.map(msg => {
    const speaker = agents.find(a => a.id === msg.agentId)?.name || 'Unknown';
    return `${speaker}: ${msg.content}`;
  }).join('\n');

  try {
    const response = await withRetry(async () => {
      return ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Topic: ${topic}\n\nTranscript:\n${historyText}\n\nAct as an expert journalist. Write a compelling article synthesizing the arguments presented so far. Provide multiple summary bullet points highlighting the main clashes. Output in JSON format.`,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              body: { type: Type.STRING, description: "The main body of the article analyzing the debate so far, formatted in markdown." },
              summaryPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key bullet points summarizing the arguments." }
            },
            required: ["body", "summaryPoints"]
          }
        }
      });
    }, 3, 5000);
    
    const data = JSON.parse(response.text || '{}');
    return { body: data.body || "Error compiling body.", summaryPoints: data.summaryPoints || [] };
  } catch (e) {
    console.error("Failed to parse or compile article JSON:", e);
    return { body: "Failed to compile article.", summaryPoints: [] };
  }
}

export async function* streamRealtimeAnalysis(
  topic: string,
  currentArgument: string,
  speakerName: string
) {
  const ai = getAI();
  const prompt = `Topic: ${topic}
Current Speaker: ${speakerName}
Argument: "${currentArgument}"

Write exactly ONE extremely concise, analytical bullet point (max 15 words) taking a "note" on this argument's logic or tactic. Do not output anything else. Start with a hyphen.`;

  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { temperature: 0.4 }
  });

  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
