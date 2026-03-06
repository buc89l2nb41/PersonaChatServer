/**
 * 나노바나나(Nano Banana) / Gemini 이미지 생성 API 호출.
 * Google 공식 또는 APIYI 등 generateContent 호환 엔드포인트 사용.
 */

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// 이미지 출력(IMAGE)을 지원하는 모델만 사용. gemini-2.0-flash-001 등은 이미지 출력 미지원 → 400 발생.
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

export interface ImageGenOptions {
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
}

export interface ImageGenResult {
  imageBase64: string;
  mimeType?: string;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  error?: { message?: string };
}

export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
  const apiKey = Bun.env.GEMINI_API_KEY ?? Bun.env.NANOBANANA_API_KEY;
  const baseUrl = (Bun.env.NANOBANANA_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = Bun.env.GEMINI_IMAGE_MODEL ?? Bun.env.NANOBANANA_IMAGE_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 또는 NANOBANANA_API_KEY가 설정되지 않았습니다.');
  }

  const url = `${baseUrl}/models/${model}:generateContent`;
  const isGoogle = baseUrl.includes('generativelanguage.googleapis.com');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isGoogle
      ? { 'x-goog-api-key': apiKey }
      : { Authorization: `Bearer ${apiKey}` }),
  };

  const aspectRatio = options.aspectRatio ?? '1:1';
  const imageSize = options.imageSize ?? '1K';

  // Google 공식 API는 imageGenerationConfig/imageConfig 미지원 → responseModalities만 사용
  // APIYI 등은 imageConfig(aspectRatio, imageSize) 지원
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE'],
  };
  if (!isGoogle) {
    generationConfig.imageConfig = { aspectRatio, imageSize };
  }

  const body = {
    contents: [{ parts: [{ text: options.prompt }] }],
    generationConfig,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let hint = '';
    if (response.status === 404) {
      hint = ' 사용 가능한 모델: GET https://generativelanguage.googleapis.com/v1beta/models?key=API키 → .env에 GEMINI_IMAGE_MODEL=모델ID';
    } else if (response.status === 400 && text.includes('response modalities')) {
      hint = ' 이 모델은 이미지 출력을 지원하지 않습니다. .env에 GEMINI_IMAGE_MODEL=gemini-2.5-flash-image 로 이미지 전용 모델을 지정하세요.';
    } else if (response.status === 429) {
      hint = ' 일일/분당 한도 초과. 잠시 후 재시도하거나 사용량 확인: https://ai.dev/rate-limit . 유료 전환 또는 APIYI(NANOBANANA_API_BASE_URL) 사용을 고려하세요.';
    }
    throw new Error(`이미지 생성 API 오류: ${response.status} ${text}.${hint}`);
  }

  const data = (await response.json()) as GenerateContentResponse;

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const inlineData = parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inlineData?.data) {
    throw new Error('API가 이미지 데이터를 반환하지 않았습니다.');
  }

  return {
    imageBase64: inlineData.data,
    mimeType: inlineData.mimeType ?? 'image/png',
  };
}
