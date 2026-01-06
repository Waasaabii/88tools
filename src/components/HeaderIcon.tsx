import { useEffect, useRef } from 'react'
import logoUrl from '/logo.gif'

interface HeaderIconProps {
    onClick: () => void
    isActive: boolean
}

export function HeaderIcon({ onClick, isActive }: HeaderIconProps) {
    // 使用 ref 保存 onClick，避免依赖变化导致重新注入
    const onClickRef = useRef(onClick)
    const isActiveRef = useRef(isActive)

    // 更新 ref 值
    useEffect(() => {
        onClickRef.current = onClick
        isActiveRef.current = isActive

        // 只更新样式，不重新创建按钮
        const btn = document.getElementById('enhance-header-icon')
        if (btn) {
            btn.className = getIconClassName(isActive)
        }
    }, [onClick, isActive])

    useEffect(() => {
        const injectIcon = () => {
            // 如果已存在则跳过
            if (document.getElementById('enhance-header-icon')) {
                return
            }

            // 精确查找：包含"查看公告"按钮的容器
            const announcementBtn = document.querySelector('button[aria-label="查看公告"]')
            if (!announcementBtn) {
                console.log('[88tools] 查看公告按钮未找到，稍后重试...')
                return
            }

            // 获取按钮的父容器 (flex items-center gap-2)
            const container = announcementBtn.parentElement
            if (!container) {
                console.log('[88tools] 容器未找到')
                return
            }

            // 创建按钮，样式与站点其他按钮一致
            const btn = document.createElement('button')
            btn.id = 'enhance-header-icon'
            btn.title = '88code 助手'
            btn.setAttribute('data-slot', 'tooltip-trigger')
            btn.className = getIconClassName(isActiveRef.current)
            btn.innerHTML = `<img src="${logoUrl}" alt="88tools" class="size-5 rounded" />`

            // 使用 ref 中的 onClick，这样更新时不会重新创建按钮
            btn.onclick = (e) => {
                e.preventDefault()
                e.stopPropagation()
                onClickRef.current()
            }

            // 插入到容器的开头（第一个按钮之前）
            container.insertBefore(btn, container.firstChild)
            console.log('[88tools] Header icon 注入成功')
        }

        // 延迟注入，等待 SPA 渲染完成
        const timer = setTimeout(injectIcon, 800)

        // 定期检查并重新注入（如果被页面路由切换移除）
        const interval = setInterval(() => {
            if (!document.getElementById('enhance-header-icon')) {
                injectIcon()
            }
        }, 2000)

        // 只在组件卸载时清理，不是每次重渲染
        return () => {
            clearTimeout(timer)
            clearInterval(interval)
        }
    }, []) // 空依赖，只在挂载时执行一次

    return null
}

// 生成与站点按钮一致的类名
function getIconClassName(isActive: boolean): string {
    const baseClasses = [
        'inline-flex items-center justify-center',
        'gap-2 whitespace-nowrap text-sm font-medium',
        'shrink-0 select-none',
        '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [&_svg]:shrink-0',
        'outline-none ring-offset-background',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-200',
        'border border-transparent',
        'active:translate-y-[0.5px] active:shadow-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-60',
        'touch-manipulation',
        'bg-transparent shadow-none',
        'hover:bg-accent/40 hover:text-accent-foreground dark:hover:bg-accent/30',
        'size-9 rounded-full',
        'hover:border-primary/50'
    ].join(' ')

    // 激活状态添加高亮边框
    const activeClasses = isActive ? 'border-emerald-500' : ''

    return `${baseClasses} ${activeClasses}`
}
