// 모아 — AI 일러스트 생성 (Gemini 이미지 모델, Nano Banana 2)
// ⚠️ 유료 호출: API 키에 결제(billing) 연결이 필요. 무료 티어 없음.
// 1K 기준 장당 약 $0.034~0.067. 날짜별 캐시로 같은 날 중복 과금 방지.
export const ILLUST_MODEL = 'gemini-3.1-flash-image';

export function illustPrompt({ summary, highlights }) {
  const scene = [summary, ...(highlights || []).slice(0, 3)].join(' / ');
  return (
    `Warm, cozy paper-diary style illustration capturing the feeling of this day: ${scene}. ` +
    `Soft watercolor and colored-pencil texture, muted cream and beige tones with one small muted-red accent. ` +
    `Gentle, calm, nostalgic mood. Simple composition with plenty of empty space around the subject. ` +
    `IMPORTANT: absolutely no text, no letters, no words, no numbers, no captions anywhere in the image.`
  );
}

export async function generateIllustration(apiKey, info) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ILLUST_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: illustPrompt(info) }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: '4:3' },
        },
      }),
    }
  );
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 160); } catch (_) {}
    if (res.status === 400 && /billing|free_tier/i.test(detail)) {
      throw new Error('이 키는 이미지 생성 무료 한도가 없어. Google Cloud 결제를 연결해야 해.');
    }
    throw new Error(`이미지 생성 실패 (${res.status})`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error('이미지가 돌아오지 않았어. 잠시 후 다시 시도해줘.');
  const mime = img.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${img.inlineData.data}`;
}
