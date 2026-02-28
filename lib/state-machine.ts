export enum AgentState {
  IDLE = "IDLE",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING",
  SPEAKING = "SPEAKING",
}

const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  [AgentState.IDLE]: [AgentState.LISTENING],
  [AgentState.LISTENING]: [AgentState.PROCESSING, AgentState.IDLE],
  [AgentState.PROCESSING]: [AgentState.SPEAKING, AgentState.LISTENING, AgentState.IDLE],
  [AgentState.SPEAKING]: [AgentState.LISTENING, AgentState.IDLE],
}

export type StateChangeCallback = (
  newState: AgentState,
  prevState: AgentState
) => void

export class StateMachine {
  private _currentState: AgentState = AgentState.IDLE
  private _onStateChange: StateChangeCallback | null = null

  get currentState(): AgentState {
    return this._currentState
  }

  set onStateChange(cb: StateChangeCallback | null) {
    this._onStateChange = cb
  }

  transition(newState: AgentState): boolean {
    const allowed = VALID_TRANSITIONS[this._currentState]
    if (!allowed.includes(newState)) {
      console.warn(
        `Invalid state transition: ${this._currentState} -> ${newState}`
      )
      return false
    }

    const prev = this._currentState
    this._currentState = newState
    this._onStateChange?.(newState, prev)
    return true
  }

  reset(): void {
    const prev = this._currentState
    this._currentState = AgentState.IDLE
    if (prev !== AgentState.IDLE) {
      this._onStateChange?.(AgentState.IDLE, prev)
    }
  }
}
