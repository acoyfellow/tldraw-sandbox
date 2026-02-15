# TLDraw Sandbox

**An infinite canvas with AI-powered code terminals.** Write prompts, generate code with AI, and execute it instantly in sandboxed terminals—all on a TLDraw canvas.

![TLDraw Sandbox](screenshot.png)

## Features

- 🎨 **Infinite Canvas** — Built on TLDraw's powerful drawing SDK
- 🤖 **AI Code Generation** — Describe what you want, get working code
- ⚡ **Instant Execution** — Run code safely in isolated sandboxes
- 🖥️ **Beautiful Terminals** — xterm.js with Catppuccin Mocha theme
- 🔄 **Live Output** — See results in real-time

## Quick Start

```bash
git clone https://github.com/anthropics/tldraw-sandbox.git
cd tldraw-sandbox
npm install

# Start the sandbox server
npm run server

# In another terminal, start the frontend
npm run dev
```

Open http://localhost:8000

## How It Works

1. **Click 🤖 AI** — Opens prompt input
2. **Describe your code** — "fibonacci with memoization", "binary search tree", etc.
3. **Press Enter** — AI generates the code
4. **Click ▶ Run** — Executes in a sandboxed environment
5. **See output** — Results appear in the terminal

## Configuration

### AI Provider

Set your API key in `.env`:

```bash
# OpenRouter (supports multiple models)
ANTHROPIC_API_KEY=sk-or-v1-...

# Or direct Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Change the model in `server.js`:

```javascript
model: 'meta-llama/llama-3.3-70b-instruct'  // Current
model: 'anthropic/claude-3.5-sonnet'         // Alternative
model: 'google/gemini-2.0-flash'             // Alternative
```

## Architecture

```
tldraw-sandbox/
├── src/
│   ├── TerminalShape.tsx   # Custom TLDraw terminal shape
│   ├── TerminalTool.ts     # Tool for creating terminals  
│   └── App.tsx             # Main application
├── server.js               # Sandbox execution server
└── worker/                 # Cloudflare Worker (optional)
```

## Tech Stack

- [TLDraw](https://tldraw.com) — Infinite canvas SDK
- [xterm.js](https://xtermjs.org) — Terminal emulator
- [OpenRouter](https://openrouter.ai) — AI model gateway
- [Vite](https://vitejs.dev) — Build tool
- [React](https://react.dev) — UI framework

## License

MIT
