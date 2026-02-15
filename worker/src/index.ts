interface Env {
  OPENROUTER_API_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const systemPrompt = `You are a code generator. Generate clean, runnable JavaScript code.
- Use console.log() for output
- Be self-contained and executable
- Include comments
- NO external packages
- Respond ONLY with code, no markdown.`;

async function generateCode(apiKey: string, prompt?: string): Promise<string | null> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt || 'Generate an interesting JavaScript code snippet.' }
        ],
        max_tokens: 512,
      }),
    });
    const data = await response.json() as any;
    let code = data.choices?.[0]?.message?.content || null;
    if (code) {
      code = code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();
    }
    return code;
  } catch (e) {
    return null;
  }
}

function executeCode(code: string, inputData?: string): { success: boolean; stdout: string; error?: string } {
  try {
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
    };
    let $input: any = undefined;
    if (inputData) {
      try { $input = JSON.parse(inputData); } catch { $input = inputData; }
    }
    const fn = new Function('console', '$input', code);
    fn(mockConsole, $input);
    return { success: true, stdout: logs.join('\n') };
  } catch (e: any) {
    return { success: false, stdout: '', error: e.message };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/execute' && request.method === 'POST') {
        const { code, inputData } = await request.json() as any;
        const result = executeCode(code, inputData);
        return Response.json(result, { headers: corsHeaders });
      }

      if (url.pathname === '/generate' && request.method === 'POST') {
        const { prompt } = await request.json() as any;
        const code = await generateCode(env.OPENROUTER_API_KEY, prompt);
        if (code) {
          return Response.json({ success: true, code }, { headers: corsHeaders });
        }
        return Response.json({ success: false, error: 'Generation failed' }, { headers: corsHeaders });
      }

      if (url.pathname === '/health') {
        return Response.json({ status: 'ok' }, { headers: corsHeaders });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    } catch (e: any) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  },
};
