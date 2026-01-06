import { useState } from 'react'
import type { StatusApiResponse, ServiceProvider } from '../hooks/useServiceStatus'

interface ServiceStatusCardProps {
    data: StatusApiResponse | null
    isLoading: boolean
    error: string | null
    onRefresh: () => void
    lastUpdated: Date | null
}

export function ServiceStatusCard({ data, isLoading, error, onRefresh, lastUpdated }: ServiceStatusCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    // 计算整体状态
    const overallStatus = data ? getOverallStatus(data) : 'unknown'
    const statusText = getStatusText(overallStatus)
    const statusColor = getStatusColor(overallStatus)

    return (
        <div
            data-slot="card"
            style={{
                background: 'var(--card)',
                color: 'var(--card-foreground)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,.05)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingBottom: '24px',
            }}
        >
            {/* 卡片头部 - 可折叠触发器 */}
            <div style={{ padding: '24px 24px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '16px',
                            fontWeight: 600,
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'color 0.15s',
                        }}
                    >
                        {/* 蓝色图标容器 */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
                            </svg>
                        </div>
                        服务状态
                        {/* 状态指示器 */}
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 'normal',
                            color: 'var(--muted-foreground)',
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: statusColor,
                                animation: overallStatus !== 'operational' ? 'pulse 1.5s infinite' : 'none',
                            }} />
                            {statusText}
                        </span>
                        {/* 展开/收起箭头 */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                                color: 'var(--muted-foreground)',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                            }}
                        >
                            <path d="m6 9 6 6 6-6"></path>
                        </svg>
                    </button>
                    {/* 刷新按钮 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--muted-foreground)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.5 : 1,
                            }}
                            title="刷新状态"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{
                                    animation: isLoading ? 'spin 1s linear infinite' : 'none',
                                }}
                            >
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                                <path d="M21 3v5h-5"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* 展开的内容 - 服务列表 */}
            {isExpanded && (
                <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {error ? (
                        <p style={{ color: '#ef4444', fontSize: '14px' }}>{error}</p>
                    ) : data && data.providers ? (
                        <>
                            {data.providers.map((provider) => (
                                <ServiceItemCard key={provider.id} provider={provider} />
                            ))}
                            {/* 更新时间 */}
                            {lastUpdated && (
                                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'right', marginTop: '4px' }}>
                                    更新于: {lastUpdated.toLocaleTimeString()}
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>加载中...</p>
                    )}
                </div>
            )}

            {/* 收起状态 - 简洁展示 */}
            {!isExpanded && data && data.providers && (
                <div style={{ padding: '0 24px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px' }}>
                        {data.providers.map((provider) => {
                            const status = provider.latest?.status || 'unknown'
                            return (
                                <div
                                    key={provider.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: getStatusColor(status),
                                    }} />
                                    <span style={{ color: 'var(--muted-foreground)' }}>{provider.name}</span>
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--muted-foreground)', opacity: 0.6 }}>
                                        {provider.model}
                                    </span>
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--muted-foreground)', opacity: 0.7 }}>
                                        {provider.latest?.latency_ms || 0}ms
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    {/* 更新时间 */}
                    {lastUpdated && (
                        <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'right', marginTop: '8px' }}>
                            更新于: {lastUpdated.toLocaleTimeString()}
                        </div>
                    )}
                </div>
            )}

            {/* 动画样式 */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    )
}

// 单个服务项卡片 - 匹配源站样式
function ServiceItemCard({ provider }: { provider: ServiceProvider }) {
    const [hoveredEntry, setHoveredEntry] = useState<{ entry: typeof provider.timeline[0], index: number, x: number } | null>(null)

    // 使用 timeline 数组
    const timeline = provider.timeline || []

    // 从 timeline 计算 uptime 百分比（统计 operational 状态占比）
    const uptime = timeline.length > 0
        ? (timeline.filter(e => e.status === 'operational').length / timeline.length) * 100
        : 0
    const uptimeDisplay = uptime === 100 ? '100.0' : uptime.toFixed(1)

    // 根据 uptime 百分比决定颜色
    const getUptimeColor = (percent: number) => {
        if (percent >= 99) return '#10b981' // 绿色
        if (percent >= 90) return '#f59e0b' // 黄色
        return '#ef4444' // 红色
    }

    return (
        <div style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            padding: '16px',
            transition: 'box-shadow 0.15s',
            position: 'relative',
        }}>
            {/* 服务信息头部 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* 服务名称和类型标签 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{provider.name}</h3>
                        <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--muted)',
                            color: 'var(--muted-foreground)',
                            textTransform: 'capitalize',
                        }}>
                            {provider.type}
                        </span>
                    </div>
                    {/* Provider 和 Model 信息 */}
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--muted-foreground)',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {provider.model}
                    </div>
                </div>
                {/* Uptime 百分比 - 匹配源站样式 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        fontFamily: 'ui-monospace, monospace',
                        color: getUptimeColor(uptime),
                    }}>
                        {uptimeDisplay}%
                    </span>
                    <span style={{
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--muted-foreground)',
                    }}>
                        UPTIME
                    </span>
                </div>
            </div>

            {/* 60 分钟时间线 - 响应式占满宽度 */}
            {timeline.length > 0 ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', position: 'relative', overflow: 'visible', height: '20px' }}>
                        {timeline.slice(0, 60).reverse().map((entry, index) => (
                            <div
                                key={index}
                                style={{
                                    flex: 1,
                                    height: '20px',
                                    borderRadius: '3px',
                                    background: getStatusColor(entry.status),
                                    opacity: entry.status === 'operational' ? 0.75 : 1,
                                    transition: 'transform 0.15s ease, opacity 0.15s',
                                    cursor: 'pointer',
                                    transform: hoveredEntry?.index === index ? 'scaleY(1.2)' : 'scaleY(1)',
                                }}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect()
                                    setHoveredEntry({
                                        entry,
                                        index,
                                        x: parentRect ? rect.left - parentRect.left + rect.width / 2 : 0
                                    })
                                }}
                                onMouseLeave={() => setHoveredEntry(null)}
                            />
                        ))}

                        {/* 自定义 Tooltip - 跟随圆点位置 */}
                        {hoveredEntry && (
                            <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: `${hoveredEntry.x}px`,
                                transform: 'translateX(-50%)',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                background: '#1e293b',
                                color: '#fff',
                                fontSize: '12px',
                                zIndex: 1000,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                pointerEvents: 'none',
                            }}>
                                {/* 日期时间 */}
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                                    {new Date(hoveredEntry.entry.checked_at).toLocaleString('zh-CN', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}
                                </div>
                                {/* 状态 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: getStatusColor(hoveredEntry.entry.status),
                                    }} />
                                    <span style={{ fontWeight: 500 }}>
                                        {getStatusTextForTooltip(hoveredEntry.entry.status)}
                                    </span>
                                </div>
                                {/* Message 内容 - 如果有错误信息则显示 */}
                                {hoveredEntry.entry.message && hoveredEntry.entry.message !== 'OK' && (
                                    <div style={{
                                        fontSize: '10px',
                                        color: '#fca5a5',
                                        marginTop: '4px',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        maxWidth: '250px',
                                    }}>
                                        {hoveredEntry.entry.message}
                                    </div>
                                )}
                                {/* 延迟信息 */}
                                {hoveredEntry.entry.latency_ms > 0 && (
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                                        延迟: {hoveredEntry.entry.latency_ms}ms
                                    </div>
                                )}
                                {/* 小三角 */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-4px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderTop: '5px solid #1e293b',
                                }} />
                            </div>
                        )}
                    </div>
                    {/* 时间标签 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}>
                            60分钟前
                        </span>
                        <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}>
                            现在
                        </span>
                    </div>
                </>
            ) : (
                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0' }}>
                    暂无时间线数据
                </div>
            )}
        </div>
    )
}

// Tooltip 状态文字
function getStatusTextForTooltip(status: string): string {
    switch (status) {
        case 'operational': return '正常'
        case 'degraded': return '响应慢'
        case 'failed':
        case 'error': return '故障'
        case 'down': return '不可用'
        case 'maintenance': return '维护中'
        default: return status
    }
}

// 获取整体状态
function getOverallStatus(data: StatusApiResponse): string {
    // 检查所有 provider 的 latest 状态
    if (!data.providers?.length) return 'unknown'

    // 检查是否有错误状态（包括 error、failed、down）
    const hasError = data.providers.some(p =>
        p.latest?.status === 'failed' ||
        p.latest?.status === 'down' ||
        p.latest?.status === 'error'  // API 返回的 error 状态
    )
    const hasDegraded = data.providers.some(p => p.latest?.status === 'degraded')

    if (hasError) return 'failed'
    if (hasDegraded) return 'degraded'
    return 'operational'
}

// 获取状态文字
function getStatusText(status: string): string {
    switch (status) {
        case 'operational': return '全部正常'
        case 'degraded': return '部分服务异常'
        case 'failed':
        case 'error': return '服务故障 ps:大米树又去洗脚了'  // API 返回的 error 状态
        case 'down': return '服务不可用'
        case 'maintenance': return '维护中'
        default: return '未知状态'
    }
}

// 获取状态颜色
function getStatusColor(status: string): string {
    switch (status) {
        case 'operational': return '#10b981' // emerald-500
        case 'degraded': return '#f59e0b' // amber-500
        case 'failed':
        case 'error':  // API 返回的 error 状态
        case 'down': return '#ef4444' // red-500
        case 'maintenance': return '#6366f1' // indigo-500
        default: return '#6b7280' // gray-500
    }
}
