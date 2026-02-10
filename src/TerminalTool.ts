import { StateNode, TLClickEvent } from 'tldraw'
import { TERMINAL_SHAPE_TYPE } from './TerminalShape'

export class TerminalTool extends StateNode {
  static override id = 'terminal'

  override onEnter() {
    this.editor.setCursor({ type: 'cross' })
  }

  override onPointerDown(info: TLClickEvent) {
    const { currentPagePoint } = this.editor.inputs
    
    this.editor.createShape({
      type: TERMINAL_SHAPE_TYPE,
      x: currentPagePoint.x - 250, // Center the shape
      y: currentPagePoint.y - 225,
    })

    // Switch back to select tool after creating
    this.editor.setCurrentTool('select')
  }
}
