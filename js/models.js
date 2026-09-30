// 제공자별 지원 모델 목록 (설정 콤보박스용)
// 2026-09-30 기준 최신 모델. 은퇴한 모델은 제외.
export const MODELS = {
  openai: [
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna · 가성비' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra · 중간' },
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol · 플래그십' },
    { id: 'gpt-5.4', label: 'GPT-5.4' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  claude: [
    { id: 'claude-sonnet-5', label: 'Sonnet 5 · 균형' },
    { id: 'claude-opus-5', label: 'Opus 5 · 고성능' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5 · 빠름' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: 'claude-fable-5', label: 'Fable 5 · 최고' },
  ],
  gemini: [
    { id: 'gemini-3.5-flash', label: '3.5 Flash · 무료 · 최신' },
    { id: 'gemini-3.1-flash-lite', label: '3.1 Flash-Lite · 무료 · 경량' },
    { id: 'gemini-2.5-flash', label: '2.5 Flash · 무료' },
    { id: 'gemini-2.5-flash-lite', label: '2.5 Flash-Lite · 무료 · 경량' },
    { id: 'gemini-2.5-pro', label: '2.5 Pro · 고성능' },
    { id: 'gemini-3-flash-preview', label: '3 Flash · 프리뷰' },
  ],
};

export const DEFAULT_MODELS = {
  openai: 'gpt-5.6-luna',
  claude: 'claude-sonnet-5',
  gemini: 'gemini-2.5-flash',
};
