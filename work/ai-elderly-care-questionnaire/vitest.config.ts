import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
    // 个别用例需要等真实网络超时（导出鉴权会向 Supabase 校验 token），
    // 因此默认超时放宽；真正走网络的用例会各自显式声明更长的超时。
    testTimeout: 15000,
  },
})
