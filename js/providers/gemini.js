// Gemini 제공자 — 브라우저에서 직접 호출 가능 (API 키 방식, CORS 지원)
import { DEFAULT_MODELS } from '../models.js?v=1.4.8';

export async function callGemini({ key, system, messages, json, settings }) {
  const model = settings.geminiModel || DEFAULT_MODELS.gemini;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system || '' }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1500,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini 오류 (${res.status}): ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  if (!text) {
    throw new Error(
      `Gemini 오류: 빈 응답 (finishReason: ${data.candidates?.[0]?.finishReason || 'unknown'})`
    );
  }
  return text;
}
