import { useState, useEffect, useCallback } from 'react'

// API 响应数据类型 - 修正为实际的 API 结构
interface TimelineEntry {
    status: 'operational' | 'degraded' | 'failed' | 'maintenance' | 'down'
    latency_ms: number
    ping_latency_ms: number
    checked_at: string
    message: string
}

interface LatestStatus {
    status: 'operational' | 'degraded' | 'failed' | 'maintenance' | 'down'
    latency_ms: number
    ping_latency_ms: number
    checked_at: string
    message: string
}

interface Statistics {
    uptime_percent: number
    avg_latency_ms: number
}

interface ServiceProvider {
    id: string
    name: string
    type: string
    model: string
    group: string
    endpoint: string
    latest: LatestStatus
    statistics: Statistics
    timeline: TimelineEntry[]  // 修正：API 返回的是 timeline 不是 history
}

interface StatusSummary {
    total: number
    operational: number
    degraded: number
    failed: number
    maintenance: number
}

interface StatusApiResponse {
    providers: ServiceProvider[]
    summary?: StatusSummary
}

interface ServiceStatusResult {
    data: StatusApiResponse | null
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
    lastUpdated: Date | null
}

const STATUS_API_URL = 'https://www.88code.ai/status-api/api/v1/status'

// 模块级单例：缓存数据和请求状态
let cachedData: StatusApiResponse | null = null
let cachedLastUpdated: Date | null = null
let isRequesting = false
let requestPromise: Promise<void> | null = null
let subscriberCount = 0
let refreshInterval: ReturnType<typeof setInterval> | null = null

// 通知订阅者更新
const subscribers = new Set<() => void>()
function notifySubscribers() {
    subscribers.forEach(fn => fn())
}

// 共享的 fetch 函数
async function fetchStatusShared(): Promise<void> {
    // 如果正在请求，等待现有请求完成
    if (isRequesting && requestPromise) {
        await requestPromise
        return
    }

    isRequesting = true
    console.log('[88tools] 正在获取服务状态...')

    requestPromise = (async () => {
        try {
            const response = await fetch(STATUS_API_URL)
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            cachedData = await response.json()
            cachedLastUpdated = new Date()
            console.log('[88tools] 服务状态获取成功')
        } catch (e) {
            console.error('[88tools] 获取服务状态失败:', e)
            throw e
        } finally {
            isRequesting = false
            requestPromise = null
            notifySubscribers()
        }
    })()

    await requestPromise
}

export function useServiceStatus(enabled: boolean = true): ServiceStatusResult {
    const [data, setData] = useState<StatusApiResponse | null>(cachedData)
    const [isLoading, setIsLoading] = useState(isRequesting)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(cachedLastUpdated)

    // 同步本地状态与缓存
    const syncFromCache = useCallback(() => {
        setData(cachedData)
        setLastUpdated(cachedLastUpdated)
        setIsLoading(isRequesting)
    }, [])

    // 手动刷新
    const refresh = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            await fetchStatusShared()
            syncFromCache()
        } catch (e) {
            setError(e instanceof Error ? e.message : '未知错误')
        } finally {
            setIsLoading(false)
        }
    }, [syncFromCache])

    useEffect(() => {
        if (!enabled) return

        // 订阅更新
        subscribers.add(syncFromCache)
        subscriberCount++

        // 首次挂载且无缓存时请求
        if (!cachedData && !isRequesting) {
            refresh()
        } else {
            // 有缓存，直接同步
            syncFromCache()
        }

        // 启动定时刷新（全局单例）
        if (!refreshInterval) {
            refreshInterval = setInterval(() => {
                fetchStatusShared().catch(() => {})
            }, 30 * 1000)
        }

        return () => {
            subscribers.delete(syncFromCache)
            subscriberCount--

            // 所有订阅者都取消后，清理定时器
            if (subscriberCount === 0 && refreshInterval) {
                clearInterval(refreshInterval)
                refreshInterval = null
            }
        }
    }, [enabled, syncFromCache, refresh])

    return {
        data,
        isLoading,
        error,
        refresh,
        lastUpdated,
    }
}

// 导出类型供组件使用
export type { ServiceProvider, StatusApiResponse, TimelineEntry, Statistics }
