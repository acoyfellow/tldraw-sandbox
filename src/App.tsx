import { Tldraw, TldrawUiMenuItem, DefaultToolbar, TldrawUiMenuGroup, useTools, useIsToolSelected, DefaultToolbarContent } from 'tldraw'
import 'tldraw/tldraw.css'
import { TerminalShapeUtil, TERMINAL_SHAPE_TYPE } from './TerminalShape'
import { TerminalTool } from './TerminalTool'

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
        }}
        onMount={(editor) => {
          // Create an initial terminal shape
          editor.createShape({
            type: TERMINAL_SHAPE_TYPE,
            x: 200,
            y: 100,
          })
        }}
      />
    </div>
  )
}
