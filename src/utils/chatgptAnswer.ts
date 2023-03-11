import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

export const OpenAIStream = async (prompt: string, apiKey: string) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Answer the question as truthfully as possible using the provided context, and if the answer is not contained within the text below, say "I don't know."`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error('OpenAI API returned an error');
  }

  return parseOpenAIStream(res);
};

export const parseOpenAIStream = (rawResponse: Response) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const streamParser = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta?.content || '';
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(streamParser);
      for await (const chunk of rawResponse.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};