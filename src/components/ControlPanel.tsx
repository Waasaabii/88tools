import type { EnhanceConfig } from './EnhanceManager'
import { REFRESH_INTERVAL_TEMPLATES } from './EnhanceManager'
import { useState, useRef, useEffect, useCallback } from 'react'
import logoUrl from '/logo.gif'

interface ControlPanelProps {
    config: EnhanceConfig
    onConfigChange: (updates: Partial<EnhanceConfig>) => void
    currentPath: string
    refreshCountdown: number
    nextRefreshTime: string | null
    resetCountdown: number
    nextResetTime: string | null
    resetStatus: 'idle' | 'waiting' | 'cooling'
    resetLogs: string[]
    onClearLogs: () => void
}

// 彩虹背景 CSS 变量
const rainbowStyles = {
    '--stripes': 'repeating-linear-gradient(100deg, #fff 0%, #fff 7%, transparent 10%, transparent 12%, #fff 16%)',
    '--stripesDark': 'repeating-linear-gradient(100deg, #000 0%, #000 7%, transparent 10%, transparent 12%, #000 16%)',
    '--rainbow': 'repeating-linear-gradient(100deg, #60a5fa 10%, #e879f9 16%, #5eead4 22%, #60a5fa 30%)',
} as React.CSSProperties

export function ControlPanel({
    config,
    onConfigChange,
    currentPath,
    refreshCountdown,
    nextRefreshTime,
    resetCountdown,
    nextResetTime,
    resetStatus,
    resetLogs,
    onClearLogs,
}: ControlPanelProps) {
    const isMinimized = config.panelMinimized
    const panelRef = useRef<HTMLDivElement>(null)

    // 拖拽状态
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        // 从配置恢复位置，默认右下角
        return config.panelPosition || { x: window.innerWidth - 340, y: window.innerHeight - 400 }
    })
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

    // 拖拽处理
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
        }
    }, [position])

    useEffect(() => {
        if (!isDragging) return

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStart.current) return
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            const newX = Math.max(0, Math.min(window.innerWidth - 320, dragStart.current.posX + dx))
            const newY = Math.max(0, Math.min(window.innerHeight - 200, dragStart.current.posY + dy))
            setPosition({ x: newX, y: newY })
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            dragStart.current = null
            // 保存位置到配置
            onConfigChange({ panelPosition: position })
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, position, onConfigChange])

    // 点击面板外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                // 检查是否点击了 header icon
                const headerIcon = document.getElementById('enhance-header-icon')
                if (headerIcon && headerIcon.contains(e.target as Node)) return
                onConfigChange({ panelMinimized: true })
            }
        }

        if (!isMinimized) {
            // 延迟添加事件监听，避免立即触发
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside)
            }, 100)
            return () => {
                clearTimeout(timer)
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [isMinimized, onConfigChange])

    const toggleMinimize = () => {
        onConfigChange({ panelMinimized: !isMinimized })
    }

    // Tab 切换状态
    const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings')

    // 隐藏时不渲染
    if (isMinimized) {
        return null
    }

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                zIndex: 99999,
                minWidth: '320px',
                maxWidth: '360px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                background: 'var(--card)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, .25)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
            }}
        >
            {/* 彩虹背景效果 */}
            <div
                className="ray"
                style={{
                    ...rainbowStyles,
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    opacity: 0.3,
                    backgroundImage: 'var(--stripesDark), var(--rainbow)',
                    backgroundSize: '300%, 200%',
                    backgroundPosition: '50% 50%, 50% 50%',
                    filter: 'opacity(50%) saturate(200%)',
                    maskImage: 'radial-gradient(at 100% 0%, black 40%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(at 100% 0%, black 40%, transparent 70%)',
                    animation: 'ray-animate 90s linear infinite',
                }}
            />

            {/* Header - 可拖拽 */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    position: 'relative',
                    zIndex: 1,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <img src={logoUrl} alt="88tools" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
                    88code 增强
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); toggleMinimize() }}
                    title="收起"
                    style={{
                        padding: '4px',
                        borderRadius: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted-foreground)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            {/* Tab 切换器 */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border)',
                padding: '0 16px',
                position: 'relative',
                zIndex: 1,
            }}>
                <button
                    onClick={() => setActiveTab('settings')}
                    style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: activeTab === 'settings' ? 'var(--foreground)' : 'var(--muted-foreground)',
                        borderBottom: activeTab === 'settings' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                    }}
                >
                    ⚙️ 设置
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: activeTab === 'logs' ? 'var(--foreground)' : 'var(--muted-foreground)',
                        borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                    }}
                >
                    📋 日志 {resetLogs.length > 0 && `(${resetLogs.length})`}
                </button>
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, padding: '16px' }}>
                {activeTab === 'settings' ? (
                    <>
                        {/* 当前页面 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                            <span style={{ color: 'var(--muted-foreground)' }}>当前页面</span>
                            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--muted-foreground)', opacity: 0.7 }}>{getPageName(currentPath)}</span>
                        </div>

                        {/* 服务状态开关 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>服务状态显示</span>
                            <Switch
                                checked={config.showServiceStatus ?? true}
                                onChange={() => onConfigChange({ showServiceStatus: !(config.showServiceStatus ?? true) })}
                            />
                        </div>

                        {/* 自动刷新 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div>
                                <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>自动刷新</span>
                                {config.autoRefreshEnabled && (
                                    <div style={{ fontSize: '12px', marginTop: '2px', color: refreshCountdown > 0 ? '#10b981' : 'var(--muted-foreground)', opacity: 0.7 }}>
                                        {refreshCountdown > 0
                                            ? `${refreshCountdown}秒后刷新`
                                            : nextRefreshTime ? `下次: ${nextRefreshTime}` : '等待中...'}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                    value={config.autoRefreshInterval}
                                    onChange={(e) => onConfigChange({ autoRefreshInterval: Number(e.target.value) })}
                                    style={{
                                        background: 'var(--muted)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        color: 'var(--foreground)',
                                        cursor: 'pointer',
                                        outline: 'none',
                                    }}
                                >
                                    {REFRESH_INTERVAL_TEMPLATES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <Switch
                                    checked={config.autoRefreshEnabled}
                                    onChange={() => onConfigChange({ autoRefreshEnabled: !config.autoRefreshEnabled })}
                                />
                            </div>
                        </div>

                        {/* 定时重置 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: config.scheduledResetEnabled ? '8px' : '0' }}>
                            <div>
                                <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>定时重置</span>
                                {config.scheduledResetEnabled && (
                                    <div style={{ fontSize: '12px', marginTop: '2px', color: resetStatus === 'waiting' ? '#10b981' : 'var(--muted-foreground)', opacity: 0.7 }}>
                                        {resetStatus === 'cooling' && '冷却中'}
                                        {resetStatus === 'waiting' && nextResetTime && `下次: ${nextResetTime}`}
                                        {resetCountdown > 0 && ` (${Math.floor(resetCountdown / 60)}分${resetCountdown % 60}秒)`}
                                    </div>
                                )}
                            </div>
                            <Switch
                                checked={config.scheduledResetEnabled}
                                onChange={() => onConfigChange({ scheduledResetEnabled: !config.scheduledResetEnabled })}
                            />
                        </div>

                        {/* 定时重置时间配置 - 支持多个时间 */}
                        {config.scheduledResetEnabled && (
                            <ScheduleTimeConfig
                                times={config.scheduledResetTimes}
                                onChange={(times) => onConfigChange({ scheduledResetTimes: times })}
                            />
                        )}

                        {/* 重置日志 - 可折叠 */}
                        {config.scheduledResetEnabled && resetLogs.length > 0 && (
                            <div style={{
                                marginTop: '12px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                }}>
                                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                        重置日志 ({resetLogs.length})
                                    </span>
                                    <button
                                        onClick={onClearLogs}
                                        style={{
                                            fontSize: '11px',
                                            padding: '2px 8px',
                                            background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            borderRadius: '4px',
                                            color: 'var(--muted-foreground)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        清除
                                    </button>
                                </div>
                                <div style={{
                                    maxHeight: '120px',
                                    overflowY: 'auto',
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    lineHeight: 1.6,
                                    color: 'var(--muted-foreground)',
                                }}>
                                    {resetLogs.map((log, i) => (
                                        <div key={i} style={{
                                            opacity: log.includes('成功') || log.includes('✓') ? 1 : 0.8,
                                            color: log.includes('成功') || log.includes('✓') ? '#10b981' :
                                                log.includes('跳过') || log.includes('○') ? '#f59e0b' :
                                                    log.includes('✗') ? '#ef4444' : 'inherit',
                                        }}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* 日志 Tab */
                    <div>
                        {resetLogs.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '32px 16px',
                                color: 'var(--muted-foreground)',
                                fontSize: '13px',
                            }}>
                                暂无日志
                                <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
                                    开启定时重置后，重置记录将显示在这里
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px',
                                }}>
                                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                        共 {resetLogs.length} 条记录
                                    </span>
                                    <button
                                        onClick={onClearLogs}
                                        style={{
                                            fontSize: '11px',
                                            padding: '4px 12px',
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            color: 'var(--muted-foreground)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        清除日志
                                    </button>
                                </div>
                                <div style={{
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    lineHeight: 1.8,
                                }}>
                                    {resetLogs.map((log, i) => (
                                        <div key={i} style={{
                                            color: log.includes('成功') || log.includes('✓') ? '#10b981' :
                                                log.includes('跳过') || log.includes('○') ? '#f59e0b' :
                                                    log.includes('✗') ? '#ef4444' : 'var(--muted-foreground)',
                                        }}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// 开关组件
function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            style={{
                position: 'relative',
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: checked ? '#10b981' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '18px' : '2px',
                    width: '16px',
                    height: '16px',
                    background: 'white',
                    borderRadius: '50%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s',
                }}
            />
        </button>
    )
}

// 时间配置组件 - 支持多个定时
function ScheduleTimeConfig({ times, onChange }: { times: string[]; onChange: (times: string[]) => void }) {
    const [newTime, setNewTime] = useState('')

    const addTime = () => {
        if (newTime && !times.includes(newTime)) {
            onChange([...times, newTime].sort())
            setNewTime('')
        }
    }

    const removeTime = (time: string) => {
        onChange(times.filter(t => t !== time))
    }

    return (
        <div style={{
            padding: '12px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
        }}>
            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
                重置时间表 ({times.length} 个定时)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {times.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', opacity: 0.5 }}>暂无定时，请添加</span>
                ) : (
                    times.map(time => (
                        <span
                            key={time}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                            }}
                        >
                            {time}
                            <button
                                onClick={() => removeTime(time)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: '14px',
                                    lineHeight: 1,
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))
                )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: 'var(--foreground)',
                        outline: 'none',
                    }}
                />
                <button
                    onClick={addTime}
                    style={{
                        padding: '6px 12px',
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    添加
                </button>
            </div>
        </div>
    )
}

// 根据路径获取页面名称 - 修复"我的订阅"匹配
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
    return path || '首页'
}
