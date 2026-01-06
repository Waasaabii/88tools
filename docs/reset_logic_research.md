# 源站重置逻辑调研报告

**日期**: 2026-01-07
**目标**: 调研 `https://www.88code.ai/my-subscription` 页面上“重置额度”功能的底层实现逻辑。

## 1. 核心发现 (API 接口)

通过浏览器环境的 Fetch 拦截与行为模拟，我们成功捕获了重置操作的后端 API。

- **接口地址**: `https://www.88code.ai/admin-api/cc-admin/system/subscription/my/reset-credits/{subscription_id}`
- **请求方法**: `POST`
- **请求体 (Body)**: 空 (无需携带 payload)
- **认证方式**: 依赖浏览器当前的 Cookie / Session。

## 2. 关键参数提取 ({subscription_id})

经深度 DOM 结构分析，`subscription_id` **不存在于任何 `data-*` 属性或隐藏输入框中**。它是动态生成并仅存在于跳转链接中。

### 2.1 确定的获取位置 (Primary Source)
唯一可靠的前端 ID 来源是订阅卡片上的**详情页跳转链接**。

1.  **卡片容器**: `div[data-slot="card"]`
2.  **链接元素**: 卡片内部唯一的跳转 `<a>` 标签（通常包含 `lucide-chevron-right` 图标）。
3.  **提取属性**: `href`

### 2.2 验证的提取代码
```javascript
// 在订阅卡片元素内寻找链接
const link = card.querySelector('a[href*="/my-subscription/"]');
const href = link ? link.getAttribute('href') : '';
// 正则提取：匹配数字 ID
const match = href.match(/\/my-subscription\/(\d+)/);
const subscription_id = match ? match[1] : null; // 例如 "60771"
```

### 2.3 备选方案 (Backend Source)
如果前端提取失败，可通过调用列表 API 直接获取完整数据：
- **GET** `https://www.88code.ai/admin-api/cc-admin/system/subscription/my`
- **响应结构**:
  ```json
  [
    {
      "id": 60771,  // <--- 目标 ID
      "name": "Free Plan",
      ...
    }
  ]
  ```

### 2.4 DOM 结构快照 (Verified)
以下是浏览器环境捕获的实际 DOM 结构：
```html
<div data-slot="card" class="...">
  <!-- 头部区域 -->
  <div class="flex ...">
     <h4>FREE (剩余1次)</h4>
     <!-- 详情跳转链接 (ID 唯一载体) -->
     <a href="/my-subscription/60771" class="..."> 
       <svg class="lucide-chevron-right ..."></svg>
     </a>
  </div>
  <!-- 底部操作区 -->
  <div class="...">
     <button>重置额度</button> <!-- 注意：按钮本身无 ID -->
  </div>
</div>
```

## 3. 现有代码适配建议

为了从模拟点击升级为 API 调用，建议对现有代码进行以下调整（已在 `useSubscriptions.ts` 中部分验证）：

1.  **数据结构扩展**: 在 `SubscriptionInfo` 接口中增加 `backendId` 字段。
2.  **ID 提取**: 在 `scan` 函数遍历 DOM 时，通过正则表达式从卡片的 `href` 中提取 ID 并存入 `backendId`。
3.  **执行逻辑**: `executeResetOperation` 函数应直接对 `backendId` 发起 `fetch` 请求，替代原有的 `querySelector('button').click()` 逻辑，从而绕过不稳定的 UI 弹窗交互。

## 4. 交互流程还原

1.  **触发**: 用户点击“重置额度”按钮。
2.  **确认**: 界面弹出 Modal 询问确认。
3.  **调用**: 点击确认后，前端发送上述 API 请求。
4.  **反馈**: 成功后，按钮状态变更为“冷却中”，并显示剩余次数。

---
*此文档由 Antigravity 自动生成*

## 5. 后端状态逻辑分析 (API Integration)

通过调用 `GET /admin-api/cc-admin/system/subscription/my` 获取的 JSON 数据，我们解析出了控制重置逻辑的核心字段。

### 5.1 核心字段定义
| 字段名 | 类型 | 说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| **id** | `number` | 订阅唯一标识（用于 API 调用） | `60771` |
| **canResetNow** | `boolean` | **总开关**：是否允许当前进行重置 | `false` (冷却中) / `true` (可重置) |
| **nextResetAvailableAt** | `string` | **冷却结束时间**：下一次可重置的时间点 | `"2026-01-07 05:17:45"` |
| **resetTimes** | `number` | **剩余次数**：今日剩余可手动重置次数 | `1` |
| **currentCredits** | `number` | 当前已用额度 | `20.0` |

### 5.2 状态判断逻辑
前端应用在使用 API 数据时应遵循以下优先级：

1.  **冷却状态**:
    - 判断条件: `canResetNow === false` 且 `nextResetAvailableAt > 当前时间`。
    - UI 表现: 按钮禁用，文案显示“冷却中”，Tooltip 提示解锁时间。

2.  **次数耗尽**:
    - 判断条件: `resetTimes === 0`。
    - UI 表现: 按钮禁用，提示“今日次数已用完”。

3.  **可重置**:
    - 判断条件: `canResetNow === true` 且 `resetTimes > 0`。
    - UI 表现: 按钮高亮可用，点击触发 `POST .../reset-credits/{id}`。

### 5.3 自动化建议
- **API 优先**: 推荐直接调用列表 API 获取状态，而非解析 DOM 类名（如 "text-muted"）。这样能精确获取到毫秒级的冷却结束时间，实现更精准的倒计时。
- **Token**: 调用 API 需要携带 `Authorization: Bearer <token>` 头部（Token 可从 LocalStorage `authToken` 中获取）。
