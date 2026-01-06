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
    const status = provider.latest?.status || 'unknown'

    // 使用 statistics.uptime_percent 获取可用性
    const uptime = Math.round(provider.statistics?.uptime_percent || 0)

    // 使用 timeline 数组（不是 history）
    const timeline = provider.timeline || []

    return (
        <div style={{
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            padding: '16px',
            transition: 'box-shadow 0.15s',
        }}>
            {/* 服务信息头部 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{provider.name}</h3>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getStatusColor(status),
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {uptime}% 可用
                    </span>
                </div>
            </div>

            {/* 60 分钟时间线 - 使用 timeline 字段 */}
            {timeline.length > 0 ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', height: '24px', gap: '1px' }}>
                        {timeline.slice(0, 60).reverse().map((entry, index) => (
                            <div
                                key={index}
                                title={`${new Date(entry.checked_at).toLocaleTimeString()} - ${entry.status} (${entry.latency_ms}ms)`}
                                style={{
                                    flex: 1,
                                    height: '20px',
                                    borderRadius: '2px',
                                    background: getStatusColor(entry.status),
                                    opacity: entry.status === 'operational' ? 0.8 : 1,
                                    transition: 'transform 0.1s',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scaleY(1.25)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scaleY(1)')}
                            />
                        ))}
                    </div>
                    {/* 时间标签 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
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

// 获取整体状态
function getOverallStatus(data: StatusApiResponse): string {
    // 检查所有 provider 的 latest 状态
    if (!data.providers?.length) return 'unknown'

    const hasError = data.providers.some(p => p.latest?.status === 'failed' || p.latest?.status === 'down')
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
        case 'failed': return '服务故障'
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
        case 'down': return '#ef4444' // red-500
        case 'maintenance': return '#6366f1' // indigo-500
        default: return '#6b7280' // gray-500
    }
}
