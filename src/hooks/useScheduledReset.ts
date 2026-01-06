import { useState, useEffect, useRef, useCallback } from 'react'

interface ScheduledResetOptions {
    enabled: boolean
    times: string[] // HH:mm 格式的时间数组
    onReset: () => void
}

interface ScheduledResetResult {
    nextResetTime: string | null
    countdown: number // 距离下次重置的秒数
    status: 'idle' | 'waiting' | 'cooling'
}

export function useScheduledReset(options: ScheduledResetOptions): ScheduledResetResult {
    const { enabled, times, onReset } = options
    const [nextResetTime, setNextResetTime] = useState<string | null>(null)
    const [countdown, setCountdown] = useState(0)
    const [status, setStatus] = useState<'idle' | 'waiting' | 'cooling'>('idle')
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // 计算下一个重置时间
    const calculateNextResetTime = useCallback((): Date | null => {
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
    }, [times])

    // 检查重置按钮是否可用
    const checkResetButtonAvailable = useCallback((): boolean => {
        const resetBtn = document.querySelector('button:contains("重置")') as HTMLButtonElement | null
        if (!resetBtn) {
            // 尝试其他选择器
            const buttons = document.querySelectorAll('button')
            for (const btn of buttons) {
                if (btn.textContent?.includes('重置') && !btn.disabled) {
                    return true
                }
            }
            return false
        }
        return !resetBtn.disabled
    }, [])

    // 执行重置
    const executeReset = useCallback(() => {
        if (checkResetButtonAvailable()) {
            onReset()
            setStatus('cooling')
            // 5秒后重新检查状态
            setTimeout(() => {
                setStatus('waiting')
            }, 5000)
        } else {
            setStatus('cooling')
        }
    }, [onReset, checkResetButtonAvailable])

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            setNextResetTime(null)
            setCountdown(0)
            setStatus('idle')
            return
        }

        setStatus('waiting')

        // 更新倒计时的函数
        const updateCountdown = () => {
            const nextTime = calculateNextResetTime()
            if (!nextTime) {
                setNextResetTime(null)
                setCountdown(0)
                return
            }

            const now = new Date()
            const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000))

            setNextResetTime(nextTime.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            }))
            setCountdown(diffSeconds)

            // 如果到达重置时间
            if (diffSeconds === 0) {
                executeReset()
            }
        }

        // 初始更新
        updateCountdown()

        // 每秒更新倒计时
        intervalRef.current = setInterval(updateCountdown, 1000)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [enabled, calculateNextResetTime, executeReset])

    return {
        nextResetTime,
        countdown,
        status,
    }
}
