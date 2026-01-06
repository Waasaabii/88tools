import { createRoot } from 'react-dom/client'
import { EnhanceManager } from './components/EnhanceManager'
import './styles/global.css'

// 等待 DOM 完全加载
function init() {
  // 防止重复初始化
  if (document.getElementById('88tools-enhance-root')) {
    console.log('[88tools] 已初始化，跳过')
    return
  }

  // 创建挂载容器
  const container = document.createElement('div')
  container.id = '88tools-enhance-root'
  document.body.appendChild(container)

  createRoot(container).render(
    <EnhanceManager />,
  )
}

// 等待页面加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
