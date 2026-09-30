// OpenAI 제공자 — 브라우저에서 직접 호출 가능
import { DEFAULT_MODELS } from '../models.js?v=1.4.5';

export async function callOpenAI({ key, system, messages, json, settings }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: settings.openaiModel || DEFAULT_MODELS.openai,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenAI 오류 (${res.status}): ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
