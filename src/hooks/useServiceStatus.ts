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

export function useServiceStatus(): ServiceStatusResult {
    const [data, setData] = useState<StatusApiResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchStatus = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        console.log('[88tools] 正在获取服务状态...')

        try {
            const response = await fetch(STATUS_API_URL, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            })

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status}`)
            }

            const result = await response.json() as StatusApiResponse
            console.log('[88tools] 服务状态获取成功:', result.providers?.length, '个服务')
            console.log('[88tools] 第一个服务 timeline 长度:', result.providers?.[0]?.timeline?.length)
            setData(result)
            setLastUpdated(new Date())
        } catch (err) {
            console.error('[88tools] 获取服务状态失败:', err)
            setError(err instanceof Error ? err.message : '获取服务状态失败')
        } finally {
            setIsLoading(false)
        }
    }, [])

    // 初始加载
    useEffect(() => {
        fetchStatus()

        // 每 30 秒自动刷新
        const interval = setInterval(fetchStatus, 30 * 1000)
        return () => clearInterval(interval)
    }, [fetchStatus])

    return {
        data,
        isLoading,
        error,
        refresh: fetchStatus,
        lastUpdated,
    }
}

// 导出类型供组件使用
export type { ServiceProvider, StatusApiResponse, TimelineEntry, Statistics }
