// TLDraw Sandbox Server with Claude AI Integration
// Run with: ANTHROPIC_API_KEY=your-key node server.js

import http from 'http';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const PORT = 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client if API key is available
let anthropic = null;
if (ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  console.log('✅ Claude AI enabled');
} else {
  console.log('⚠️  No ANTHROPIC_API_KEY set - using sample code generation');
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

// Generate code using Claude AI
async function generateWithClaude(prompt) {
  if (!anthropic) {
    return null; // Fall back to samples
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

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt || 'Generate an interesting JavaScript code snippet that demonstrates a useful programming concept. Be creative!'
        }
      ],
      system: systemPrompt,
    });

    const code = message.content[0].text;
    return code;
  } catch (error) {
    console.error('Claude API error:', error.message);
    return null;
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
      console.log(`[${new Date().toISOString()}] Generate request: "${prompt || 'random'}"`);      
      
      // Try Claude first
      let code = await generateWithClaude(prompt);
      
      // Fall back to samples if Claude unavailable
      if (!code) {
        code = sampleCode[Math.floor(Math.random() * sampleCode.length)];
        console.log('  Using sample code (Claude unavailable)');
      } else {
        console.log('  Generated with Claude AI');
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
        claudeEnabled: !!anthropic,
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
