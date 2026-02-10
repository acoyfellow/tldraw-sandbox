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
    }
  }
}

export type ITerminalShape = TLShape<typeof TERMINAL_SHAPE_TYPE>

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
  
  // Use shape.props.code directly - it comes from TLDraw's store
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
      try {
        fitAddon.fit()
      } catch (e) {
        // ignore fit errors
      }
    }, 100)

    term.writeln('\x1b[1;34m=== Cloudflare Sandbox Terminal ===\x1b[0m')
    term.writeln('')
    term.writeln('\x1b[33mReady to execute TypeScript code...\x1b[0m')
    term.writeln('')

    termRef.current = term
    fitAddonRef.current = fitAddon

    return () => {
      term.dispose()
      termRef.current = null
    }
  }, [])

  // Resize terminal when shape size changes
  useEffect(() => {
    if (fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit()
        } catch (e) {
          // ignore
        }
      }, 50)
    }
  }, [shape.props.w, shape.props.h])

  const executeCode = useCallback(async () => {
    if (!termRef.current || !code.trim()) return

    const term = termRef.current
    term.writeln('')
    term.writeln('\x1b[1;36m$ ts-node execute\x1b[0m')
    term.writeln('\x1b[90m-----------------------------------\x1b[0m')

    onUpdateShape({ isRunning: true })
    const newOutput: string[] = []

    try {
      const mockConsole = {
        log: (...args: unknown[]) => {
          const line = args.map(a => 
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
          ).join(' ')
          newOutput.push(line)
          term.writeln(`\x1b[37m${line}\x1b[0m`)
        },
        error: (...args: unknown[]) => {
          const line = args.map(a => String(a)).join(' ')
          newOutput.push(`[ERROR] ${line}`)
          term.writeln(`\x1b[31m${line}\x1b[0m`)
        },
      }

      // Very basic TypeScript -> JS (just strips types for demo)
      const jsCode = code
        .replace(/:\s*\w+(?:\[\])?(?:\s*\|\s*\w+)*/g, '') // Remove type annotations
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '') // Remove interfaces
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, '') // Remove type aliases
        .replace(/<\w+>/g, '') // Remove generics

      const fn = new Function('console', jsCode)
      await fn(mockConsole)

      term.writeln('')
      term.writeln('\x1b[1;32m✓ Execution completed\x1b[0m')
      
      onUpdateShape({ output: [...shape.props.output, ...newOutput], isRunning: false })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      term.writeln(`\x1b[1;31m✗ Error: ${errorMsg}\x1b[0m`)
      onUpdateShape({ isRunning: false })
    }
  }, [code, onUpdateShape, shape.props.output])

  const generateAICode = useCallback(async () => {
    setIsGenerating(true)
    const term = termRef.current
    if (term) {
      term.writeln('')
      term.writeln('\x1b[1;35m🤖 Generating AI code...\x1b[0m')
    }

    // Simulate AI generation
    await new Promise(r => setTimeout(r, 800))
    
    const examples = [
      `// Fibonacci sequence
const fib = (n) => n <= 1 ? n : fib(n-1) + fib(n-2);
console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
  console.log("fib(" + i + ") = " + fib(i));
}`,
      `// Array manipulation
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Original:", numbers);
console.log("Doubled:", doubled);
console.log("Sum:", sum);`,
      `// Object operations
const user = { name: "Alice", age: 30 };
const updated = { ...user, city: "NYC" };
console.log("User:", user);
console.log("Updated:", updated);
console.log("Keys:", Object.keys(updated));`,
      `// Async simulation
console.log("Starting process...");
console.log("Step 1: Initialize");
console.log("Step 2: Process data");
console.log("Step 3: Complete!");
console.log("Result:", { status: "success" });`,
      `// Prime numbers
function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}
console.log("Primes under 50:");
const primes = [];
for (let i = 2; i < 50; i++) {
  if (isPrime(i)) primes.push(i);
}
console.log(primes.join(", "));`,
    ]
    
    const newCode = examples[Math.floor(Math.random() * examples.length)]
    onUpdateShape({ code: newCode })
    
    if (term) {
      term.writeln('\x1b[1;32m✓ Code generated!\x1b[0m')
    }
    
    setIsGenerating(false)
  }, [onUpdateShape])

  const clearTerminal = useCallback(() => {
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
        <span style={{ color: '#6c7086', fontSize: 10 }}>CF Sandbox</span>
      </div>

      {/* Code editor */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #45475a' }}>
        <textarea
          value={code}
          onChange={(e) => onUpdateShape({ code: e.target.value })}
          onPointerDown={stopEvent}
          onTouchStart={stopEvent}
          placeholder="// Write TypeScript code here..."
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
            onClick={executeCode}
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
            onClick={generateAICode}
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
            onClick={clearTerminal}
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
  }

  getDefaultProps(): ITerminalShape['props'] {
    return {
      w: 480,
      h: 420,
      code: '// Write your TypeScript code here\nconsole.log("Hello from Cloudflare Sandbox!");',
      output: [],
      isRunning: false,
      title: 'Sandbox Terminal',
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
