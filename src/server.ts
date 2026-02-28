import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chatCompletion } from './services/openrouter.js';

const app = new Hono();

const PORT = Number(Bun.env.PORT ?? 3001);
const FRONTEND_URL = Bun.env.FRONTEND_URL ?? 'http://localhost:5173';

// CORS 미들웨어 설정
app.use(
  '*',
  cors({
    origin: FRONTEND_URL,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
  }),
);

// Health check 엔드포인트
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Chat completions 엔드포인트 (SSE)
app.post('/api/chat/completions', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, model = 'gpt-oss-120b' } = body ?? {};

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages 배열이 필요합니다.' }, 400);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await chatCompletion(messages, model, (chunk) => {
            const payload = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(payload));
          });

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Chat completion error:', error);
          try {
            const message =
              error instanceof Error ? error.message : '알 수 없는 오류';
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  error: message,
                })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request parsing error:', error);
    return c.json({ error: '잘못된 JSON 본문입니다.' }, 400);
  }
});

// 404 핸들러
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 서버 시작
const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`🚀 Hono 서버가 포트 ${server.port}에서 실행 중입니다.`);
console.log(
  `📝 OpenRouter API 키: ${Bun.env.OPENROUTER_API_KEY ? '설정됨 ✅' : '없음 ❌'}`,
);
