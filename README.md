# TLDraw Sandbox

A fork of TLDraw with integrated Cloudflare Sandbox terminals. Write and execute TypeScript code directly on an infinite canvas!

![TLDraw Sandbox Screenshot](screenshot.png)

## Features

- **Interactive Terminal Shapes**: Create terminal nodes on the TLDraw canvas
- **Code Execution**: Write TypeScript/JavaScript code and run it directly
- **AI Code Generation**: Generate code snippets with the AI button (ready for real AI integration)
- **Beautiful Terminal UI**: Catppuccin Mocha theme with xterm.js
- **Full TLDraw Features**: Drawing, shapes, text, and all standard TLDraw tools

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:8000

## Using Terminals

1. A terminal is created automatically on load
2. Write code in the dark code editor area
3. Click **▶ Run** to execute
4. Click **🤖 AI** to generate sample code
5. Click **Clear** to reset the terminal output

## Architecture

- `src/TerminalShape.tsx` - Custom TLDraw shape utility for terminals
- `src/TerminalTool.ts` - Tool for creating terminal shapes
- `src/App.tsx` - Main TLDraw application with custom toolbar

## Cloudflare Sandbox Integration

This project is designed to integrate with `@cloudflare/sandbox` for secure, isolated code execution.

**Current**: Code runs locally in the browser using `new Function()`

**Production**: Replace with Cloudflare Sandbox API calls:

```typescript
import { getSandbox } from '@cloudflare/sandbox'

const sandbox = getSandbox(env.Sandbox, 'my-sandbox')
const result = await sandbox.exec(`node -e "${code}"`)
```

## Tech Stack

- [TLDraw](https://tldraw.com) - Infinite canvas SDK
- [xterm.js](https://xtermjs.org) - Terminal emulator
- [Vite](https://vitejs.dev) - Build tool
- [React](https://react.dev) - UI framework
- [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) - Secure code execution (planned)

## License

MIT
