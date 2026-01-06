import { useState, useEffect } from 'react'

interface RouteWatchResult {
    currentPath: string
    isSubscriptionPage: boolean
    isUsagePage: boolean
    isHomePage: boolean
}

export function useRouteWatch(): RouteWatchResult {
    const [currentPath, setCurrentPath] = useState(window.location.pathname)

    useEffect(() => {
        // 监听 popstate 事件（浏览器前进/后退）
        const handlePopState = () => {
            setCurrentPath(window.location.pathname)
        }

        // 监听 pushState 和 replaceState（SPA 路由变化）
        const originalPushState = history.pushState
        const originalReplaceState = history.replaceState

        history.pushState = function (...args) {
            originalPushState.apply(this, args)
            setCurrentPath(window.location.pathname)
        }

        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args)
            setCurrentPath(window.location.pathname)
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
            history.pushState = originalPushState
            history.replaceState = originalReplaceState
        }
    }, [])

    return {
        currentPath,
        isSubscriptionPage: currentPath.includes('subscription'),
        isUsagePage: currentPath.includes('usage'),
        isHomePage: currentPath.includes('home-page') || currentPath === '/',
    }
}
