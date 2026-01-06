import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { GM_getValue, GM_setValue } from 'vite-plugin-monkey/dist/client'
import { ControlPanel } from './ControlPanel'
import { HeaderIcon } from './HeaderIcon'
import { ServiceStatusCard } from './ServiceStatusCard'
import { useRouteWatch } from '../hooks/useRouteWatch'
import { useServiceStatus } from '../hooks/useServiceStatus'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useScheduledReset } from '../hooks/useScheduledReset'

// 配置存储键名 - 参考 linuxdo.js 的分离键名模式
const CONFIG_KEYS = {
    // 版本前缀，升级时递增
    PREFIX: '88tools_v1_',
    // 各配置项
    AUTO_REFRESH_ENABLED: '88tools_v1_auto_refresh_enabled',
    AUTO_REFRESH_INTERVAL: '88tools_v1_auto_refresh_interval',
    SCHEDULED_RESET_ENABLED: '88tools_v1_scheduled_reset_enabled',
    SCHEDULED_RESET_TIMES: '88tools_v1_scheduled_reset_times',
    PANEL_MINIMIZED: '88tools_v1_panel_minimized',
    PANEL_POSITION: '88tools_v1_panel_position',
    SHOW_SERVICE_STATUS: '88tools_v1_show_service_status',
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
    const [resetLogs, setResetLogs] = useState<string[]>([])

    // 添加日志（带时间戳）
    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const logEntry = `[${timestamp}] ${msg}`
        console.log(`[88tools] ${logEntry}`)
        setResetLogs(prev => [...prev.slice(-49), logEntry]) // 最多保留 50 条
    }, [])

    // 清除日志
    const clearLogs = useCallback(() => {
        setResetLogs([])
    }, [])

    // 路由监听
    const { currentPath, isSubscriptionPage } = useRouteWatch()

    // 服务状态
    const { data: statusData, isLoading: statusLoading, error: statusError, refresh: refreshStatus, lastUpdated } = useServiceStatus()

    // 自动刷新 - 直接点击页面按钮
    const { countdown: refreshCountdown, nextRefreshTime } = useAutoRefresh({
        enabled: config.autoRefreshEnabled && isSubscriptionPage,
        interval: config.autoRefreshInterval,
        onRefresh: () => {
            console.log('[88tools] 自动刷新触发')
            // 点击页面上的刷新按钮（包含 lucide-refresh-cw 图标的按钮）
            const refreshBtn = document.querySelector('button:has(.lucide-refresh-cw)') as HTMLButtonElement
            if (refreshBtn) {
                refreshBtn.click()
                console.log('[88tools] 已点击页面刷新按钮')
            } else {
                // 回退：刷新服务状态
                refreshStatus()
                console.log('[88tools] 未找到页面刷新按钮，刷新服务状态')
            }
        }
    })

    // 定时重置 - 先刷新再重置，跳过冷却中的订阅
    const { countdown: resetCountdown, nextResetTime, status: resetStatus } = useScheduledReset({
        enabled: config.scheduledResetEnabled,
        times: config.scheduledResetTimes,
        onReset: async () => {
            addLog('========== 定时重置开始 ==========')

            // 1. 先刷新页面获取最新状态
            addLog('步骤 1: 刷新页面获取最新状态...')
            const refreshBtn = document.querySelector('button:has(.lucide-refresh-cw)') as HTMLButtonElement
            if (refreshBtn) {
                refreshBtn.click()
                await new Promise(r => setTimeout(r, 2000)) // 等待刷新完成
                addLog('页面已刷新')
            }

            // 辅助函数：等待对话框关闭
            const waitForDialogClose = () => new Promise<void>(resolve => {
                const checkInterval = setInterval(() => {
                    const dialog = document.querySelector('[role="dialog"], [data-state="open"]')
                    if (!dialog) {
                        clearInterval(checkInterval)
                        resolve()
                    }
                }, 200)
                setTimeout(() => { clearInterval(checkInterval); resolve() }, 3000)
            })

            // 2. 查找所有订阅卡片和对应的重置按钮
            addLog('步骤 2: 查找可重置的订阅...')
            const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
            let resetCount = 0
            let skipCount = 0

            for (const card of cards) {
                // 获取订阅名称
                const titleEl = card.querySelector('h4, .font-semibold')
                const subscriptionName = titleEl?.textContent?.trim() || '未知订阅'

                // 查找该卡片内的重置按钮
                const buttons = Array.from(card.querySelectorAll('button'))
                const resetBtn = buttons.find(b =>
                    b.getAttribute('data-slot') === 'tooltip-trigger' &&
                    (b.textContent?.includes('冷却') || b.textContent?.includes('重置'))
                ) as HTMLButtonElement | undefined

                if (!resetBtn) continue // 不是订阅卡片

                // 检查是否冷却中（有 disabled 属性）
                if (resetBtn.disabled || resetBtn.textContent?.includes('冷却')) {
                    addLog(`跳过 [${subscriptionName}]: 冷却中`)
                    skipCount++
                    continue
                }

                // 3. 点击重置按钮
                addLog(`重置 [${subscriptionName}]: 点击重置按钮...`)
                resetBtn.click()
                await new Promise(r => setTimeout(r, 800))

                // 4. 查找并点击确认按钮
                const dialogBtns = Array.from(document.querySelectorAll('button'))
                const confirmBtn = dialogBtns.find(b =>
                    b.textContent?.trim() === '重置' &&
                    b.offsetParent !== null &&
                    !b.textContent?.includes('冷却') &&
                    !b.textContent?.includes('额度')
                ) as HTMLButtonElement | undefined

                if (confirmBtn) {
                    confirmBtn.click()
                    addLog(`重置 [${subscriptionName}]: ✓ 成功`)
                    resetCount++

                    // 等待对话框关闭
                    await waitForDialogClose()
                    await new Promise(r => setTimeout(r, 1500)) // 等待 API 完成
                } else {
                    addLog(`重置 [${subscriptionName}]: ✗ 对话框未出现`)
                }
            }

            // 5. 最终刷新
            addLog('步骤 3: 刷新页面...')
            if (refreshBtn) {
                refreshBtn.click()
            }

            addLog(`========== 重置完成 ==========`)
            addLog(`✓ 成功: ${resetCount} 个, ○ 跳过: ${skipCount} 个`)
        }
    })

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
            // 移除已存在的容器
            const existing = document.getElementById('enhance-service-status-container')
            if (existing) existing.remove()
            setStatusContainer(null)
            return
        }

        // 查找"当前活跃订阅"卡片
        const findInsertPoint = () => {
            const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
            const subscriptionCard = cards.find(card =>
                card.textContent?.includes('当前活跃订阅') ||
                card.textContent?.includes('Current Active')
            )
            return subscriptionCard
        }

        const insertContainer = () => {
            // 如果已存在则使用现有容器
            let container = document.getElementById('enhance-service-status-container')
            if (container) {
                setStatusContainer(container)
                return
            }

            const subscriptionCard = findInsertPoint()
            if (subscriptionCard && subscriptionCard.parentElement) {
                container = document.createElement('div')
                container.id = 'enhance-service-status-container'
                container.style.marginBottom = '24px'
                subscriptionCard.parentElement.insertBefore(container, subscriptionCard)
                setStatusContainer(container)
                console.log('[88tools] 服务状态容器已创建')
            } else {
                console.log('[88tools] 未找到"当前活跃订阅"卡片，稍后重试...')
            }
        }

        // 延迟执行，等待 SPA 渲染
        const timer = setTimeout(insertContainer, 1000)

        // 定期检查（SPA 路由切换后可能需要重新注入）
        const interval = setInterval(() => {
            if (!document.getElementById('enhance-service-status-container')) {
                insertContainer()
            }
        }, 2000)

        return () => {
            clearTimeout(timer)
            clearInterval(interval)
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
                refreshCountdown={refreshCountdown}
                nextRefreshTime={nextRefreshTime}
                resetCountdown={resetCountdown}
                nextResetTime={nextResetTime}
                resetStatus={resetStatus}
                resetLogs={resetLogs}
                onClearLogs={clearLogs}
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
