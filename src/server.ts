import { chatCompletion } from './services/openrouter.js';

const PORT = Number(Bun.env.PORT ?? 3001);
const FRONTEND_URL = Bun.env.FRONTEND_URL ?? 'http://localhost:5173';

const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_URL,
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

function withCors(headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    ...corsHeaders,
  };
}

function healthHandler() {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: withCors({
      'Content-Type': 'application/json',
    }),
  });
}

function optionsHandler() {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  });
}

async function chatCompletionsHandler(req: Request) {
  if (req.method === 'OPTIONS') {
    return optionsHandler();
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: withCors(),
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: '잘못된 JSON 본문입니다.' }),
      {
        status: 400,
        headers: withCors({
          'Content-Type': 'application/json',
        }),
      },
    );
  }

  const { messages, model = 'gpt-oss-120b' } = body ?? {};

  if (!messages || !Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: 'messages 배열이 필요합니다.' }),
      {
        status: 400,
        headers: withCors({
          'Content-Type': 'application/json',
        }),
      },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await chatCompletion(messages, model, chunk => {
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
    headers: withCors({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }),
  });
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      if (req.method === 'OPTIONS') return optionsHandler();
      if (req.method === 'GET') return healthHandler();
      return new Response('Method Not Allowed', {
        status: 405,
        headers: withCors(),
      });
    }

    // Chat completions (SSE)
    if (url.pathname === '/api/chat/completions') {
      return chatCompletionsHandler(req);
    }

    return new Response('Not Found', {
      status: 404,
      headers: withCors(),
    });
  },
});

console.log(`🚀 Bun 서버가 포트 ${server.port}에서 실행 중입니다.`);
console.log(
  `📝 OpenRouter API 키: ${Bun.env.OPENROUTER_API_KEY ? '설정됨 ✅' : '없음 ❌'}`,
);
