// Claude 제공자 — 브라우저 직접 호출 불가 (api.anthropic.com은 CORS 미지원)
// 반드시 프록시(Cloudflare Workers 등)를 거쳐야 한다. README의 예제 참조.
export async function callClaude({ key, proxy, system, messages, settings }) {
  const base = (proxy || '').replace(/\/$/, '');
  const res = await fetch(base + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.claudeModel || 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system,
      messages: messages.map((m) => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Claude 오류 (${res.status}): ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('').trim();
}
