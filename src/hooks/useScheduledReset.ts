import { useState, useEffect, useRef } from 'react'

interface ScheduledResetOptions {
    enabled: boolean
    times: string[] // HH:mm 格式的时间数组
    onReset: () => void
}

interface ScheduledResetResult {
    nextResetTime: string | null      // 下次重置时间点 "00:00"
    remainingMs: number | null        // 剩余毫秒数
    isPreciseMode: boolean            // 是否在精准模式（≤30分钟）
    status: 'idle' | 'waiting' | 'cooling'
}

// 精准模式阈值：30 分钟
const PRECISE_MODE_THRESHOLD_MS = 30 * 60 * 1000

// 计算下一个重置时间
function calculateNextResetTime(times: string[]): Date | null {
    if (times.length === 0) return null

    const now = new Date()
    const todayTimes: Date[] = []
    const tomorrowTimes: Date[] = []

    times.forEach(time => {
        const [hours, minutes] = time.split(':').map(Number)

        // 今天的时间点
        const todayTime = new Date()
        todayTime.setHours(hours, minutes, 0, 0)

        // 明天的时间点
        const tomorrowTime = new Date()
        tomorrowTime.setDate(tomorrowTime.getDate() + 1)
        tomorrowTime.setHours(hours, minutes, 0, 0)

        if (todayTime > now) {
            todayTimes.push(todayTime)
        }
        tomorrowTimes.push(tomorrowTime)
    })

    // 获取最近的时间点
    const allTimes = [...todayTimes, ...tomorrowTimes].sort((a, b) => a.getTime() - b.getTime())
    return allTimes[0] || null
}

export function useScheduledReset(options: ScheduledResetOptions): ScheduledResetResult {
    const { enabled, times, onReset } = options
    const [nextResetTime, setNextResetTime] = useState<string | null>(null)
    const [remainingMs, setRemainingMs] = useState<number | null>(null)
    const [isPreciseMode, setIsPreciseMode] = useState(false)
    const [status, setStatus] = useState<'idle' | 'waiting' | 'cooling'>('idle')

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastResetRef = useRef<number>(0)

    // 用 ref 保存最新的 onReset，避免依赖变化
    const onResetRef = useRef(onReset)
    onResetRef.current = onReset

    // 序列化 times 用于依赖比较
    const timesKey = JSON.stringify(times)

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            setNextResetTime(null)
            setRemainingMs(null)
            setIsPreciseMode(false)
            setStatus('idle')
            return
        }

        setStatus('waiting')

        // 执行重置
        const executeReset = () => {
            const now = Date.now()
            // 防止 60 秒内重复触发
            if (now - lastResetRef.current < 60000) {
                console.log('[88tools] 定时重置: 60秒内已触发过，跳过')
                return
            }
            lastResetRef.current = now

            console.log('[88tools] 定时重置: 触发 onReset 回调')
            onResetRef.current()
            setStatus('cooling')
            setTimeout(() => {
                setStatus('waiting')
            }, 5000)
        }

        // 调度下一次检查
        const scheduleNextCheck = () => {
            const nextTime = calculateNextResetTime(times)
            if (!nextTime) {
                setNextResetTime(null)
                setRemainingMs(null)
                setIsPreciseMode(false)
                return
            }

            const now = Date.now()
            const diffMs = nextTime.getTime() - now
            const isPrecise = diffMs <= PRECISE_MODE_THRESHOLD_MS

            // 更新状态
            const timeStr = nextTime.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            })
            setNextResetTime(timeStr)
            setRemainingMs(diffMs)
            setIsPreciseMode(isPrecise)

            // 检查是否到达重置时间（±2秒容差）
            if (diffMs <= 2000 && diffMs >= -2000) {
                executeReset()
            }

            // 根据模式决定下次检查间隔
            const checkInterval = isPrecise ? 1000 : 60000

            timerRef.current = setTimeout(() => {
                scheduleNextCheck()
            }, checkInterval)
        }

        // 初始调度
        scheduleNextCheck()

        // Tab 切回时重新调度（刷新状态，不补偿执行）
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[88tools] Tab 切回，刷新定时重置状态')
                if (timerRef.current) {
                    clearTimeout(timerRef.current)
                }
                scheduleNextCheck()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [enabled, timesKey]) // 依赖 enabled 和 times 变化

    return {
        nextResetTime,
        remainingMs,
        isPreciseMode,
        status,
    }
}
