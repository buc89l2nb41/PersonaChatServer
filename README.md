# PersonaChat Backend

OpenRouter API를 안전하게 프록시하는 **Bun 기반** 백엔드 서버입니다.

## 설정

1. `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
PORT=3001
OPENROUTER_API_KEY=sk-or-your-key-here
FRONTEND_URL=http://localhost:5173
```

2. 의존성 설치 (Bun 기준):

```bash
bun install
```

## 실행

### 개발 모드 (자동 리로드)
```bash
bun run dev
```

### 프로덕션 실행
```bash
bun run start
```

## API 엔드포인트

### POST /api/chat/completions

채팅 완성 요청을 처리합니다.

**요청 본문:**
```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "model": "gpt-oss-120b"
}
```

**응답:**
Server-Sent Events (SSE) 형식으로 스트리밍 응답을 반환합니다.

### GET /health

서버 상태를 확인합니다.
