import { useState, useEffect, useRef, useCallback } from 'react'

interface AutoRefreshOptions {
    enabled: boolean
    interval: number // 秒
    onRefresh: () => void
}

interface AutoRefreshResult {
    nextRefreshTime: number | null // 时间戳，用于子组件计算倒计时
    triggerRefresh: () => void
}

export function useAutoRefresh(options: AutoRefreshOptions): AutoRefreshResult {
    const { enabled, interval } = options
    const [nextRefreshTime, setNextRefreshTime] = useState<number | null>(null)

    // 使用 ref 保存回调和配置
    const onRefreshRef = useRef(options.onRefresh)
    onRefreshRef.current = options.onRefresh

    const intervalRef = useRef(interval)
    intervalRef.current = interval

    // 用 ref 跟踪目标时间，避免闭包问题
    const targetTimeRef = useRef<number>(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const triggerRefresh = useCallback(() => {
        onRefreshRef.current()
        const newTarget = Date.now() + intervalRef.current * 1000
        targetTimeRef.current = newTarget
        setNextRefreshTime(newTarget)
    }, [])

    useEffect(() => {
        if (!enabled) {
            setNextRefreshTime(null)
            targetTimeRef.current = 0
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            return
        }

        console.log('[88tools] 自动刷新已启用，间隔:', interval, '秒')

        // 设置初始目标时间
        const initialTarget = Date.now() + interval * 1000
        targetTimeRef.current = initialTarget
        setNextRefreshTime(initialTarget)

        // 每秒检查是否需要刷新
        timerRef.current = setInterval(() => {
            const now = Date.now()
            if (now >= targetTimeRef.current && targetTimeRef.current > 0) {
                console.log('[88tools] 触发刷新')
                onRefreshRef.current()
                // 设置下一次目标时间
                const newTarget = Date.now() + intervalRef.current * 1000
                targetTimeRef.current = newTarget
                setNextRefreshTime(newTarget)
            }
        }, 1000)

        return () => {
            console.log('[88tools] 清理自动刷新定时器')
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [enabled, interval])

    return {
        nextRefreshTime,
        triggerRefresh,
    }
}
