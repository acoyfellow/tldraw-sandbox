import { useCallback } from 'react'
import { 
  Tldraw, 
  TldrawUiMenuItem, 
  DefaultToolbar, 
  useTools, 
  useIsToolSelected, 
  DefaultToolbarContent,
  useEditor,
  TLArrowShape,
  TLShapeId,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { TerminalShapeUtil, TERMINAL_SHAPE_TYPE, ITerminalShape } from './TerminalShape'
import { TerminalTool } from './TerminalTool'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787'

// Execute code via API
async function executeCodeAPI(code: string, sandboxId: string, inputData?: string) {
  try {
    let fullCode = code
    if (inputData) {
      fullCode = `const $input = ${JSON.stringify(inputData)};\ntry { if (typeof $input === 'string') $input = JSON.parse($input); } catch(e) {}\n` + code
    } else {
      fullCode = `const $input = undefined;\n` + code
    }
    const response = await fetch(`${WORKER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: fullCode, sandboxId, inputData }),
    })
    return await response.json()
  } catch (error) {
    return { success: false, error: 'Execution failed' }
  }
}

// Pipeline runner component
function PipelineRunner() {
  const editor = useEditor()

  const runPipeline = useCallback(async () => {
    // Get all terminal shapes and arrows
    const terminals = editor.getCurrentPageShapes().filter(
      (s): s is ITerminalShape => s.type === TERMINAL_SHAPE_TYPE
    )
    const arrows = editor.getCurrentPageShapes().filter(
      (s): s is TLArrowShape => s.type === 'arrow'
    )

    // Build dependency graph from arrows
    const graph = new Map<TLShapeId, TLShapeId[]>() // target -> sources
    const outputs = new Map<TLShapeId, string>() // terminal -> last output
    
    for (const terminal of terminals) {
      graph.set(terminal.id, [])
    }

    for (const arrow of arrows) {
      const startBinding = arrow.props.start
      const endBinding = arrow.props.end
      
      if (startBinding.type === 'binding' && endBinding.type === 'binding') {
        const sourceId = startBinding.boundShapeId
        const targetId = endBinding.boundShapeId
        
        // Check if both are terminals
        const sourceTerminal = terminals.find(t => t.id === sourceId)
        const targetTerminal = terminals.find(t => t.id === targetId)
        
        if (sourceTerminal && targetTerminal) {
          const deps = graph.get(targetId) || []
          deps.push(sourceId)
          graph.set(targetId, deps)
        }
      }
    }

    // Topological sort
    const visited = new Set<TLShapeId>()
    const order: TLShapeId[] = []
    
    function visit(id: TLShapeId) {
      if (visited.has(id)) return
      visited.add(id)
      const deps = graph.get(id) || []
      for (const dep of deps) {
        visit(dep)
      }
      order.push(id)
    }
    
    for (const terminal of terminals) {
      visit(terminal.id)
    }

    console.log('Pipeline order:', order.map(id => {
      const t = terminals.find(t => t.id === id)
      return t?.props.title || id
    }))

    // Execute in order
    for (const id of order) {
      const terminal = terminals.find(t => t.id === id)
      if (!terminal) continue

      // Gather inputs from dependencies
      const deps = graph.get(id) || []
      let inputData: string | undefined
      if (deps.length > 0) {
        // Combine outputs from all dependencies
        const inputs = deps.map(d => outputs.get(d)).filter(Boolean)
        if (inputs.length === 1) {
          inputData = inputs[0]
        } else if (inputs.length > 1) {
          inputData = JSON.stringify(inputs)
        }
      }

      // Mark as running
      editor.updateShape({
        id: terminal.id,
        type: TERMINAL_SHAPE_TYPE,
        props: { isRunning: true },
      })

      // Execute
      const result = await executeCodeAPI(
        terminal.props.code,
        terminal.props.sandboxId,
        inputData
      )

      // Store output for downstream terminals
      if (result.success && result.stdout) {
        // Use stderr as the pipe value (we store lastValue there)
        outputs.set(id, result.stderr || result.stdout.split('\n').pop() || '')
      }

      // Update terminal with result
      editor.updateShape({
        id: terminal.id,
        type: TERMINAL_SHAPE_TYPE,
        props: { 
          isRunning: false,
          lastResult: outputs.get(id) || '',
        },
      })

      // Small delay between executions for visual feedback
      await new Promise(r => setTimeout(r, 300))
    }

    console.log('Pipeline complete!')
  }, [editor])

  return (
    <button
      onClick={runPipeline}
      style={{
        position: 'absolute',
        top: 60,
        left: 10,
        padding: '8px 16px',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: 6,
        fontWeight: 600,
        cursor: 'pointer',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      ▶️ Run Pipeline
    </button>
  )
}

// Custom toolbar with terminal button
function CustomToolbar() {
  const tools = useTools()
  const isTerminalSelected = useIsToolSelected(tools['terminal'])

  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <TldrawUiMenuItem
        id="terminal"
        icon="code"
        label="Terminal"
        isSelected={isTerminalSelected}
        onSelect={() => {
          tools['terminal'].onSelect('toolbar')
        }}
      />
    </DefaultToolbar>
  )
}

const customShapeUtils = [TerminalShapeUtil]
const customTools = [TerminalTool]

export default function App() {
  return (
    <div className="tldraw__editor">
      <Tldraw
        shapeUtils={customShapeUtils}
        tools={customTools}
        components={{
          Toolbar: CustomToolbar,
          InFrontOfTheCanvas: PipelineRunner,
        }}
        onMount={(editor) => {
          // Create two connected terminals as demo
          const terminal1 = editor.createShape({
            type: TERMINAL_SHAPE_TYPE,
            x: 100,
            y: 100,
            props: {
              title: 'Data Generator',
              code: '// Generate some data\nconst data = { numbers: [1, 2, 3, 4, 5], name: "Pipeline" };\nconsole.log("Generated:", data);\ndata; // Return value is passed downstream',
            },
          })
          
          const terminal2 = editor.createShape({
            type: TERMINAL_SHAPE_TYPE,
            x: 650,
            y: 100,
            props: {
              title: 'Data Processor',
              code: '// Process incoming data\nconsole.log("Received $input:", $input);\n\nif ($input && $input.numbers) {\n  const doubled = $input.numbers.map(n => n * 2);\n  console.log("Doubled:", doubled);\n  const sum = doubled.reduce((a, b) => a + b, 0);\n  console.log("Sum:", sum);\n}',
            },
          })
        }}
      />
    </div>
  )
}
