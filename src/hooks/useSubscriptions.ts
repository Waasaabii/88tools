import { useState, useCallback, useRef } from 'react'

// ============ API 类型定义 ============

interface ApiSubscriptionPlan {
    creditLimit: number
    subscriptionName: string
}

interface ApiSubscription {
    id: number
    subscriptionPlanName: string      // "FREE", "PRO", "PAYGO"
    billingCycleDesc: string          // "年付", "月付"
    canResetNow: boolean
    nextResetAvailableAt: string | null  // "2026-01-07 05:17:45"
    resetTimes: number                // 剩余重置次数
    currentCredits: number            // 当前额度
    subscriptionStatus: string        // "活跃中", "已过期", "未开始"
    isActive: boolean
    remainingDays: number             // 剩余天数
    endDate: string                   // 到期日期 "2026-02-05 23:33:17"
    subscriptionPlan: ApiSubscriptionPlan
}

interface ApiResponse {
    code: number
    ok: boolean
    data: ApiSubscription[]
}

// ============ 订阅信息类型 ============

export interface SubscriptionInfo {
    id: string           // 使用 backendId 作为唯一标识（用于持久化）
    backendId: string    // 后端真实 ID (用于 API 调用)
    name: string         // 订阅名称 (FREE, PRO, PAYGO 等)
    type: string         // 计费类型 (月付/年付/每日免费)
    balance: string      // 额度余额显示文本
    balancePercent: number // 额度百分比 (0-100)
    canReset: boolean    // 是否可以重置（有重置按钮且未冷却）
    isOnCooldown: boolean // 是否在冷却中
    cooldownText?: string // 冷却提示文字
    resetCount?: number   // 今日剩余重置次数
    nextResetAvailableAt?: Date | null  // 精确冷却结束时间
    status?: string      // 订阅状态 (活跃中/已过期/未开始)
    daysRemaining: number // 剩余天数
    hasResetButton: boolean  // 是否有重置按钮（用于判断能否选中）
}

export interface UseSubscriptionsResult {
    subscriptions: SubscriptionInfo[]
    selectedIds: Set<string>
    toggleSelection: (id: string) => void
    selectAll: () => void
    deselectAll: () => void
    resettableCount: number  // 可重置的订阅数量
    selectedResettableCount: number // 选中且可重置的数量
    scan: () => Promise<void>
    isScanning: boolean
    lastScanTime: number | null
}

interface UseSubscriptionsOptions {
    initialSelectedIds?: string[]  // 持久化的 backendId 列表
    initialSubscriptions?: SubscriptionInfo[]  // 持久化的订阅列表
    onSelectionChange?: (ids: string[]) => void
    onSubscriptionsChange?: (subs: SubscriptionInfo[]) => void  // 订阅列表变化回调
    onCleanupIds?: (validIds: string[]) => void  // 垃圾清理回调
}

// ============ API 辅助函数 ============

function getAuthToken(): string | null {
    try {
        return localStorage.getItem('authToken')
    } catch {
        console.warn('[88tools] 无法获取 authToken')
        return null
    }
}

async function fetchSubscriptionsFromApi(): Promise<SubscriptionInfo[] | null> {
    const token = getAuthToken()
    if (!token) {
        console.warn('[88tools] 未找到 authToken，将降级到 DOM 解析')
        return null
    }

    try {
        const response = await fetch('/admin-api/cc-admin/system/subscription/my', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            }
        })

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`)
        }

        const result: ApiResponse = await response.json()

        if (!result.ok || result.code !== 0 || !Array.isArray(result.data)) {
            throw new Error('API 响应格式异常')
        }

        return result.data
            .filter(sub => sub.isActive && sub.resetTimes > 0) // 只显示活跃且可重置的订阅
            .map(mapApiToSubscriptionInfo)
    } catch (error) {
        console.error('[88tools] API 获取订阅失败:', error)
        return null
    }
}

function mapApiToSubscriptionInfo(api: ApiSubscription): SubscriptionInfo {
    // 解析冷却时间
    let nextResetDate: Date | null = null
    let isOnCooldown = false
    let cooldownText = ''

    if (api.nextResetAvailableAt) {
        // 将 "2026-01-07 05:17:45" 转换为 Date
        nextResetDate = new Date(api.nextResetAvailableAt.replace(' ', 'T'))
        isOnCooldown = nextResetDate > new Date()
        if (isOnCooldown) {
            cooldownText = formatCooldownText(nextResetDate)
        }
    }

    // 计算额度百分比和显示文本
    const creditLimit = api.subscriptionPlan?.creditLimit || 0
    const currentCredits = api.currentCredits || 0
    const balancePercent = creditLimit > 0
        ? Math.round((currentCredits / creditLimit) * 100)
        : 0
    const balance = creditLimit > 0
        ? `$${currentCredits.toFixed(2)} / $${creditLimit.toFixed(2)}`
        : ''

    // 判断是否可重置：API 说可以 且 有剩余次数 且 不在冷却
    const canReset = api.canResetNow && api.resetTimes > 0 && !isOnCooldown

    // 有重置按钮的条件：有剩余次数
    const hasResetButton = api.resetTimes > 0

    const backendId = String(api.id)

    return {
        id: backendId,  // 使用 backendId 作为唯一标识
        backendId,
        name: api.subscriptionPlanName || `Subscription #${api.id}`,
        type: api.billingCycleDesc || '未知',
        balance,
        balancePercent,
        canReset,
        isOnCooldown,
        cooldownText,
        resetCount: api.resetTimes,
        nextResetAvailableAt: nextResetDate,
        status: api.subscriptionStatus,
        daysRemaining: api.remainingDays,
        hasResetButton,
    }
}

function formatCooldownText(endTime: Date): string {
    const now = new Date()
    const diffMs = endTime.getTime() - now.getTime()
    const diffMins = Math.ceil(diffMs / 60000)

    if (diffMins <= 0) return '可重置'
    if (diffMins < 60) return `冷却 ${diffMins} 分钟`

    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `冷却 ${hours}:${mins.toString().padStart(2, '0')}`
}

// ============ Hook 主体 ============

export function useSubscriptions(options: UseSubscriptionsOptions): UseSubscriptionsResult {
    const {
        initialSelectedIds = [],
        initialSubscriptions = [],
        onSelectionChange,
        onSubscriptionsChange,
        onCleanupIds
    } = options

    const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>(initialSubscriptions)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds))
    const [isScanning, setIsScanning] = useState(false)
    const [lastScanTime, setLastScanTime] = useState<number | null>(null)

    // 用于防止重复扫描
    const scanLockRef = useRef(false)

    // 扫描订阅信息 (仅 API) - 只在用户手动调用时执行
    const scan = useCallback(async () => {
        if (scanLockRef.current) return

        scanLockRef.current = true
        setIsScanning(true)

        try {
            const results = await fetchSubscriptionsFromApi()

            if (!results) {
                console.warn('[88tools] API 获取订阅失败')
                return
            }

            console.log('[88tools] API 获取订阅成功:', results.length, '条')

            setSubscriptions(results)
            setLastScanTime(Date.now())

            // 持久化订阅列表
            onSubscriptionsChange?.(results)

            // 垃圾清理：移除不存在的订阅 ID
            const validIds = new Set(results.map(s => s.id))
            setSelectedIds(prev => {
                const cleaned = new Set<string>()
                let hasInvalid = false

                prev.forEach(id => {
                    if (validIds.has(id)) {
                        cleaned.add(id)
                    } else {
                        hasInvalid = true
                        console.log('[88tools] 清理无效订阅 ID:', id)
                    }
                })

                // 如果有清理，通知外部持久化
                if (hasInvalid) {
                    const cleanedArray = Array.from(cleaned)
                    onSelectionChange?.(cleanedArray)
                    onCleanupIds?.(cleanedArray)
                }

                return cleaned
            })

        } catch (error) {
            console.error('[88tools] 订阅扫描失败:', error)
        } finally {
            setIsScanning(false)
            scanLockRef.current = false
        }
    }, [onSelectionChange, onSubscriptionsChange, onCleanupIds])

    // 切换选择
    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            onSelectionChange?.(Array.from(next))
            return next
        })
    }, [onSelectionChange])

    // 全选
    const selectAll = useCallback(() => {
        const allIds = subscriptions.filter(s => s.hasResetButton).map(s => s.id)
        setSelectedIds(new Set(allIds))
        onSelectionChange?.(allIds)
    }, [subscriptions, onSelectionChange])

    // 取消全选
    const deselectAll = useCallback(() => {
        setSelectedIds(new Set())
        onSelectionChange?.([])
    }, [onSelectionChange])

    // 计算可重置数量
    const resettableCount = subscriptions.filter(s => s.canReset).length
    const selectedResettableCount = subscriptions.filter(
        s => s.canReset && selectedIds.has(s.id)
    ).length

    return {
        subscriptions,
        selectedIds,
        toggleSelection,
        selectAll,
        deselectAll,
        resettableCount,
        selectedResettableCount,
        scan,
        isScanning,
        lastScanTime,
    }
}
