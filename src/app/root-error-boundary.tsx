import { Component, type ErrorInfo, type ReactNode } from 'react'

type RootErrorBoundaryProps = { children: ReactNode }
type RootErrorBoundaryState = { error: Error | null }

// I-021 防线：渲染树内的未捕获错误此前会把整棵树卸载成白屏（Tooltip 缺 Provider 即一例）。
// 根边界兜底：显示可读错误与一键恢复，而不是白屏。
// 文案有意不走 useTranslate——边界必须在 i18n 自身故障时仍能渲染。
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[root-error-boundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          height: '100vh',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>界面遇到错误</div>
        <pre
          style={{
            maxWidth: 640,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 12,
            color: '#666',
            background: '#f5f5f5',
            borderRadius: 8,
            padding: 12
          }}
        >
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => location.reload()}
          style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          重新加载
        </button>
      </div>
    )
  }
}
