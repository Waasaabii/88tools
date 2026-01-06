import { useState, useEffect, useRef, useCallback } from 'react'

interface AutoRefreshOptions {
    enabled: boolean
    interval: number // 秒
    onRefresh: () => void
}

interface AutoRefreshResult {
    countdown: number
    nextRefreshTime: string | null
    triggerRefresh: () => void
}

export function useAutoRefresh(options: AutoRefreshOptions): AutoRefreshResult {
    const { enabled, interval } = options
    const [countdown, setCountdown] = useState(interval)
    const [nextRefreshTime, setNextRefreshTime] = useState<string | null>(null)

    // 使用 ref 保存 onRefresh 回调，避免 effect 依赖变化
    const onRefreshRef = useRef(options.onRefresh)
    onRefreshRef.current = options.onRefresh

    // 使用 ref 保存 interval，避免 effect 重新执行
    const intervalRef = useRef(interval)
    intervalRef.current = interval

    const calculateNextRefreshTime = useCallback((seconds: number) => {
        const now = new Date()
        now.setSeconds(now.getSeconds() + seconds)
        return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }, [])

    const triggerRefresh = useCallback(() => {
        onRefreshRef.current()
        setCountdown(intervalRef.current)
        setNextRefreshTime(calculateNextRefreshTime(intervalRef.current))
    }, [calculateNextRefreshTime])

    useEffect(() => {
        if (!enabled) {
            setCountdown(interval)
            setNextRefreshTime(null)
            return
        }

        console.log('[88tools] 自动刷新已启用，间隔:', interval, '秒')

        // 设置初始值
        setCountdown(interval)
        setNextRefreshTime(calculateNextRefreshTime(interval))

        // 每秒倒计时
        const timer = setInterval(() => {
            setCountdown(prev => {
                const newValue = prev - 1
                console.log('[88tools] 倒计时:', newValue)

                if (newValue <= 0) {
                    // 触发刷新
                    console.log('[88tools] 倒计时结束，触发刷新')
                    onRefreshRef.current()
                    setNextRefreshTime(calculateNextRefreshTime(intervalRef.current))
                    return intervalRef.current
                }

                return newValue
            })
        }, 1000)

        return () => {
            console.log('[88tools] 清理自动刷新定时器')
            clearInterval(timer)
        }
    }, [enabled, interval, calculateNextRefreshTime])  // 只依赖 enabled 和 interval

    return {
        countdown,
        nextRefreshTime,
        triggerRefresh,
    }
}
