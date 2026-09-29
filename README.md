# 모아 (moa)

기록을 못 하는 사람을 위한 아기자기 세컨드 브레인 웹앱. v1 스캐폴딩.

무드: 핸드드로잉 휴먼터치 + 다꾸(스티커). 앱 자체가 세컨드 브레인이다.

## 실행

빌드 없음. 순수 HTML/CSS/JS.

```bash
cd moa
python3 -m http.server 8000
# → http://localhost:8000
```

ES 모듈을 쓰므로 `file://`로 직접 열면 동작하지 않는다. 로컬 서버 필수.

아이폰에서: 같은 와이파이의 PC에서 서버를 띄운 뒤, 아이폰 Safari로 `http://PC주소:8000` 접속 → 공유 → "홈 화면에 추가". PWA로 앱처럼 쓸 수 있다.

## 구조

```
moa/
  index.html
  manifest.json
  css/style.css            디자인 시스템 (핸드드로잉+다꾸)
  js/app.js                탭 라우팅·초기화
  js/store.js              localStorage 래퍼 (moa/v1/*)
  js/llm.js                제공자 추상화 (chat 함수 하나)
  js/providers/openai.js   OpenAI 직접 호출 (브라우저 OK)
  js/providers/claude.js   Claude 호출 (프록시 필요 — 아래 참조)
  js/prompts.js            프롬프트 상수
  js/extract.js            [[위키링크]] 파싱·엔티티 정규화
  js/graph.js              탐색 탭 그래프 렌더링 (SVG)
  js/google.js             GIS OAuth·Calendar·Gmail
  js/views/today.js        오늘 (타임라인)
  js/views/jot.js          끄적 (대충 입력 → 다듬기)
  js/views/habit.js        해빗
  js/views/recap.js        회고 (하루/주간 카드)
  js/views/explore.js      탐색 (그래프·백링크·검색)
  js/views/settings.js     설정 (LLM 키·구글·데이터 관리)
```

## 설정

1. 설정 탭 → LLM 제공자 선택 → API 키 입력
   - OpenAI: 브라우저에서 직접 호출 가능
   - Claude: 브라우저 직접 호출 불가 (CORS 미지원). 프록시 URL 필요
2. (선택) Google OAuth 클라이언트 ID 입력 → 오늘 탭에서 "캘린더 가져오기" 활성화

### Claude 프록시 예제 (Cloudflare Workers)

API 키는 워커 환경변수에만 두고, 브라우저에는 넣지 않는다.

```js
export default {
  async fetch(req, env) {
    const target = 'https://api.anthropic.com' + new URL(req.url).pathname;
    const headers = new Headers(req.headers);
    headers.set('x-api-key', env.ANTHROPIC_API_KEY);
    headers.set('anthropic-version', '2023-06-01');
    return fetch(target, { method: req.method, headers, body: req.body });
  }
}
```

배포 후 워커 주소를 설정 탭의 "Claude 프록시 URL"에 입력.

### Google OAuth 설정

1. Google Cloud Console → OAuth 클라이언트 ID (웹 애플리케이션) 발급
2. 승인된 JavaScript 원본에 앱 주소 등록 (예: `http://localhost:8000`)
3. 클라이언트 ID를 설정 탭에 입력
4. 범위: `calendar.readonly`, `gmail.readonly`

## 정직한 한계 (v1)

- Claude는 프록시 없이 호출 불가 (위 예제 참조)
- iOS Safari는 Web Speech API 미지원 → 끄적 음성 입력은 키보드 받아쓰기(마이크) 사용
- HealthKit·공유 시트 네이티브 → v2 (네이티브 앱)
- localStorage 약 5MB 한도 → 사진은 압축 썸네일로 저장, 원본 보관 안 함
- 백엔드 없음 → 기기 간 동기화 없음 (v2: Supabase)

## 다음 (v2 로드맵)

Supabase (동기화·서버 보관 API 키·스케줄 수집) → 네이티브 iOS (Share Extension, HealthKit, APNs)
