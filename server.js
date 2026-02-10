// Simple local server that mimics Cloudflare Worker API for testing
// Run with: node server.js

import http from 'http';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const PORT = 8787;

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

const examples = [
  `// Fibonacci sequence\nfunction fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Fibonacci sequence:");\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fib(i)}\`);\n}`,
  `// Array operations\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconst sum = numbers.reduce((a, b) => a + b, 0);\nconst evens = numbers.filter(n => n % 2 === 0);\n\nconsole.log("Original:", numbers);\nconsole.log("Doubled:", doubled);\nconsole.log("Sum:", sum);\nconsole.log("Evens:", evens);`,
  `// Async/await example\nasync function fetchData() {\n  console.log("Fetching data...");\n  await new Promise(r => setTimeout(r, 100));\n  console.log("Data fetched!");\n  return { users: ["Alice", "Bob", "Charlie"] };\n}\n\nfetchData().then(data => {\n  console.log("Result:", JSON.stringify(data, null, 2));\n});`,
  `// Object manipulation\nconst users = [\n  { name: "Alice", age: 30 },\n  { name: "Bob", age: 25 },\n  { name: "Charlie", age: 35 }\n];\n\nconst names = users.map(u => u.name);\nconst avgAge = users.reduce((sum, u) => sum + u.age, 0) / users.length;\nconst oldest = users.reduce((a, b) => a.age > b.age ? a : b);\n\nconsole.log("Names:", names);\nconsole.log("Average age:", avgAge.toFixed(1));\nconsole.log("Oldest:", oldest.name);`,
  `// Prime numbers sieve\nfunction sieve(max) {\n  const primes = [];\n  const isPrime = new Array(max + 1).fill(true);\n  isPrime[0] = isPrime[1] = false;\n  \n  for (let i = 2; i <= max; i++) {\n    if (isPrime[i]) {\n      primes.push(i);\n      for (let j = i * i; j <= max; j += i) {\n        isPrime[j] = false;\n      }\n    }\n  }\n  return primes;\n}\n\nconst primes = sieve(100);\nconsole.log("Primes up to 100:");\nconsole.log(primes.join(", "));\nconsole.log("Count:", primes.length);`,
  `// File system simulation\nconsole.log("Simulating file operations...");\nconst virtualFS = new Map();\n\nvirtualFS.set("/home/user/file.txt", "Hello, World!");\nvirtualFS.set("/home/user/data.json", JSON.stringify({ count: 42 }));\n\nconsole.log("Files created:");\nfor (const [path, content] of virtualFS) {\n  console.log(\`  \${path}: \${content}\`);\n}`,
];

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Collect body for POST requests
  let body = '';
  if (req.method === 'POST') {
    for await (const chunk of req) {
      body += chunk;
    }
  }

  try {
    if (url.pathname === '/execute' && req.method === 'POST') {
      const { code, sandboxId } = JSON.parse(body);
      console.log(`[${new Date().toISOString()}] Execute request for sandbox: ${sandboxId}`);
      console.log(`Code:\n${code.slice(0, 200)}${code.length > 200 ? '...' : ''}`);
      
      const result = await executeCode(code);
      
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/generate' && req.method === 'POST') {
      console.log(`[${new Date().toISOString()}] Generate request`);
      const code = examples[Math.floor(Math.random() * examples.length)];
      
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ success: true, code }));
      return;
    }

    if (url.pathname === '/health') {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
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
  console.log(`📦 Local sandbox server running at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /execute - Execute code');
  console.log('  POST /generate - Generate AI code');
  console.log('  GET /health - Health check');
});
