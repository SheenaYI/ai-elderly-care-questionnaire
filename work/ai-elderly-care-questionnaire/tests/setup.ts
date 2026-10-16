/**
 * 测试环境初始化。
 *
 * 处理三件事：
 *  1. React 18 的 act(...) 需要显式声明测试环境。
 *  2. jsdom 的 window.scrollTo 存在但未实现，会打印 "Not implemented"。
 *  3. **localStorage 在 Node 22+ 下会被 Node 自己的实验性全局遮蔽**
 *     （`localStorage is not available because --localstorage-file was not provided`），
 *     导致 jsdom 的 window.localStorage 不可用。本项目的草稿持久化依赖它，
 *     因此这里显式提供一个符合 Storage 接口的内存实现，让持久化逻辑可被真实测试。
 */

import { afterEach } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** 最小但行为完整的 Storage 实现（内存版）。 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string): void {
      map.set(String(key), String(value))
    },
    removeItem(key: string): void {
      map.delete(key)
    },
    clear(): void {
      map.clear()
    },
  } as Storage
}

const memoryStorage = createMemoryStorage()

if (typeof window !== 'undefined') {
  // jsdom 未实现 scrollTo
  window.scrollTo = (() => {}) as unknown as typeof window.scrollTo

  // 强制使用内存实现，覆盖 Node 的实验性全局与可能缺失的 jsdom 实现
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: memoryStorage,
  })
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  })
}

// 部分代码路径通过 globalThis.localStorage 访问
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: memoryStorage,
})

/** 每个用例后重置，避免用例之间通过存储互相污染。 */
afterEach(() => {
  memoryStorage.clear()
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }
})
