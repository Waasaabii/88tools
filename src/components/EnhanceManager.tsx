import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GM_getValue, GM_setValue, GM_deleteValue } from 'vite-plugin-monkey/dist/client'
import { ControlPanel } from './ControlPanel'
import { HeaderIcon } from './HeaderIcon'
import { ServiceStatusCard } from './ServiceStatusCard'
import { useRouteWatch } from '../hooks/useRouteWatch'
import { useServiceStatus } from '../hooks/useServiceStatus'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useScheduledReset } from '../hooks/useScheduledReset'
import { useSubscriptions, type SubscriptionInfo } from '../hooks/useSubscriptions'

// 配置存储键名 - 参考 linuxdo.js 的分离键名模式
const CONFIG_KEYS = {
    // 版本前缀，升级时递增
    PREFIX: '88tools_v1_',
    // 各配置项
    AUTO_REFRESH_ENABLED: '88tools_v1_auto_refresh_enabled',
    AUTO_REFRESH_INTERVAL: '88tools_v1_auto_refresh_interval',
    SCHEDULED_RESET_ENABLED: '88tools_v1_scheduled_reset_enabled',
    SCHEDULED_RESET_TIMES: '88tools_v1_scheduled_reset_times',
    SELECTED_SUBSCRIPTION_IDS: '88tools_v1_selected_subscription_ids',
    SUBSCRIPTIONS: '88tools_v1_subscriptions',  // 订阅列表持久化
    PANEL_MINIMIZED: '88tools_v1_panel_minimized',
    PANEL_POSITION: '88tools_v1_panel_position',
    SHOW_SERVICE_STATUS: '88tools_v1_show_service_status',
    LOGS: '88tools_v1_logs',
}

// localStorage key 用于跨页面重置标记
const PENDING_RESET_KEY = '88tools_v1_pending_reset'

// 日志配置
const LOG_CONFIG = {
    MAX_ENTRIES: 100,      // 最大条数
    MAX_BYTES: 50 * 1024,  // 最大字节数 50KB（GM_setValue 通常限制较宽松，但保守起见）
    PERSIST_DEBOUNCE: 1000, // 持久化防抖延迟（毫秒）
}

// 加载持久化的日志
function loadLogs(): string[] {
    try {
        const saved = GM_getValue(CONFIG_KEYS.LOGS, []) as string[]
        return Array.isArray(saved) ? saved : []
    } catch {
        return []
    }
}

// 裁剪日志以满足大小限制
function trimLogs(logs: string[]): string[] {
    let result = logs.slice(-LOG_CONFIG.MAX_ENTRIES)

    // 检查字节大小
    let totalBytes = JSON.stringify(result).length
    while (result.length > 0 && totalBytes > LOG_CONFIG.MAX_BYTES) {
        result = result.slice(1) // 移除最旧的
        totalBytes = JSON.stringify(result).length
    }

    return result
}

// 配置类型
export interface EnhanceConfig {
    autoRefreshEnabled: boolean
    autoRefreshInterval: number // 秒
    scheduledResetEnabled: boolean
    scheduledResetTimes: string[] // HH:mm 格式的时间数组
    panelMinimized: boolean
    showServiceStatus: boolean
    panelPosition: { x: number; y: number } | null
    panelSize: { width: number; height: number } | null
}

// 默认配置
const DEFAULT_CONFIG: EnhanceConfig = {
    autoRefreshEnabled: false,
    autoRefreshInterval: 30,
    scheduledResetEnabled: false,
    scheduledResetTimes: ['00:00', '12:00'],
    panelMinimized: true, // 默认隐藏
    showServiceStatus: true,
    panelPosition: null, // null 表示使用默认位置
    panelSize: null, // null 表示默认大小
}

// 从存储加载配置
function loadConfig(): EnhanceConfig {
    return {
        autoRefreshEnabled: GM_getValue(CONFIG_KEYS.AUTO_REFRESH_ENABLED, DEFAULT_CONFIG.autoRefreshEnabled) as boolean,
        autoRefreshInterval: GM_getValue(CONFIG_KEYS.AUTO_REFRESH_INTERVAL, DEFAULT_CONFIG.autoRefreshInterval) as number,
        scheduledResetEnabled: GM_getValue(CONFIG_KEYS.SCHEDULED_RESET_ENABLED, DEFAULT_CONFIG.scheduledResetEnabled) as boolean,
        scheduledResetTimes: GM_getValue(CONFIG_KEYS.SCHEDULED_RESET_TIMES, DEFAULT_CONFIG.scheduledResetTimes) as string[],
        panelMinimized: GM_getValue(CONFIG_KEYS.PANEL_MINIMIZED, DEFAULT_CONFIG.panelMinimized) as boolean,
        showServiceStatus: GM_getValue(CONFIG_KEYS.SHOW_SERVICE_STATUS, DEFAULT_CONFIG.showServiceStatus) as boolean,
        panelPosition: GM_getValue(CONFIG_KEYS.PANEL_POSITION, DEFAULT_CONFIG.panelPosition) as { x: number; y: number } | null,
        panelSize: GM_getValue('88tools_v1_panel_size', DEFAULT_CONFIG.panelSize) as { width: number; height: number } | null,
    }
}

// 保存单个配置项
function saveConfigItem<K extends keyof EnhanceConfig>(key: K, value: EnhanceConfig[K]): void {
    const keyMap: Record<keyof EnhanceConfig, string> = {
        autoRefreshEnabled: CONFIG_KEYS.AUTO_REFRESH_ENABLED,
        autoRefreshInterval: CONFIG_KEYS.AUTO_REFRESH_INTERVAL,
        scheduledResetEnabled: CONFIG_KEYS.SCHEDULED_RESET_ENABLED,
        scheduledResetTimes: CONFIG_KEYS.SCHEDULED_RESET_TIMES,
        panelMinimized: CONFIG_KEYS.PANEL_MINIMIZED,
        showServiceStatus: CONFIG_KEYS.SHOW_SERVICE_STATUS,
        panelPosition: CONFIG_KEYS.PANEL_POSITION,
        panelSize: '88tools_v1_panel_size',
    }
    GM_setValue(keyMap[key], value)
}

// 自动刷新间隔模板
export const REFRESH_INTERVAL_TEMPLATES = [
    { label: '15秒', value: 15 },
    { label: '30秒', value: 30 },
    { label: '1分钟', value: 60 },
    { label: '2分钟', value: 120 },
    { label: '5分钟', value: 300 },
]

export function EnhanceManager() {
    const [config, setConfig] = useState<EnhanceConfig>(loadConfig)
    const [statusContainer, setStatusContainer] = useState<HTMLElement | null>(null)
    const [logs, setLogs] = useState<string[]>(loadLogs)

    // 持久化防抖 ref
    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const logsRef = useRef(logs)
    logsRef.current = logs

    // 持久化日志（防抖）
    const persistLogs = useCallback((newLogs: string[]) => {
        if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current)
        }
        persistTimerRef.current = setTimeout(() => {
            try {
                GM_setValue(CONFIG_KEYS.LOGS, newLogs)
            } catch (e) {
                console.warn('[88tools] 日志持久化失败:', e)
            }
        }, LOG_CONFIG.PERSIST_DEBOUNCE)
    }, [])

    // [DEBUG] 拦截 API 请求以分析重置逻辑
    useEffect(() => {
        const originalFetch = window.fetch
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

            // 排除日志上报、socket等无关请求，只关注可能的业务操作
            if (init && (init.method === 'POST' || init.method === 'DELETE' || init.method === 'PUT') && !url.includes('socket')) {
                console.log('%c[API Capture] 捕获到潜在的业务请求:', 'color: #ef4444; font-weight: bold; font-size: 14px')
                console.log('URL:', url)
                console.log('Method:', init.method)
                console.log('Headers:', init.headers)
                console.log('Body:', init.body)

                // 尝试解析 Body
                try {
                    if (typeof init.body === 'string') {
                        console.log('Parsed Body:', JSON.parse(init.body))
                    }
                } catch (e) { /* ignore */ }
            }

            return originalFetch(input, init)
        }

        return () => {
            window.fetch = originalFetch
        }
    }, [])

    // 添加日志（带时间戳）
    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const logEntry = `[${timestamp}] ${msg}`
        console.log(`[88tools] ${logEntry}`)

        setLogs(prev => {
            const newLogs = trimLogs([...prev, logEntry])
            persistLogs(newLogs)
            return newLogs
        })
    }, [persistLogs])

    // 清除日志
    const clearLogs = useCallback(() => {
        setLogs([])
        try {
            GM_setValue(CONFIG_KEYS.LOGS, [])
        } catch (e) {
            console.warn('[88tools] 清除日志失败:', e)
        }
    }, [])

    // 路由监听
    const { currentPath, isSubscriptionPage } = useRouteWatch()

    // 订阅扫描和选择
    const initialSelectedIds = (GM_getValue(CONFIG_KEYS.SELECTED_SUBSCRIPTION_IDS, []) as string[])
    const initialSubscriptions = (GM_getValue(CONFIG_KEYS.SUBSCRIPTIONS, []) as SubscriptionInfo[])
    const {
        subscriptions,
        selectedIds: selectedSubscriptionIds,
        toggleSelection: toggleSubscription,
        selectAll: selectAllSubscriptions,
        deselectAll: deselectAllSubscriptions,
        scan: scanSubscriptions,
        isScanning,
    } = useSubscriptions({
        initialSelectedIds,
        initialSubscriptions,
        onSelectionChange: (ids) => {
            GM_setValue(CONFIG_KEYS.SELECTED_SUBSCRIPTION_IDS, ids)
        },
        onSubscriptionsChange: (subs) => {
            // 持久化订阅列表
            GM_setValue(CONFIG_KEYS.SUBSCRIPTIONS, subs)
            console.log('[88tools] 订阅列表已持久化:', subs.length, '条')
        },
        onCleanupIds: (validIds) => {
            // 垃圾清理：更新持久化存储
            GM_setValue(CONFIG_KEYS.SELECTED_SUBSCRIPTION_IDS, validIds)
            console.log('[88tools] 已清理无效订阅 ID，剩余:', validIds.length)
        },
    })

    // 执行重置操作的核心函数 (API Version)
    // force: true 表示强制重置（忽略冷却状态）
    const executeResetOperation = useCallback(async (force: boolean = false) => {
        addLog(`========== ${force ? '手动' : '定时'}重置开始 (API模式) ==========`)

        if (selectedSubscriptionIds.size === 0) {
            addLog('警告: 未选择任何订阅，跳过重置')
            addLog('========== 重置结束 ==========')
            return
        }

        // 1. 刷新订阅数据
        addLog('步骤 1: 刷新订阅数据...')
        await scanSubscriptions()

        // 等待扫描完成
        await new Promise(r => setTimeout(r, 1000))

        let resetCount = 0
        let skipCount = 0
        let errorCount = 0

        for (const sub of subscriptions) {
            if (!selectedSubscriptionIds.has(sub.id)) continue

            // 非强制模式下检查是否可重置
            if (!force && !sub.canReset) {
                addLog(`跳过 [${sub.name}]: ${sub.isOnCooldown ? '冷却中' : '不可重置'}`)
                skipCount++
                continue
            }

            if (!sub.backendId) {
                addLog(`错误 [${sub.name}]: 未找到后端 ID，无法通过 API 重置`)
                errorCount++
                continue
            }

            try {
                addLog(`重置 [${sub.name}]: 发送请求...${force && sub.isOnCooldown ? ' (强制)' : ''}`)

                // 获取 token
                const token = localStorage.getItem('authToken')
                const headers: HeadersInit = {
                    'Content-Type': 'application/json'
                }
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`
                }

                const response = await fetch(`/admin-api/cc-admin/system/subscription/my/reset-credits/${sub.backendId}`, {
                    method: 'POST',
                    headers
                })

                if (response.ok) {
                    addLog(`重置 [${sub.name}]: ✓ 成功`)
                    resetCount++
                } else {
                    const text = await response.text().catch(() => '')
                    addLog(`重置 [${sub.name}]: ✗ 失败 (Status: ${response.status}) ${text}`)
                    errorCount++
                }

                // 间隔一下，避免请求过快
                await new Promise(r => setTimeout(r, 500))

            } catch (error) {
                addLog(`重置 [${sub.name}]: ✗ 网络错误`)
                console.error(error)
                errorCount++
            }
        }

        addLog('步骤 2: 刷新订阅数据...')
        await scanSubscriptions()

        addLog(`========== 重置完成 ==========`)
        addLog(`✓ 成功: ${resetCount}, ○ 跳过: ${skipCount}, ✗ 失败: ${errorCount}`)
    }, [addLog, selectedSubscriptionIds, subscriptions, scanSubscriptions])

    // 手动强制重置
    const [isResetting, setIsResetting] = useState(false)
    const handleForceReset = useCallback(async () => {
        if (isResetting) return
        setIsResetting(true)
        try {
            await executeResetOperation(true)
        } finally {
            setIsResetting(false)
        }
    }, [executeResetOperation, isResetting])

    // 清空所有缓存
    const handleClearCache = useCallback(() => {
        // 删除所有存储的数据
        Object.values(CONFIG_KEYS).forEach(key => {
            if (typeof key === 'string' && key.startsWith('88tools_')) {
                GM_deleteValue(key)
            }
        })
        // 删除 localStorage 中的 pending reset 标记
        try {
            localStorage.removeItem(PENDING_RESET_KEY)
        } catch { }
        console.log('[88tools] 缓存已清空')
        // 刷新页面
        window.location.reload()
    }, [])


    // 服务状态 - 只在订阅页且开启时运行
    const { data: statusData, isLoading: statusLoading, error: statusError, refresh: refreshStatus, lastUpdated } = useServiceStatus(
        isSubscriptionPage && config.showServiceStatus
    )

    // 自动刷新 - 直接点击页面按钮
    const { nextRefreshTime } = useAutoRefresh({
        enabled: config.autoRefreshEnabled && isSubscriptionPage,
        interval: config.autoRefreshInterval,
        onRefresh: () => {
            // 点击页面上的刷新按钮（包含 lucide-refresh-cw 图标的按钮）
            const refreshBtn = document.querySelector('button:has(.lucide-refresh-cw)') as HTMLButtonElement
            if (refreshBtn) {
                refreshBtn.click()
                addLog('自动刷新: 已刷新页面')
            } else {
                // 回退：刷新服务状态
                refreshStatus()
                addLog('自动刷新: 已刷新服务状态')
            }
        }
    })

    // 定时重置 - 先跳转到订阅页，再刷新，再重置
    const { nextResetTime, status: resetStatus } = useScheduledReset({
        enabled: config.scheduledResetEnabled,
        times: config.scheduledResetTimes,
        onReset: () => {
            // 检查是否在订阅页面，如果不在则设置标记并跳转
            const currentUrl = window.location.pathname
            if (!currentUrl.includes('my-subscription') && !currentUrl.includes('subscription')) {
                addLog('当前不在订阅页面，设置标记并跳转...')
                localStorage.setItem(PENDING_RESET_KEY, Date.now().toString())
                window.location.href = '/my-subscription'
                return // 跳转后脚本会重新加载，在 useEffect 中检查标记并执行
            }

            // 已在订阅页面，直接执行重置
            executeResetOperation()
        }
    })

    // 检查是否有 pending reset（跨页面跳转后执行）
    useEffect(() => {
        const pendingReset = localStorage.getItem(PENDING_RESET_KEY)
        if (!pendingReset) return

        // 检查标记是否过期（5分钟内有效）
        const timestamp = parseInt(pendingReset, 10)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            localStorage.removeItem(PENDING_RESET_KEY)
            console.log('[88tools] Pending reset 已过期，清除标记')
            return
        }

        // 检查是否在订阅页面
        if (!isSubscriptionPage) {
            console.log('[88tools] Pending reset 存在但不在订阅页面，等待路由切换...')
            return
        }

        // 清除标记并执行重置
        localStorage.removeItem(PENDING_RESET_KEY)
        addLog('检测到 pending reset，等待页面加载后执行...')

        // 延迟执行，等待页面渲染完成
        const timer = setTimeout(() => {
            executeResetOperation()
        }, 2000)

        return () => clearTimeout(timer)
    }, [isSubscriptionPage, executeResetOperation, addLog])

    // 更新配置 - 分离保存每个变更的配置项
    const updateConfig = useCallback((updates: Partial<EnhanceConfig>) => {
        setConfig(prev => {
            const newConfig = { ...prev, ...updates }
            // 分离保存每个变更的配置项
            for (const key of Object.keys(updates) as Array<keyof EnhanceConfig>) {
                saveConfigItem(key, newConfig[key])
                console.log(`[88tools] 保存配置: ${key} =`, newConfig[key])
            }
            return newConfig
        })
    }, [])

    // 创建服务状态注入容器
    useEffect(() => {
        if (!isSubscriptionPage || !config.showServiceStatus) {
            const existing = document.getElementById('enhance-service-status-container')
            if (existing) existing.remove()
            setStatusContainer(null)
            return
        }

        // 防止重复创建
        let isMounted = true

        const findInsertPoint = () => {
            const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
            return cards.find(card =>
                card.textContent?.includes('当前活跃订阅') ||
                card.textContent?.includes('Current Active')
            )
        }

        const insertContainer = () => {
            if (!isMounted) return

            // 已存在则直接使用
            const existing = document.getElementById('enhance-service-status-container')
            if (existing) {
                setStatusContainer(existing)
                return true  // 返回 true 表示已成功
            }

            const subscriptionCard = findInsertPoint()
            if (subscriptionCard?.parentElement) {
                const container = document.createElement('div')
                container.id = 'enhance-service-status-container'
                container.style.marginBottom = '24px'
                subscriptionCard.parentElement.insertBefore(container, subscriptionCard)
                setStatusContainer(container)
                console.log('[88tools] 服务状态容器已创建')
                return true
            }
            return false
        }

        // 只尝试一次，成功就不再重试
        const timer = setTimeout(() => {
            if (!insertContainer()) {
                // 首次失败，启动轮询
                const interval = setInterval(() => {
                    if (insertContainer()) {
                        clearInterval(interval)
                    }
                }, 2000)
                // 10秒后停止轮询
                setTimeout(() => clearInterval(interval), 10000)
            }
        }, 500)

        return () => {
            isMounted = false
            clearTimeout(timer)
        }
    }, [isSubscriptionPage, config.showServiceStatus])

    // 切换面板显示/隐藏 - 使用函数式更新避免闭包陈旧问题
    const togglePanel = useCallback(() => {
        console.log('[88tools] togglePanel called')
        setConfig(prev => {
            const newMinimized = !prev.panelMinimized
            saveConfigItem('panelMinimized', newMinimized)
            console.log('[88tools] panelMinimized:', prev.panelMinimized, '->', newMinimized)
            return { ...prev, panelMinimized: newMinimized }
        })
    }, [])

    return (
        <>
            <HeaderIcon
                onClick={togglePanel}
                isActive={!config.panelMinimized || config.autoRefreshEnabled || config.scheduledResetEnabled}
            />
            <ControlPanel
                config={config}
                onConfigChange={updateConfig}
                currentPath={currentPath}
                nextRefreshTime={nextRefreshTime}
                nextResetTime={nextResetTime}
                resetStatus={resetStatus}
                resetLogs={logs}
                onClearLogs={clearLogs}
                // 订阅相关
                subscriptions={subscriptions}
                selectedSubscriptionIds={selectedSubscriptionIds}
                onToggleSubscription={toggleSubscription}
                onSelectAllSubscriptions={selectAllSubscriptions}
                onDeselectAllSubscriptions={deselectAllSubscriptions}
                onScanSubscriptions={scanSubscriptions}
                isScanning={isScanning}
                isSubscriptionPage={isSubscriptionPage}
                // 手动重置
                onForceReset={handleForceReset}
                isResetting={isResetting}
                // 清空缓存
                onClearCache={handleClearCache}
            />
            {/* 使用 Portal 将服务状态卡片注入到订阅页 */}
            {statusContainer && config.showServiceStatus && createPortal(
                <ServiceStatusCard
                    data={statusData}
                    isLoading={statusLoading}
                    error={statusError}
                    onRefresh={refreshStatus}
                    lastUpdated={lastUpdated}
                />,
                statusContainer
            )}
        </>
    )
}
