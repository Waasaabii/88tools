import type { EnhanceConfig } from './EnhanceManager'
import { REFRESH_INTERVAL_TEMPLATES } from './EnhanceManager'
import type { SubscriptionInfo } from '../hooks/useSubscriptions'
import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import logoUrl from '../assets/logo.gif'

interface ControlPanelProps {
    config: EnhanceConfig
    onConfigChange: (updates: Partial<EnhanceConfig>) => void
    currentPath: string
    nextRefreshTime: number | null // 时间戳
    nextResetTime: string | null
    remainingMs: number | null      // 剩余毫秒数
    isPreciseMode: boolean          // 是否在精准模式（≤30分钟）
    resetStatus: 'idle' | 'waiting' | 'cooling'
    resetLogs: string[]
    onClearLogs: () => void
    // 订阅相关
    subscriptions: SubscriptionInfo[]
    selectedSubscriptionIds: Set<string>
    onToggleSubscription: (id: string) => void
    onSelectAllSubscriptions: () => void
    onDeselectAllSubscriptions: () => void
    onScanSubscriptions: () => void
    isScanning: boolean
    isSubscriptionPage: boolean
    // 手动重置
    onForceReset?: () => void
    isResetting?: boolean
    // 清空缓存
    onClearCache?: () => void
}

export function ControlPanel({
    config,
    onConfigChange,
    currentPath,
    nextRefreshTime,
    nextResetTime,
    remainingMs,
    isPreciseMode,
    resetStatus,
    resetLogs,
    onClearLogs,
    // 订阅相关
    subscriptions,
    selectedSubscriptionIds,
    onToggleSubscription,
    onSelectAllSubscriptions,
    onDeselectAllSubscriptions,
    onScanSubscriptions,
    isScanning,
    isSubscriptionPage,
    // 手动重置
    onForceReset,
    isResetting,
    // 清空缓存
    onClearCache,
}: ControlPanelProps) {
    const isMinimized = config.panelMinimized
    const panelRef = useRef<HTMLDivElement>(null)

    // Position & Size - 只用于初始化和最终保存
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        return config.panelPosition || { x: window.innerWidth - 360, y: window.innerHeight - 500 }
    })
    const [size, setSize] = useState<{ width: number; height: number }>(() => {
        return config.panelSize || { width: 320, height: 420 }
    })

    // 拖拽状态 ref（不触发重渲染）
    const dragState = useRef<{
        isDragging: boolean
        isResizing: boolean
        startX: number
        startY: number
        startPosX: number
        startPosY: number
        startWidth: number
        startHeight: number
    }>({
        isDragging: false,
        isResizing: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
        startWidth: 0,
        startHeight: 0,
    })

    // --- Drag Logic (直接操作 DOM) ---
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('.resize-handle')) return
        if (!panelRef.current) return

        e.preventDefault()
        const rect = panelRef.current.getBoundingClientRect()
        dragState.current = {
            ...dragState.current,
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startPosX: rect.left,
            startPosY: rect.top,
        }
        panelRef.current.style.transition = 'none'
        panelRef.current.style.cursor = 'grabbing'
    }, [])

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        if (!panelRef.current) return
        e.preventDefault()
        e.stopPropagation()

        dragState.current = {
            ...dragState.current,
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: panelRef.current.offsetWidth,
            startHeight: panelRef.current.offsetHeight,
        }
        panelRef.current.style.transition = 'none'
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const state = dragState.current
            if (!panelRef.current) return

            if (state.isDragging) {
                const dx = e.clientX - state.startX
                const dy = e.clientY - state.startY
                const panelWidth = panelRef.current.offsetWidth
                const panelHeight = panelRef.current.offsetHeight
                // 边界限制：面板完全在屏幕内
                const newX = Math.max(0, Math.min(window.innerWidth - panelWidth, state.startPosX + dx))
                const newY = Math.max(0, Math.min(window.innerHeight - panelHeight, state.startPosY + dy))
                panelRef.current.style.left = `${newX}px`
                panelRef.current.style.top = `${newY}px`
            } else if (state.isResizing) {
                const dx = e.clientX - state.startX
                const dy = e.clientY - state.startY
                const newWidth = Math.max(300, Math.min(600, state.startWidth + dx))
                const newHeight = Math.max(300, Math.min(800, state.startHeight + dy))
                panelRef.current.style.width = `${newWidth}px`
                panelRef.current.style.height = `${newHeight}px`
            }
        }

        const handleMouseUp = () => {
            const state = dragState.current
            if (!panelRef.current) return

            if (state.isDragging) {
                const rect = panelRef.current.getBoundingClientRect()
                const newPos = { x: rect.left, y: rect.top }
                setPosition(newPos)
                onConfigChange({ panelPosition: newPos })
                panelRef.current.style.cursor = 'grab'
            }

            if (state.isResizing) {
                const newSize = {
                    width: panelRef.current.offsetWidth,
                    height: panelRef.current.offsetHeight,
                }
                setSize(newSize)
                onConfigChange({ panelSize: newSize })
            }

            dragState.current.isDragging = false
            dragState.current.isResizing = false
            if (panelRef.current) {
                panelRef.current.style.transition = ''
            }
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [onConfigChange])

    // Click outside behavior
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isMinimized) return
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                const headerIcon = document.getElementById('enhance-header-icon')
                if (headerIcon && headerIcon.contains(e.target as Node)) return
                onConfigChange({ panelMinimized: true })
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMinimized, onConfigChange])

    if (isMinimized) return null

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                zIndex: 2147483647,
            }}
        >
            {/* Header - Glassmorphism Style */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '48px',
                    padding: '0 14px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
                    background: 'rgba(255, 255, 255, 0.25)',
                    cursor: 'grab',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                        src={logoUrl}
                        alt=""
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                    />
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1e293b',
                        letterSpacing: '-0.02em',
                        textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                    }}>
                        88code 助手
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* 清空缓存按钮 */}
                    <button
                        onClick={() => {
                            if (confirm('确定要清空所有缓存数据吗？页面将会刷新。')) {
                                onClearCache?.()
                            }
                        }}
                        style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                        title="清空所有缓存数据"
                    >
                        清缓存
                    </button>
                    {/* 最小化按钮 */}
                    <button
                        onClick={() => onConfigChange({ panelMinimized: true })}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            border: 'none',
                            background: 'rgba(0, 0, 0, 0.06)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#475569',
                            transition: 'all 150ms',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.12)'
                            e.currentTarget.style.color = '#1e293b'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
                            e.currentTarget.style.color = '#475569'
                        }}
                        title="最小化"
                    >
                        <IconX style={{ width: '14px', height: '14px' }} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.15)',
            }}>
                <ControlPanelContent
                    config={config}
                    onConfigChange={onConfigChange}
                    currentPath={currentPath}
                    nextRefreshTime={nextRefreshTime}
                    nextResetTime={nextResetTime}
                    remainingMs={remainingMs}
                    isPreciseMode={isPreciseMode}
                    resetStatus={resetStatus}
                    resetLogs={resetLogs}
                    onClearLogs={onClearLogs}
                    subscriptions={subscriptions}
                    selectedSubscriptionIds={selectedSubscriptionIds}
                    onToggleSubscription={onToggleSubscription}
                    onSelectAllSubscriptions={onSelectAllSubscriptions}
                    onDeselectAllSubscriptions={onDeselectAllSubscriptions}
                    onScanSubscriptions={onScanSubscriptions}
                    isScanning={isScanning}
                    isSubscriptionPage={isSubscriptionPage}
                    onForceReset={onForceReset}
                    isResetting={isResetting}
                    onClearCache={onClearCache}
                />
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={handleResizeMouseDown}
                className="resize-handle absolute bottom-0 right-0 p-1 cursor-nwse-resize text-muted-foreground/40 hover:text-primary transition-colors z-50"
            >
                <svg viewBox="0 0 6 6" className="size-2.5 fill-current">
                    <path d="M6 6L6 2L2 6Z" />
                </svg>
            </div>

            {/* Injected Styles - Fallback for missing Tailwind classes */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                
                /* Ensure visibility regardless of host CSS */
                .enhance-panel-border { border-color: #cbd5e1 !important; } /* slate-300 */
                .dark .enhance-panel-border { border-color: #475569 !important; } /* slate-600 */
                
                .enhance-header-border { border-bottom-color: #e2e8f0 !important; } /* slate-200 */
                .dark .enhance-header-border { border-bottom-color: #334155 !important; } /* slate-700 */

                /* Switch Styles */
                .enhance-switch {
                    transition: background-color 0.2s ease-in-out;
                }
                .enhance-switch-thumb {
                    transition: transform 0.2s ease-in-out;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                
                .enhance-tab-slider { 
                    background-color: #ffffff !important; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                }
                .dark .enhance-tab-slider { 
                    background-color: #334155 !important; /* slate-700 */
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2) !important;
                }
                
                .enhance-tab-text-active { color: #0f172a !important; font-weight: 600 !important; } /* slate-900 */
                .dark .enhance-tab-text-active { color: #f8fafc !important; } /* slate-50 */
                
                .enhance-tab-text-inactive { color: #64748b !important; } /* slate-500 */
                .dark .enhance-tab-text-inactive { color: #94a3b8 !important; } /* slate-400 */
                .enhance-tab-text-inactive:hover { color: #475569 !important; } /* slate-600 */
                .dark .enhance-tab-text-inactive:hover { color: #cbd5e1 !important; } /* slate-300 */
                
                .enhance-switch-unchecked { background-color: #94a3b8 !important; } /* slate-400 */
                .dark .enhance-switch-unchecked { background-color: #475569 !important; } /* slate-600 */
                
                /* Use site's primary color variable */
                .enhance-switch-checked { 
                    background-color: var(--primary, #0f172a) !important; 
                } 
                .dark .enhance-switch-checked {
                    background-color: var(--primary, #f8fafc) !important;
                }
            `}</style>
        </div>
    )
}

const ControlPanelContent = memo(function ControlPanelContent(props: ControlPanelProps) {
    const [activeTab, setActiveTab] = useState<'settings' | 'reset' | 'logs'>('settings')

    // 计算滑块位置
    const getSliderTransform = () => {
        switch (activeTab) {
            case 'settings': return 'translateX(0)'
            case 'reset': return 'translateX(100%)'
            case 'logs': return 'translateX(200%)'
        }
    }

    // 可重置订阅数量
    const resettableCount = props.subscriptions.filter(s => s.canReset).length

    // 格式化倒计时
    const formatCountdown = (ms: number, isPrecise: boolean): string => {
        if (ms <= 0) return '0:00'
        const totalSeconds = Math.floor(ms / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (isPrecise) {
            if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            return `${minutes}:${seconds.toString().padStart(2, '0')}`
        } else {
            if (hours > 0) return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`
            return `${minutes}m`
        }
    }

    // 自动刷新倒计时（设置 tab）- 实时更新
    const [refreshCountdown, setRefreshCountdown] = useState<string | null>(null)
    useEffect(() => {
        if (!props.config.autoRefreshEnabled || !props.nextRefreshTime) {
            setRefreshCountdown(null)
            return
        }

        const calculateCountdown = () => {
            const remaining = props.nextRefreshTime! - Date.now()
            if (remaining <= 0) return null
            return `${Math.floor(remaining / 1000)}s`
        }

        setRefreshCountdown(calculateCountdown())
        const interval = setInterval(() => {
            setRefreshCountdown(calculateCountdown())
        }, 1000)

        return () => clearInterval(interval)
    }, [props.config.autoRefreshEnabled, props.nextRefreshTime])

    // 订阅重置倒计时（重置 tab）
    const resetCountdown = useMemo(() => {
        if (!props.config.scheduledResetEnabled || props.remainingMs === null) return null
        if (props.resetStatus === 'cooling') return '冷却'
        return formatCountdown(props.remainingMs, props.isPreciseMode)
    }, [props.config.scheduledResetEnabled, props.remainingMs, props.isPreciseMode, props.resetStatus])

    return (
        <div className="flex flex-col h-full">
            {/* Tab Switcher - Capsule Style (3 Tabs) */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #e2e8f0)', userSelect: 'none' }}>
                <div
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        height: '36px',
                        padding: '4px',
                        borderRadius: '9999px',
                        backgroundColor: '#f1f5f9',
                        overflow: 'hidden',
                    }}
                >
                    {/* Sliding Capsule Background - 1/3 width for 3 tabs */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '4px',
                            bottom: '4px',
                            left: '4px',
                            width: 'calc(33.333% - 2.67px)',
                            borderRadius: '9999px',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
                            transition: 'transform 200ms ease-in-out',
                            transform: getSliderTransform(),
                        }}
                    />

                    <TabButton
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                        icon={<IconSettings style={{ width: '14px', height: '14px' }} />}
                        label="设置"
                        countdown={refreshCountdown}
                    />
                    <TabButton
                        active={activeTab === 'reset'}
                        onClick={() => setActiveTab('reset')}
                        icon={<IconRefreshCw style={{ width: '14px', height: '14px' }} />}
                        label="重置"
                        countdown={resetCountdown}
                        isUrgent={props.isPreciseMode}
                        badge={!resetCountdown && resettableCount > 0 ? resettableCount : undefined}
                    />
                    <TabButton
                        active={activeTab === 'logs'}
                        onClick={() => setActiveTab('logs')}
                        icon={<IconFileText style={{ width: '14px', height: '14px' }} />}
                        label="日志"
                        badge={props.resetLogs.length > 0 ? props.resetLogs.length : undefined}
                    />
                </div>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'settings' && <SettingsPanel {...props} />}
                {activeTab === 'reset' && <ResetPanel {...props} />}
                {activeTab === 'logs' && <LogsPanel logs={props.resetLogs} onClear={props.onClearLogs} />}
            </div>
        </div>
    )
})


function SettingsPanel({
    config, onConfigChange, currentPath,
}: ControlPanelProps) {
    return (
        <div className="divide-y divide-border/40">
            {/* Section: Status */}
            <div className="py-3">
                <div className="px-4 pb-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">当前页面</div>
                </div>
                <div className="px-4 py-1.5 flex items-center justify-between">
                    <span className="text-sm text-foreground">{getPageName(currentPath)}</span>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/50">{currentPath || '/'}</span>
                </div>
            </div>

            {/* Section: Automation */}
            <div className="py-3">
                <div className="px-4 pb-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">功能设置</div>
                </div>

                <SettingRow
                    label="状态指示器"
                    description="在页面插入首页服务状态指示器"
                    control={
                        <Switch
                            checked={config.showServiceStatus ?? true}
                            onChange={(c) => onConfigChange({ showServiceStatus: c })}
                        />
                    }
                />

                <SettingRow
                    label="自动刷新"
                    description={config.autoRefreshEnabled ? '已启用' : '未启用'}
                    control={
                        <div className="flex items-center gap-2">
                            {config.autoRefreshEnabled && (
                                <select
                                    className="h-6 text-xs bg-muted border border-border/50 rounded px-1.5 focus:ring-1 focus:ring-primary/20 cursor-pointer outline-none transition-all"
                                    value={config.autoRefreshInterval}
                                    onChange={(e) => onConfigChange({ autoRefreshInterval: Number(e.target.value) })}
                                >
                                    {REFRESH_INTERVAL_TEMPLATES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            )}
                            <Switch
                                checked={config.autoRefreshEnabled}
                                onChange={(c) => onConfigChange({ autoRefreshEnabled: c })}
                            />
                        </div>
                    }
                />
            </div>
        </div>
    )
}

// 重置面板 - 订阅选择和定时重置设置
function ResetPanel({
    config, onConfigChange,
    remainingMs, isPreciseMode, resetStatus,
    subscriptions, selectedSubscriptionIds,
    onToggleSubscription, onSelectAllSubscriptions, onDeselectAllSubscriptions,
    onScanSubscriptions, isScanning,
    onForceReset, isResetting,
}: ControlPanelProps) {
    // 有重置按钮的订阅数量（包括冷却中的）
    const selectableCount = subscriptions.filter(s => s.hasResetButton !== false).length
    const selectedCount = subscriptions.filter(s => selectedSubscriptionIds.has(s.id)).length
    // 选中的可立即重置的数量
    const selectedReadyCount = subscriptions.filter(s => s.canReset && selectedSubscriptionIds.has(s.id)).length

    return (
        <div className="divide-y divide-border/40">
            {/* Section: 订阅选择 */}
            <div className="py-3">
                <div className="px-4 pb-2 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        选择要重置的订阅
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => onScanSubscriptions()}
                            disabled={isScanning}
                            style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                color: isScanning ? '#94a3b8' : '#64748b',
                                cursor: isScanning ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <IconRefreshCw style={{
                                width: '10px',
                                height: '10px',
                                animation: isScanning ? 'spin 1s linear infinite' : 'none'
                            }} />
                            扫描
                        </button>
                        {subscriptions.length > 0 && (
                            <button
                                onClick={selectedCount === selectableCount ? onDeselectAllSubscriptions : onSelectAllSubscriptions}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                }}
                            >
                                {selectedCount === selectableCount ? '取消全选' : '全选'}
                            </button>
                        )}
                    </div>
                </div>

                {/* 订阅列表 */}
                <div style={{ padding: '0 12px' }}>
                    {subscriptions.length === 0 ? (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '12px',
                        }}>
                            {isScanning ? '正在扫描...' : '点击"扫描"按钮获取订阅列表'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {subscriptions.map(sub => (
                                <SubscriptionCard
                                    key={sub.id}
                                    subscription={sub}
                                    isSelected={selectedSubscriptionIds.has(sub.id)}
                                    onToggle={() => onToggleSubscription(sub.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* 立即重置按钮 */}
                {subscriptions.length > 0 && selectedCount > 0 && onForceReset && (
                    <div style={{ padding: '12px 12px 0' }}>
                        <button
                            onClick={onForceReset}
                            disabled={isResetting}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                borderRadius: '8px',
                                border: 'none',
                                background: isResetting
                                    ? '#94a3b8'
                                    : selectedReadyCount > 0
                                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: '#fff',
                                cursor: isResetting ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
                                transition: 'all 150ms',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                        >
                            {isResetting ? (
                                <>
                                    <IconRefreshCw style={{
                                        width: '14px',
                                        height: '14px',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    重置中...
                                </>
                            ) : (
                                <>
                                    <IconZap style={{ width: '14px', height: '14px' }} />
                                    立即重置 ({selectedCount} 个)
                                    {selectedReadyCount < selectedCount && (
                                        <span style={{
                                            fontSize: '10px',
                                            opacity: 0.8,
                                            marginLeft: '4px',
                                        }}>
                                            含冷却中
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Section: 定时重置设置 */}
            <div className="py-3">
                <div className="px-4 pb-1.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">定时重置</div>
                </div>

                <SettingRow
                    label="启用定时重置"
                    description={
                        config.scheduledResetEnabled ? (
                            <ResetCountdownDisplay
                                remainingMs={remainingMs}
                                isPreciseMode={isPreciseMode}
                                resetStatus={resetStatus}
                            />
                        ) : '未启用'
                    }
                    control={
                        <Switch
                            checked={config.scheduledResetEnabled}
                            onChange={(c) => onConfigChange({ scheduledResetEnabled: c })}
                        />
                    }
                />

                {config.scheduledResetEnabled && (
                    <div className="px-4 py-3 mx-4 mt-2">
                        <ScheduleTimeConfig
                            times={config.scheduledResetTimes}
                            onChange={(times) => onConfigChange({ scheduledResetTimes: times })}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

// 订阅卡片组件
function SubscriptionCard({
    subscription,
    isSelected,
    onToggle
}: {
    subscription: SubscriptionInfo
    isSelected: boolean
    onToggle: () => void
}) {
    const { name, type, balance, canReset, isOnCooldown, cooldownText, resetCount, hasResetButton, nextResetAvailableAt, daysRemaining } = subscription

    // 有重置按钮的订阅都可以选中（包括冷却中的）
    const isSelectable = hasResetButton !== false  // undefined 时也可选（兼容旧数据）

    return (
        <div
            onClick={isSelectable ? onToggle : undefined}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(241, 245, 249, 0.6)',
                border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                cursor: isSelectable ? 'pointer' : 'default',
                opacity: isSelectable ? 1 : 0.6,
                transition: 'all 150ms',
            }}
        >
            {/* Checkbox */}
            <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                background: isSelected ? '#3b82f6' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 150ms',
            }}>
                {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                }}>
                    {name}
                    <span style={{
                        fontSize: '10px',
                        fontWeight: 400,
                        color: '#94a3b8',
                        padding: '1px 6px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        borderRadius: '4px',
                    }}>
                        {type}
                    </span>
                    {daysRemaining !== undefined && (
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: daysRemaining <= 7 ? '#ef4444' : daysRemaining <= 30 ? '#f59e0b' : '#22c55e',
                            padding: '1px 6px',
                            background: daysRemaining <= 7 ? 'rgba(239, 68, 68, 0.1)' : daysRemaining <= 30 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '4px',
                        }}>
                            {daysRemaining}天
                        </span>
                    )}
                </div>
                {balance && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {balance}
                    </div>
                )}
            </div>

            {/* Status */}
            <div style={{ flexShrink: 0 }}>
                {isOnCooldown ? (
                    nextResetAvailableAt ? (
                        <CooldownCountdown endTime={nextResetAvailableAt} />
                    ) : (
                        <span style={{
                            fontSize: '10px',
                            color: '#f59e0b',
                            background: 'rgba(245, 158, 11, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                        }}>
                            {cooldownText || '冷却中'}
                        </span>
                    )
                ) : canReset ? (
                    <span style={{
                        fontSize: '10px',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                    }}>
                        可重置{resetCount !== undefined ? ` (${resetCount}次)` : ''}
                    </span>
                ) : (
                    <span style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                    }}>
                        无按钮
                    </span>
                )}
            </div>
        </div>
    )
}

// 精确冷却倒计时组件（性能优化版）
const CooldownCountdown = memo(function CooldownCountdown({
    endTime
}: {
    endTime: Date | string  // 支持字符串（从持久化恢复时）
}) {
    const [remaining, setRemaining] = useState('')
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const update = () => {
            const now = new Date()
            // 兼容字符串和 Date 对象，同时处理 null/undefined
            if (!endTime) {
                setRemaining('可重置')
                return
            }
            const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime
            // 检查是否为有效 Date
            if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
                setRemaining('可重置')
                return
            }
            const diffMs = endDate.getTime() - now.getTime()

            if (diffMs <= 0) {
                setRemaining('可重置')
                return
            }

            const hours = Math.floor(diffMs / 3600000)
            const mins = Math.floor((diffMs % 3600000) / 60000)

            // 30分钟阈值
            const isWithin30Min = diffMs <= 30 * 60 * 1000

            // 中文格式显示（不显示秒）
            if (hours > 0) {
                setRemaining(`${hours}小时${mins}分`)
            } else {
                setRemaining(`${mins}分`)
            }

            // 动态更新间隔：≤30分钟=60秒，>30分钟=5分钟
            const interval = isWithin30Min ? 60000 : 300000
            timerRef.current = setTimeout(update, interval)
        }

        update()
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [endTime])

    const isReady = remaining === '可重置'

    return (
        <span style={{
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            color: isReady ? '#10b981' : '#f59e0b',
            background: isReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            padding: '2px 8px',
            borderRadius: '9999px',
        }}>
            {remaining}
        </span>
    )
})


function LogsPanel({ logs, onClear }: { logs: string[], onClear: () => void }) {
    const listRef = useRef<HTMLDivElement>(null)

    // 合并连续相同的日志（去掉时间戳后比较）
    const mergedLogs = useMemo(() => {
        const result: { log: string; count: number; firstIndex: number }[] = []

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i]
            // 提取时间戳后的内容用于比较
            const content = log.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
            const prev = result[result.length - 1]

            // 只合并可合并的日志类型（刷新类、跳过类等重复性高的）
            const isMergeable = content.includes('刷新') ||
                content.includes('跳过') ||
                content.includes('冷却')

            if (prev && isMergeable) {
                const prevContent = prev.log.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
                if (prevContent === content) {
                    prev.count++
                    continue
                }
            }

            result.push({ log, count: 1, firstIndex: i })
        }

        return result
    }, [logs])

    // 新日志时自动滚动到底部
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight
        }
    }, [logs.length])

    if (logs.length === 0) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '240px',
                gap: '12px',
                color: 'rgba(100, 116, 139, 0.5)',
            }}>
                <IconFileText style={{ width: '32px', height: '32px', opacity: 0.2 }} />
                <p style={{ fontSize: '12px', margin: 0 }}>暂无操作日志</p>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 头部 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(226, 232, 240, 0.4)',
                background: 'rgba(248, 250, 252, 0.5)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backdropFilter: 'blur(8px)',
            }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b' }}>
                    共 {logs.length} 条{mergedLogs.length < logs.length && ` (显示 ${mergedLogs.length})`}
                </span>
                <button
                    onClick={onClear}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#64748b',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444'
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#64748b'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                >
                    <IconTrash style={{ width: '12px', height: '12px' }} />
                    清空
                </button>
            </div>

            {/* 日志列表 */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px',
                }}
            >
                {mergedLogs.map(({ log, count, firstIndex }) => {
                    const { color, bgColor, Icon } = getLogStyle(log)
                    return (
                        <div
                            key={firstIndex}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                padding: '6px 10px',
                                marginBottom: '2px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                                lineHeight: 1.5,
                                background: bgColor,
                                transition: 'background 150ms',
                            }}
                        >
                            {/* 图标 */}
                            <span style={{
                                flexShrink: 0,
                                width: '14px',
                                height: '14px',
                                marginTop: '1px',
                            }}>
                                <Icon style={{ width: '14px', height: '14px', color }} />
                            </span>
                            {/* 日志内容 */}
                            <span style={{
                                flex: 1,
                                color: color,
                                wordBreak: 'break-all',
                            }}>
                                {log}
                            </span>
                            {/* 合并计数 */}
                            {count > 1 && (
                                <span style={{
                                    flexShrink: 0,
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '9999px',
                                    background: color,
                                    color: '#fff',
                                    marginLeft: '4px',
                                }}>
                                    ×{count}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// --- Components ---

function TabButton({ active, onClick, icon, label, badge, countdown, isUrgent }: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    badge?: number
    countdown?: string | null
    isUrgent?: boolean
}) {
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                height: '28px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '9999px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'color 200ms ease-in-out',
                color: active ? '#0f172a' : '#64748b',
            }}
        >
            {icon}
            {label}
            {countdown && (
                <span
                    className={isUrgent ? 'countdown-pulse' : ''}
                    style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        padding: '1px 5px',
                        borderRadius: '6px',
                        backgroundColor: active
                            ? (isUrgent ? 'rgba(220, 38, 38, 0.15)' : 'rgba(5, 150, 105, 0.15)')
                            : 'rgba(100,116,139,0.1)',
                        color: active
                            ? (isUrgent ? '#dc2626' : '#059669')
                            : '#64748b',
                    }}
                >
                    {countdown}
                </span>
            )}
            {badge !== undefined && !countdown && (
                <span
                    style={{
                        marginLeft: '2px',
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '0 6px',
                        borderRadius: '9999px',
                        height: '16px',
                        minWidth: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? 'rgba(15,23,42,0.1)' : 'rgba(100,116,139,0.1)',
                        color: active ? '#334155' : '#64748b',
                    }}
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </button>
    )
}

function SettingRow({ label, description, control }: { label: string, description?: React.ReactNode, control: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors group">
            <div className="flex-1 min-w-0 pr-4">
                <div className="text-sm font-medium text-foreground">{label}</div>
                {description && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{description}</div>}
            </div>
            <div className="flex-none">{control}</div>
        </div>
    )
}

// 独立倒计时组件 - 接收预计算的倒计时数据，不再自己计算
const ResetCountdownDisplay = memo(function ResetCountdownDisplay({
    remainingMs,
    isPreciseMode,
    resetStatus,
}: {
    remainingMs: number | null
    isPreciseMode: boolean
    resetStatus: 'idle' | 'waiting' | 'cooling'
}) {
    // 格式化倒计时显示
    const formatCountdown = (ms: number, isPrecise: boolean): string => {
        if (ms <= 0) return '即将执行...'

        const totalSeconds = Math.floor(ms / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (isPrecise) {
            // 精准模式：显示 mm:ss 或 h:mm:ss
            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            }
            return `${minutes}:${seconds.toString().padStart(2, '0')}`
        } else {
            // 非精准模式：显示 Xh Xm
            if (hours > 0) {
                return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
            }
            return `${minutes}m`
        }
    }

    if (resetStatus === 'cooling') {
        return <span style={{ color: '#d97706', fontWeight: 500 }}>冷却中</span>
    }

    if (resetStatus === 'waiting' && remainingMs !== null) {
        const countdown = formatCountdown(remainingMs, isPreciseMode)
        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                    color: isPreciseMode ? '#dc2626' : '#059669',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    animation: isPreciseMode ? 'pulse 1s infinite' : 'none',
                }}>{countdown}</span>
                <span style={{ color: '#64748b' }}>后执行</span>
                {!isPreciseMode && (
                    <span style={{
                        fontSize: '9px',
                        color: '#94a3b8',
                        background: 'rgba(148, 163, 184, 0.1)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                    }}>省电模式</span>
                )}
            </span>
        )
    }

    return <span style={{ color: '#64748b' }}>等待中...</span>
})

function Switch({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 enhance-switch
                ${checked ? 'bg-primary enhance-switch-checked' : 'bg-slate-400 dark:bg-slate-600 enhance-switch-unchecked'}
            `}
        >
            <span
                className={`
                    pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 enhance-switch-thumb
                    ${checked ? 'translate-x-4' : 'translate-x-0'}
                `}
                style={{
                    transform: checked ? 'translateX(100%)' : 'translateX(0)'
                }}
            />
        </button>
    )
}

function ScheduleTimeConfig({ times, onChange }: { times: string[]; onChange: (times: string[]) => void }) {
    const [newTime, setNewTime] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    const addTime = () => {
        if (newTime && !times.includes(newTime)) {
            onChange([...times, newTime].sort())
            setNewTime('')
            setIsAdding(false)
        }
    }

    const cancelAdd = () => {
        setNewTime('')
        setIsAdding(false)
    }

    return (
        <div
            style={{
                position: 'relative',
                padding: '12px',
                borderRadius: '16px',
                background: 'linear-gradient(to bottom right, rgba(238,242,255,0.5), rgba(245,243,255,0.5))',
                border: '1px solid rgba(199,210,254,0.5)',
                transition: 'all 300ms',
            }}
        >
            {/* Header with Sparkle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                    padding: '6px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    color: '#6366f1',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}>
                    <IconSparkles style={{ width: '14px', height: '14px' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>自动重置计划</div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>每天将在指定时间执行</div>
                </div>

                {/* Add Time Button / Input */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    overflow: 'hidden',
                }}>
                    {isAdding ? (
                        <>
                            <input
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addTime()
                                    if (e.key === 'Escape') cancelAdd()
                                }}
                                style={{
                                    width: '85px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    fontWeight: 500,
                                    color: '#4f46e5',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    animation: 'slideIn 150ms ease-out',
                                }}
                            />
                            <button
                                onClick={addTime}
                                disabled={!newTime || times.includes(newTime)}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: !newTime || times.includes(newTime) ? '#94a3b8' : '#ffffff',
                                    backgroundColor: !newTime || times.includes(newTime) ? '#e2e8f0' : '#6366f1',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: !newTime || times.includes(newTime) ? 'not-allowed' : 'pointer',
                                    transition: 'all 150ms',
                                    animation: 'slideIn 150ms ease-out',
                                }}
                            >
                                确定
                            </button>
                            <button
                                onClick={cancelAdd}
                                style={{
                                    padding: '4px 6px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: '#64748b',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 150ms',
                                    animation: 'slideIn 150ms ease-out',
                                }}
                            >
                                取消
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6366f1',
                                backgroundColor: 'rgba(238,242,255,1)',
                                border: '1px solid rgba(199,210,254,1)',
                                borderRadius: '9999px',
                                cursor: 'pointer',
                                transition: 'all 150ms',
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            添加
                        </button>
                    )}
                </div>
            </div>

            {/* Chips Container */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minHeight: '32px' }}>
                {times.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>暂无计划时间</span>
                ) : (
                    times.map(time => (
                        <div
                            key={time}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                paddingLeft: '12px',
                                paddingRight: '4px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                borderRadius: '12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                cursor: 'default',
                                userSelect: 'none',
                            }}
                        >
                            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#334155' }}>{time}</span>
                            <button
                                onClick={() => onChange(times.filter(t => t !== time))}
                                style={{
                                    padding: '4px',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <IconX style={{ width: '12px', height: '12px' }} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Quick Add Presets */}
            {(['18:51', '23:52'].some(t => !times.includes(t))) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px dashed rgba(199,210,254,0.5)',
                }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>快捷添加:</span>
                    {['18:51', '23:52'].map(preset => (
                        !times.includes(preset) && (
                            <button
                                key={preset}
                                onClick={() => onChange([...times, preset].sort())}
                                style={{
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    color: '#6366f1',
                                    backgroundColor: 'rgba(238,242,255,0.8)',
                                    border: '1px dashed #c7d2fe',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 150ms',
                                }}
                            >
                                +{preset}
                            </button>
                        )
                    ))}
                </div>
            )}

            {/* Animation Styles */}
            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes countdownPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .countdown-pulse {
                    animation: countdownPulse 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}

function IconSparkles({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
            <path d="M9.75 3.031c.427-1.374 2.073-1.374 2.5 0l1.203 3.864 3.864 1.203c1.374.427 1.374 2.073 0 2.5l-3.864 1.203-1.203 3.864c-.427 1.374-2.073 1.374-2.5 0l-1.203-3.864-3.864-1.203c-1.374-.427-1.374-2.073 0-2.5l3.864-1.203L9.75 3.031Z" />
            <path d="M16.75 14.031c.427-1.374 2.073-1.374 2.5 0l.601 1.932 1.932.601c1.374.427 1.374 2.073 0 2.5l-1.932.601-.601 1.932c-.427 1.374-2.073 1.374-2.5 0l-.601-1.932-1.932-.601c-1.374-.427-1.374-2.073 0-2.5l1.932-.601.601-1.932Z" />
        </svg>
    )
}

// --- Helpers ---

// 日志图标组件
type LogIconProps = { style?: React.CSSProperties }

const LogIconSuccess = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const LogIconSkip = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
)

const LogIconError = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

const LogIconSection = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
)

const LogIconStep = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
)

const LogIconRefresh = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
)

const LogIconNav = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
)

const LogIconInfo = ({ style }: LogIconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
)

function getLogStyle(log: string): { color: string; bgColor: string; Icon: React.FC<LogIconProps> } {
    // 成功类
    if (log.includes('成功') || log.includes('✓') || log.includes('完成')) {
        return { color: '#059669', bgColor: 'rgba(16, 185, 129, 0.08)', Icon: LogIconSuccess }
    }
    // 跳过/警告类
    if (log.includes('跳过') || log.includes('○') || log.includes('冷却')) {
        return { color: '#d97706', bgColor: 'rgba(245, 158, 11, 0.08)', Icon: LogIconSkip }
    }
    // 失败/错误类
    if (log.includes('✗') || log.includes('失败') || log.includes('错误')) {
        return { color: '#dc2626', bgColor: 'rgba(239, 68, 68, 0.08)', Icon: LogIconError }
    }
    // 分隔线
    if (log.includes('==========')) {
        return { color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.06)', Icon: LogIconSection }
    }
    // 步骤类
    if (log.includes('步骤')) {
        return { color: '#0284c7', bgColor: 'rgba(14, 165, 233, 0.06)', Icon: LogIconStep }
    }
    // 刷新类
    if (log.includes('刷新')) {
        return { color: '#0891b2', bgColor: 'transparent', Icon: LogIconRefresh }
    }
    // 跳转类
    if (log.includes('跳转') || log.includes('pending')) {
        return { color: '#7c3aed', bgColor: 'rgba(139, 92, 246, 0.06)', Icon: LogIconNav }
    }
    // 默认
    return { color: '#334155', bgColor: 'transparent', Icon: LogIconInfo }
}

function getPageName(path: string): string {
    const routes: Record<string, string> = {
        '/home-page': '首页',
        '/my-subscription': '我的订阅',
        '/subscription': '我的订阅',
        '/usage': '使用记录',
        '/settings': '设置',
        '/invitations': '邀请管理',
    }
    for (const [route, name] of Object.entries(routes)) {
        if (path.includes(route)) return name
    }
    return path || '未知页面'
}

// --- Icons ---

function IconRefreshCw({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
    )
}

function IconSettings({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}

function IconFileText({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    )
}

function IconTrash({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    )
}

function IconX({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <path d="m6 6 12 12" />
            <path d="m18 6-12 12" />
        </svg>
    )
}

function IconZap({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    )
}

