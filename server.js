// TLDraw Sandbox Server with Claude AI Integration
// Supports both Anthropic API and OpenRouter

import http from 'http';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const PORT = 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;

// Detect API type
const isOpenRouter = API_KEY?.startsWith('sk-or-');
const aiEnabled = !!API_KEY;

if (aiEnabled) {
  console.log(`✅ Claude AI enabled via ${isOpenRouter ? 'OpenRouter' : 'Anthropic'}`);
} else {
  console.log('⚠️  No API key set - using sample code generation');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function executeCode(code) {
  const filename = join(tmpdir(), `script-${Date.now()}.js`);
  
  try {
    await writeFile(filename, code);
    
    return new Promise((resolve) => {
      const child = spawn('node', [filename], {
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', async (exitCode) => {
        try { await unlink(filename); } catch (e) { /* ignore */ }
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode,
        });
      });

      child.on('error', async (error) => {
        try { await unlink(filename); } catch (e) { /* ignore */ }
        resolve({
          success: false,
          error: error.message,
        });
      });

      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          error: 'Execution timeout (10s)',
        });
      }, 10000);
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

const systemPrompt = `You are a code generator for a sandbox terminal environment.
Generate clean, runnable JavaScript/Node.js code based on the user's request.
The code should:
- Use console.log() for output
- Be self-contained and immediately executable
- Include helpful comments
- Be interesting and demonstrate useful programming concepts
- NOT require any external packages (use only Node.js built-ins)
- Be concise but complete

Respond ONLY with the code, no explanations or markdown code blocks.`;

// Generate code using Claude AI via OpenRouter
async function generateWithOpenRouter(prompt) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tldraw-sandbox.exe.dev',
        'X-Title': 'TLDraw Sandbox',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',  // Strong Llama model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt || 'Generate an interesting JavaScript code snippet that demonstrates a useful programming concept. Be creative!' }
        ],
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      return null;
    }

    const data = await response.json();
    let code = data.choices?.[0]?.message?.content || null;
    // Strip markdown code blocks if present
    if (code) {
      code = code.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '').trim();
    }
    return code;
  } catch (error) {
    console.error('OpenRouter API error:', error.message);
    return null;
  }
}

// Generate code using Claude AI (direct Anthropic)
async function generateWithAnthropic(prompt) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt || 'Generate an interesting JavaScript code snippet that demonstrates a useful programming concept. Be creative!' }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic error:', error);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error('Anthropic API error:', error.message);
    return null;
  }
}

async function generateWithClaude(prompt) {
  if (!aiEnabled) return null;
  
  if (isOpenRouter) {
    return generateWithOpenRouter(prompt);
  } else {
    return generateWithAnthropic(prompt);
  }
}

// Fallback sample code
const sampleCode = [
  `// Fibonacci sequence\nfunction fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Fibonacci sequence:");\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fib(i)}\`);\n}`,
  `// Array operations\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconst sum = numbers.reduce((a, b) => a + b, 0);\nconsole.log("Original:", numbers);\nconsole.log("Doubled:", doubled);\nconsole.log("Sum:", sum);`,
  `// Prime numbers sieve\nfunction sieve(max) {\n  const primes = [];\n  const isPrime = new Array(max + 1).fill(true);\n  isPrime[0] = isPrime[1] = false;\n  for (let i = 2; i <= max; i++) {\n    if (isPrime[i]) {\n      primes.push(i);\n      for (let j = i * i; j <= max; j += i) isPrime[j] = false;\n    }\n  }\n  return primes;\n}\nconsole.log("Primes up to 50:", sieve(50).join(", "));`,
];

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  let body = '';
  if (req.method === 'POST') {
    for await (const chunk of req) {
      body += chunk;
    }
  }

  try {
    // Execute code
    if (url.pathname === '/execute' && req.method === 'POST') {
      const { code, sandboxId } = JSON.parse(body);
      console.log(`[${new Date().toISOString()}] Execute for sandbox: ${sandboxId}`);
      
      const result = await executeCode(code);
      
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(result));
      return;
    }

    // Generate code with AI
    if (url.pathname === '/generate' && req.method === 'POST') {
      const { prompt } = JSON.parse(body || '{}');
      console.log(`[${new Date().toISOString()}] Generate: "${(prompt || 'random').slice(0, 50)}"`);
      
      // Try Claude first
      let code = await generateWithClaude(prompt);
      
      // Fall back to samples if Claude unavailable
      if (!code) {
        code = sampleCode[Math.floor(Math.random() * sampleCode.length)];
        console.log('  -> Using sample code');
      } else {
        console.log('  -> Generated with Claude');
      }
      
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ success: true, code }));
      return;
    }

    // Health check
    if (url.pathname === '/health') {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ 
        status: 'ok', 
        aiEnabled,
        aiProvider: isOpenRouter ? 'openrouter' : 'anthropic',
        timestamp: new Date().toISOString() 
      }));
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`📦 Sandbox server running at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /execute  - Execute code');
  console.log('  POST /generate - Generate AI code');
  console.log('  GET  /health   - Health check');
});
