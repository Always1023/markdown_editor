import '@testing-library/jest-dom/vitest'

// Monaco 的 standalone model service 按 OS 选默认 EOL（Windows→CRLF），而迁移测试的
// 断言沿用 Orca mac/linux CI 的 LF 语义。vitest 原生进程里 monaco 走 process.platform
// 分支，这里把平台指纹固定为 darwin，使模型 EOL 与测试环境解耦（只影响测试进程）。
Object.defineProperty(process, 'platform', { value: 'darwin' })
