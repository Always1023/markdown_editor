import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    // 迁移件的测试文件自带 @vitest-environment 注释；缺省环境用 happy-dom
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    // .chromium.test.ts 需要真实浏览器（@playwright/test），留给阶段 4 的 e2e 安排
    exclude: ['**/node_modules/**', '**/*.chromium.test.ts'],
    setupFiles: ['tests/setup/dom-setup.ts'],
    globals: true,
    // Orca 的单测配置（config/vitest.config.ts）：GC 断言需要 --expose-gc，
    // 编辑器首渲染偏重，5s 默认超时会在并行负载下轮换假失败。
    // vitest 5 起池配置拍平到顶层（poolOptions 已移除）。
    pool: 'forks',
    execArgv: ['--expose-gc'],
    // 60s：全量并行时最重的预览分块测试（KaTeX 大表格）在 Windows 开发机上
    // 抖到 30s 以上（单跑 8s），超时按全量负载留余量。
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
})
