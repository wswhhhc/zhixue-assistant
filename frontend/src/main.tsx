import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'katex/dist/katex.min.css'
import './styles/tech-design-system.css'
import App from './App.tsx'

// Ant Design 深色主题配置
const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 主色调 - 青色
    colorPrimary: '#00d4ff',
    colorPrimaryHover: '#22d3ee',
    colorPrimaryActive: '#00a8cc',
    
    // 背景色
    colorBgBase: '#030712',
    colorBgContainer: '#111827',
    colorBgElevated: '#0a0f1c',
    
    // 文字颜色
    colorText: '#f8fafc',
    colorTextSecondary: '#94a3b8',
    colorTextTertiary: '#64748b',
    
    // 边框颜色
    colorBorder: 'rgba(148, 163, 184, 0.1)',
    colorBorderSecondary: 'rgba(148, 163, 184, 0.08)',
    
    // 圆角
    borderRadius: 12,
    borderRadiusSM: 8,
    borderRadiusLG: 16,
    borderRadiusXL: 24,
    
    // 字体
    fontFamily: "'Noto Sans SC', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontFamilyCode: "'JetBrains Mono', 'Consolas', monospace",
    
    // 控制组件大小
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
    
    // 间距
    paddingContentHorizontal: 16,
    paddingContentVertical: 12,
    
    // 阴影
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 8px 32px rgba(0, 0, 0, 0.4)',
    
    // 动画
    motionDurationFast: '0.15s',
    motionDurationMid: '0.25s',
    motionDurationSlow: '0.35s',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 44,
      controlHeightLG: 52,
    },
    Card: {
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
    },
    Input: {
      borderRadius: 12,
      controlHeight: 48,
    },
   Menu: {
  itemBorderRadius: 20,  // 加大圆角变成胶囊形
  itemSelectedBg: 'rgba(168, 85, 247, 0.25)',  // 紫色背景
  itemSelectedColor: '#f8fafc',                // 白色文字
},
    Table: {
      borderRadius: 12,
      headerBg: 'rgba(17, 24, 39, 0.8)',
      headerColor: '#f8fafc',
    },
    Modal: {
      borderRadius: 20,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    Drawer: {
      borderRadius: 0,
    },
    Select: {
      borderRadius: 12,
    },
    Tag: {
      borderRadius: 6,
    },
    Badge: {
      borderRadius: 10,
    },
    Avatar: {
      borderRadius: 12,
    },
    Tabs: {
      inkBarColor: '#00d4ff',
      itemSelectedColor: '#00d4ff',
    },
    Progress: {
      defaultColor: '#00d4ff',
    },
    Tooltip: {
      borderRadius: 8,
    },
    Popover: {
      borderRadius: 12,
    },
    Message: {
      borderRadius: 12,
    },
    Notification: {
      borderRadius: 12,
    },
  },
}

// 隐藏loader
const hideLoader = () => {
  const loader = document.getElementById('loader')
  if (loader) {
    loader.classList.add('hidden')
  }
}

// 应用渲染
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider locale={zhCN} theme={antdTheme}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)

// 延迟隐藏loader确保组件已渲染
setTimeout(hideLoader, 100)
