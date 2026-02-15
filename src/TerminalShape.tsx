import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  RecordProps,
  T,
  TLShape,
} from 'tldraw'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

// Cloudflare Worker API URL - change this to your deployed worker URL
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://tldraw-sandbox-api.coy.workers.dev'

// Shape type name
const TERMINAL_SHAPE_TYPE = 'terminal' as const

// Extend TLDraw's type system
declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [TERMINAL_SHAPE_TYPE]: {
      w: number
      h: number
      code: string
      output: string[]
      isRunning: boolean
      title: string
      sandboxId: string
      lastResult: string  // Output to pass to connected terminals
    }
  }
}

export type ITerminalShape = TLShape<typeof TERMINAL_SHAPE_TYPE>

// API functions for Cloudflare Sandbox
async function executeCode(code: string, sandboxId: string, inputData?: string): Promise<{
  success: boolean
  stdout?: string
  stderr?: string
  error?: string
}> {
  try {
    const response = await fetch(`${WORKER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sandboxId, inputData }),
    })
    return await response.json()
  } catch (error) {
    // Fallback to local execution if worker is not available
    console.warn('Worker not available, using local execution:', error)
    return executeLocally(code, inputData)
  }
}

async function generateCode(prompt?: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    return await response.json()
  } catch (error) {
    // Fallback to local generation
    console.warn('Worker not available, using local generation:', error)
    return generateLocally()
  }
}

// Fallback local execution
function executeLocally(code: string, inputData?: string): { success: boolean; stdout?: string; stderr?: string; error?: string } {
  try {
    const output: string[] = []
    let lastValue: unknown = undefined
    const mockConsole = {
      log: (...args: unknown[]) => {
        const line = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
        output.push(line)
        lastValue = args.length === 1 ? args[0] : args
      },
      error: (...args: unknown[]) => {
        output.push('[ERROR] ' + args.map(a => String(a)).join(' '))
      },
    }
    // Parse input data if provided
    let $input: unknown = undefined
    if (inputData) {
      try {
        $input = JSON.parse(inputData)
      } catch {
        $input = inputData
      }
    }
    const fn = new Function('console', '$input', code)
    const result = fn(mockConsole, $input)
    if (result !== undefined) lastValue = result
    const stdout = output.join('\n')
    // Append last value as JSON for piping
    const resultStr = lastValue !== undefined ? JSON.stringify(lastValue) : ''
    return { success: true, stdout, stderr: resultStr }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Fallback local code generation
function generateLocally(): { success: boolean; code: string } {
  const examples = [
    `// Fibonacci sequence\nfunction fib(n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Fibonacci sequence:");\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fib(\${i}) = \${fib(i)}\`);\n}`,
    `// Array operations\nconst numbers = [1, 2, 3, 4, 5];\nconst doubled = numbers.map(n => n * 2);\nconst sum = numbers.reduce((a, b) => a + b, 0);\nconsole.log("Original:", numbers);\nconsole.log("Doubled:", doubled);\nconsole.log("Sum:", sum);`,
    `// Prime numbers\nfunction isPrime(n) {\n  if (n < 2) return false;\n  for (let i = 2; i <= Math.sqrt(n); i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}\nconst primes = [];\nfor (let i = 2; i < 50; i++) {\n  if (isPrime(i)) primes.push(i);\n}\nconsole.log("Primes under 50:", primes.join(", "));`,
  ]
  return { success: true, code: examples[Math.floor(Math.random() * examples.length)] }
}

// Terminal component that renders inside the shape
function TerminalComponent({
  shape,
  onUpdateShape,
}: {
  shape: ITerminalShape
  onUpdateShape: (updates: Partial<ITerminalShape['props']>) => void
}) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [useCloudflare, setUseCloudflare] = useState(true)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showPromptInput, setShowPromptInput] = useState(false)
  
  const code = shape.props.code

  useEffect(() => {
    if (!terminalRef.current || termRef.current) return

    const term = new Terminal({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
      },
      fontSize: 11,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      convertEol: true,
      rows: 12,
      cols: 60,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    
    setTimeout(() => {
      try { fitAddon.fit() } catch (e) { /* ignore */ }
    }, 100)

    term.writeln('\x1b[1;34m=== Cloudflare Sandbox Terminal ===\x1b[0m')
    term.writeln('')
    term.writeln(`\x1b[90mSandbox ID: ${shape.props.sandboxId}\x1b[0m`)
    term.writeln('\x1b[33mReady to execute code...\x1b[0m')
    term.writeln('')

    termRef.current = term
    fitAddonRef.current = fitAddon

    return () => {
      term.dispose()
      termRef.current = null
    }
  }, [])

  useEffect(() => {
    if (fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current?.fit() } catch (e) { /* ignore */ }
      }, 50)
    }
  }, [shape.props.w, shape.props.h])

  const handleExecute = useCallback(async () => {
    if (!termRef.current || !code.trim()) return

    const term = termRef.current
    term.writeln('')
    term.writeln(`\x1b[1;36m$ ${useCloudflare ? 'cf-sandbox' : 'local'} execute\x1b[0m`)
    term.writeln('\x1b[90m-----------------------------------\x1b[0m')

    onUpdateShape({ isRunning: true })

    try {
      const result = useCloudflare 
        ? await executeCode(code, shape.props.sandboxId)
        : executeLocally(code)

      if (result.success) {
        if (result.stdout) {
          result.stdout.split('\n').forEach(line => {
            term.writeln(`\x1b[37m${line}\x1b[0m`)
          })
        }
        if (result.stderr) {
          result.stderr.split('\n').forEach(line => {
            term.writeln(`\x1b[33m${line}\x1b[0m`)
          })
        }
        term.writeln('')
        term.writeln('\x1b[1;32m✓ Execution completed\x1b[0m')
      } else {
        term.writeln(`\x1b[1;31m✗ Error: ${result.error}\x1b[0m`)
      }

      onUpdateShape({ isRunning: false })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      term.writeln(`\x1b[1;31m✗ Error: ${errorMsg}\x1b[0m`)
      onUpdateShape({ isRunning: false })
    }
  }, [code, onUpdateShape, shape.props.sandboxId, useCloudflare])

  const handleGenerate = useCallback(async (prompt?: string) => {
    setIsGenerating(true)
    setShowPromptInput(false)
    const term = termRef.current
    if (term) {
      term.writeln('')
      if (prompt) {
        term.writeln(`\x1b[1;35m🤖 Generating: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"\x1b[0m`)
      } else {
        term.writeln('\x1b[1;35m🤖 Generating code...\x1b[0m')
      }
    }

    try {
      const result = useCloudflare ? await generateCode(prompt) : generateLocally()
      
      if (result.success && result.code) {
        onUpdateShape({ code: result.code })
        if (term) {
          term.writeln('\x1b[1;32m✓ Code generated!\x1b[0m')
        }
      } else {
        if (term) {
          term.writeln(`\x1b[1;31m✗ Generation failed\x1b[0m`)
        }
      }
    } catch (error) {
      if (term) {
        term.writeln(`\x1b[1;31m✗ Error generating code\x1b[0m`)
      }
    }
    
    setAiPrompt('')
    setIsGenerating(false)
  }, [onUpdateShape, useCloudflare])

  const handleClear = useCallback(() => {
    if (termRef.current) {
      termRef.current.clear()
      termRef.current.writeln('\x1b[33mTerminal cleared.\x1b[0m')
    }
    onUpdateShape({ output: [] })
  }, [onUpdateShape])

  const stopEvent = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e2e',
        borderRadius: 8,
        overflow: 'hidden',
        border: '2px solid #313244',
        pointerEvents: 'all',
      }}
      onPointerDown={stopEvent}
      onTouchStart={stopEvent}
      onTouchEnd={stopEvent}
    >
      {/* Title bar */}
      <div
        style={{
          padding: '6px 12px',
          backgroundColor: '#313244',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #45475a',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f38ba8' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f9e2af' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#a6e3a1' }} />
        </div>
        <input
          value={shape.props.title}
          onChange={(e) => onUpdateShape({ title: e.target.value })}
          onPointerDown={stopEvent}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#cdd6f4',
            fontSize: 12,
            fontWeight: 500,
            outline: 'none',
          }}
          placeholder="Terminal"
        />
        <button
          onClick={() => setUseCloudflare(!useCloudflare)}
          onPointerDown={stopEvent}
          style={{
            padding: '2px 6px',
            backgroundColor: useCloudflare ? '#fab387' : '#45475a',
            color: useCloudflare ? '#1e1e2e' : '#cdd6f4',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 9,
            fontWeight: 600,
          }}
          title={useCloudflare ? 'Using Cloudflare Sandbox' : 'Using local execution'}
        >
          {useCloudflare ? '☁️ CF' : '💻 Local'}
        </button>
      </div>

      {/* Code editor */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #45475a' }}>
        <textarea
          value={code}
          onChange={(e) => onUpdateShape({ code: e.target.value })}
          onPointerDown={stopEvent}
          onTouchStart={stopEvent}
          placeholder="// Write JavaScript/TypeScript code here..."
          style={{
            width: '100%',
            height: 120,
            padding: 10,
            backgroundColor: '#11111b',
            color: '#cdd6f4',
            border: 'none',
            resize: 'none',
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 11,
            outline: 'none',
            lineHeight: 1.4,
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '6px 10px',
            backgroundColor: '#181825',
          }}
        >
          <button
            onClick={handleExecute}
            onPointerDown={stopEvent}
            disabled={shape.props.isRunning || !code.trim()}
            style={{
              padding: '5px 10px',
              backgroundColor: shape.props.isRunning ? '#45475a' : '#a6e3a1',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: 4,
              cursor: shape.props.isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {shape.props.isRunning ? '⏳ Running...' : '▶ Run'}
          </button>
          <button
            onClick={() => showPromptInput ? handleGenerate(aiPrompt || undefined) : setShowPromptInput(true)}
            onPointerDown={stopEvent}
            disabled={isGenerating}
            style={{
              padding: '5px 10px',
              backgroundColor: '#cba6f7',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: 4,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {isGenerating ? '🤖 ...' : '🤖 AI'}
          </button>
          <button
            onClick={handleClear}
            onPointerDown={stopEvent}
            style={{
              padding: '5px 10px',
              backgroundColor: '#45475a',
              color: '#cdd6f4',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            Clear
          </button>
        </div>
        
        {/* AI Prompt Input */}
        {showPromptInput && (
          <div style={{ padding: '6px 10px', backgroundColor: '#11111b', borderTop: '1px solid #45475a' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onPointerDown={stopEvent}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') handleGenerate(aiPrompt || undefined)
                  if (e.key === 'Escape') setShowPromptInput(false)
                }}
                placeholder="Describe what code to generate... (Enter to submit)"
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  backgroundColor: '#181825',
                  color: '#cdd6f4',
                  border: '1px solid #45475a',
                  borderRadius: 4,
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleGenerate(aiPrompt || undefined)}
                onPointerDown={stopEvent}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#a6e3a1',
                  color: '#1e1e2e',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                Go
              </button>
              <button
                onClick={() => setShowPromptInput(false)}
                onPointerDown={stopEvent}
                style={{
                  padding: '6px 8px',
                  backgroundColor: '#45475a',
                  color: '#cdd6f4',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          minHeight: 100,
          padding: 4,
          overflow: 'hidden',
        }}
      />
    </div>
  )
}

// Shape utility class
export class TerminalShapeUtil extends BaseBoxShapeUtil<ITerminalShape> {
  static override type = TERMINAL_SHAPE_TYPE
  static override props: RecordProps<ITerminalShape> = {
    w: T.number,
    h: T.number,
    code: T.string,
    output: T.arrayOf(T.string),
    isRunning: T.boolean,
    title: T.string,
    sandboxId: T.string,
    lastResult: T.string,
  }

  getDefaultProps(): ITerminalShape['props'] {
    return {
      w: 500,
      h: 450,
      code: '// Write your code here\n// Use $input to access data from connected terminals\nconsole.log("Hello from Cloudflare Sandbox!");',
      output: [],
      isRunning: false,
      title: 'Sandbox Terminal',
      sandboxId: `sandbox-${Math.random().toString(36).slice(2, 8)}`,
      lastResult: '',
    }
  }

  component(shape: ITerminalShape) {
    const handleUpdate = (updates: Partial<ITerminalShape['props']>) => {
      this.editor.updateShape({
        id: shape.id,
        type: TERMINAL_SHAPE_TYPE,
        props: updates,
      })
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <TerminalComponent shape={shape} onUpdateShape={handleUpdate} />
      </HTMLContainer>
    )
  }

  indicator(shape: ITerminalShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
  }
}

export { TERMINAL_SHAPE_TYPE }
