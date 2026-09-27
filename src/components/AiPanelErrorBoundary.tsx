import { Component, type ReactNode } from 'react'

interface AiPanelErrorBoundaryProps {
  children: ReactNode
}

interface AiPanelErrorBoundaryState {
  hasError: boolean
}

export class AiPanelErrorBoundary extends Component<AiPanelErrorBoundaryProps, AiPanelErrorBoundaryState> {
  state: AiPanelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AiPanelErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <p>The chat panel hit a bad status, and the rest of the app is still there.</p>
    }
    return this.props.children
  }
}
