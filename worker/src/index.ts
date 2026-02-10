import { Sandbox, getSandbox } from '@cloudflare/sandbox';

// Re-export Sandbox for Durable Object
export { Sandbox };

interface Env {
  SANDBOX: DurableObjectNamespace<Sandbox>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    try {
      // Execute code endpoint
      if (url.pathname === '/execute' && request.method === 'POST') {
        const body = await request.json() as { code: string; sandboxId?: string };
        const { code, sandboxId = 'default' } = body;

        if (!code || typeof code !== 'string') {
          return Response.json(
            { success: false, error: 'Code is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Get or create a sandbox instance
        const sandbox = getSandbox(env.SANDBOX, sandboxId);

        // Write the code to a file and execute it
        const filename = `/workspace/script-${Date.now()}.js`;
        await sandbox.writeFile(filename, code);
        
        // Execute with Node.js
        const result = await sandbox.exec(`node ${filename}`, {
          timeoutMs: 10000, // 10 second timeout
        });

        // Clean up
        await sandbox.exec(`rm ${filename}`);

        return Response.json(
          {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
          { headers: corsHeaders }
        );
      }

      // Health check
      if (url.pathname === '/health') {
        return Response.json(
          { status: 'ok', timestamp: new Date().toISOString() },
          { headers: corsHeaders }
        );
      }

      // AI code generation (placeholder - integrate with your AI provider)
      if (url.pathname === '/generate' && request.method === 'POST') {
        const body = await request.json() as { prompt?: string };
        
        // For now, return sample code. In production, call Claude/OpenAI/etc.
        const examples = [
          `// Fibonacci sequence\nfunction fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Fibonacci sequence:");\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fib(i)}\`);\n}`,
          `// Array operations\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconst sum = numbers.reduce((a, b) => a + b, 0);\nconst evens = numbers.filter(n => n % 2 === 0);\n\nconsole.log("Original:", numbers);\nconsole.log("Doubled:", doubled);\nconsole.log("Sum:", sum);\nconsole.log("Evens:", evens);`,
          `// Async/await example\nasync function fetchData() {\n  console.log("Fetching data...");\n  await new Promise(r => setTimeout(r, 100));\n  console.log("Data fetched!");\n  return { users: ["Alice", "Bob", "Charlie"] };\n}\n\nfetchData().then(data => {\n  console.log("Result:", JSON.stringify(data, null, 2));\n});`,
          `// Object manipulation\nconst users = [\n  { name: "Alice", age: 30 },\n  { name: "Bob", age: 25 },\n  { name: "Charlie", age: 35 }\n];\n\nconst names = users.map(u => u.name);\nconst avgAge = users.reduce((sum, u) => sum + u.age, 0) / users.length;\nconst oldest = users.reduce((a, b) => a.age > b.age ? a : b);\n\nconsole.log("Names:", names);\nconsole.log("Average age:", avgAge.toFixed(1));\nconsole.log("Oldest:", oldest.name);`,
          `// Prime numbers sieve\nfunction sieve(max) {\n  const primes = [];\n  const isPrime = new Array(max + 1).fill(true);\n  isPrime[0] = isPrime[1] = false;\n  \n  for (let i = 2; i <= max; i++) {\n    if (isPrime[i]) {\n      primes.push(i);\n      for (let j = i * i; j <= max; j += i) {\n        isPrime[j] = false;\n      }\n    }\n  }\n  return primes;\n}\n\nconst primes = sieve(100);\nconsole.log("Primes up to 100:");\nconsole.log(primes.join(", "));\nconsole.log("Count:", primes.length);`,
        ];

        const code = examples[Math.floor(Math.random() * examples.length)];
        
        return Response.json(
          { success: true, code },
          { headers: corsHeaders }
        );
      }

      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: corsHeaders }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return Response.json(
        { success: false, error: message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
