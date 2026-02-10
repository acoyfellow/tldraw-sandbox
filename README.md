# TLDraw Sandbox

A TLDraw-based infinite canvas with integrated Cloudflare Sandbox terminals. Write and execute code directly on the canvas!

## Features

- **Interactive Terminal Shapes**: Create terminal nodes on the TLDraw canvas
- **Cloudflare Sandbox Execution**: Secure, isolated code execution via Cloudflare Workers
- **AI Code Generation**: Generate code snippets (ready for Claude/OpenAI integration)
- **Beautiful Terminal UI**: Catppuccin Mocha theme with xterm.js
- **Full TLDraw Features**: Drawing, shapes, text, and all standard TLDraw tools
- **Local/Cloud Toggle**: Switch between local and Cloudflare execution

## Quick Start

```bash
# Install dependencies
npm install

# Start the local sandbox server (port 8787)
npm run server

# In another terminal, start the frontend (port 8000)
npm run dev
```

Or run both together:
```bash
npm run dev:all
```

Visit http://localhost:8000

## Using Terminals

1. A terminal is created automatically on load
2. Write code in the dark code editor area
3. Click **▶ Run** to execute via the sandbox
4. Click **🤖 AI** to generate sample code
5. Click **Clear** to reset terminal output
6. Toggle **☁️ CF / 💻 Local** to switch execution modes

## Architecture

```
tldraw-sandbox/
├── src/
│   ├── TerminalShape.tsx  # Custom TLDraw shape for terminals
│   ├── TerminalTool.ts    # Tool for creating terminals
│   └── App.tsx            # Main TLDraw application
├── server.js              # Local sandbox server (for testing)
└── worker/
    ├── src/index.ts       # Cloudflare Worker with Sandbox SDK
    └── wrangler.toml      # Worker configuration
```

## Deploying to Cloudflare

1. Set up a Cloudflare account and enable Workers

2. Deploy the worker:
```bash
cd worker
npm install
npx wrangler deploy
```

3. Update the frontend to use your worker URL:
```bash
# Create .env.local
echo "VITE_WORKER_URL=https://your-worker.your-subdomain.workers.dev" > .env.local
```

4. Build and deploy the frontend to your preferred host.

## API Endpoints

### POST /execute
Execute code in the sandbox.

```json
{
  "code": "console.log('Hello!');",
  "sandboxId": "unique-sandbox-id"
}
```

Response:
```json
{
  "success": true,
  "stdout": "Hello!\n",
  "stderr": "",
  "exitCode": 0
}
```

### POST /generate
Generate AI code (placeholder - integrate with your AI provider).

### GET /health
Health check endpoint.

## Integrating Real AI

Replace the `/generate` endpoint in `worker/src/index.ts` or `server.js` with calls to:
- Claude API
- OpenAI API
- Any other LLM

Example with Claude:
```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': env.ANTHROPIC_API_KEY,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

## Tech Stack

- [TLDraw](https://tldraw.com) - Infinite canvas SDK
- [xterm.js](https://xtermjs.org) - Terminal emulator
- [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) - Secure code execution
- [Vite](https://vitejs.dev) - Build tool
- [React](https://react.dev) - UI framework

## License

MIT
