const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: string,
  onChunk: (chunk: any) => void,
) {
  const apiKey = Bun.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API 키가 설정되지 않았습니다.');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`OpenRouter API 오류: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') {
        return;
      }

      try {
        const json = JSON.parse(dataStr);
        onChunk(json);
      } catch {
        // JSON 파싱 실패는 무시
      }
    }
  }
}
