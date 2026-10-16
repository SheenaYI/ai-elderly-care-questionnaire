/**
 * 测试环境初始化。
 *
 * React 18 的 act(...) 需要显式声明当前处于测试环境，
 * 否则 effect 的刷新不会被同步，测试之间会互相干扰。
 */

import { afterEach } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom 的 window.scrollTo 存在但未实现（会打印 "Not implemented"）；
// 组件在路由切换时会调用它，因此无条件替换为无害实现。
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as unknown as typeof window.scrollTo
}

// 每个测试后清理 DOM 与本地存储，避免测试之间的状态污染
afterEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
  }
})
