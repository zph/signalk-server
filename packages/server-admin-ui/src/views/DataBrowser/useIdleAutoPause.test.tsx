import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GranularSubscriptionManager } from './GranularSubscriptionManager'
import { useIdleAutoPause } from './useIdleAutoPause'

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useIdleAutoPause', () => {
  afterEach(() => {
    vi.useRealTimers()
    setVisibilityState('visible')
  })

  it('unsubscribes after five minutes and restores Data Browser subscriptions on foreground', () => {
    vi.useFakeTimers()
    const manager = new GranularSubscriptionManager()
    const socket = { send: vi.fn() }
    const lastSent = () =>
      JSON.parse(socket.send.mock.calls[socket.send.mock.calls.length - 1][0])
    const paths = ['navigation.position$gps']
    manager.setWebSocket(socket)
    manager.startDiscovery()
    manager.requestPaths(paths)
    act(() => vi.advanceTimersByTime(350))

    const onPause = vi.fn(() => manager.unsubscribeAll())
    const onResume = vi.fn(() => {
      manager.startDiscovery()
      manager.requestPaths(paths)
    })
    const { result } = renderHook(() =>
      useIdleAutoPause(true, onPause, onResume)
    )

    act(() => setVisibilityState('hidden'))
    act(() => vi.advanceTimersByTime(5 * 60 * 1000 - 1))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
    expect(onPause).toHaveBeenCalledOnce()
    expect(lastSent()).toEqual({
      context: '*',
      unsubscribe: [{ path: '*' }]
    })

    act(() => setVisibilityState('visible'))
    expect(result.current).toBe(false)
    expect(onResume).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(350))
    expect(lastSent()).toEqual({
      context: '*',
      subscribe: [{ path: 'navigation.position' }],
      announceNewPaths: true,
      sourcePolicy: 'preferred'
    })
  })

  it('restarts the full delay after the page returns to the foreground early', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useIdleAutoPause(true, vi.fn(), vi.fn())
    )

    act(() => setVisibilityState('hidden'))
    act(() => vi.advanceTimersByTime(4 * 60 * 1000))
    act(() => setVisibilityState('visible'))
    act(() => setVisibilityState('hidden'))
    act(() => vi.advanceTimersByTime(5 * 60 * 1000 - 1))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it('does not auto-pause when disabled by the manual pause setting', () => {
    vi.useFakeTimers()
    const onPause = vi.fn()
    const onResume = vi.fn()
    const { result, rerender } = renderHook(
      ({ enabled }) => useIdleAutoPause(enabled, onPause, onResume),
      { initialProps: { enabled: false } }
    )

    act(() => setVisibilityState('hidden'))
    act(() => vi.advanceTimersByTime(5 * 60 * 1000))
    expect(result.current).toBe(false)
    expect(onPause).not.toHaveBeenCalled()

    rerender({ enabled: true })
    act(() => vi.advanceTimersByTime(5 * 60 * 1000))
    expect(result.current).toBe(true)
  })
})
