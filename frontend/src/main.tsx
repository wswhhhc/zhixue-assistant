import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'katex/dist/katex.min.css'
import './styles/tech-design-system.css'
import App from './App.tsx'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

// 动态 Ant Design 主题配置
function ThemedApp() {
  const { isDark } = useTheme()

  const antdTheme = isDark ? {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#00d4ff',
      colorPrimaryHover: '#22d3ee',
      colorPrimaryActive: '#00a8cc',
      colorBgBase: '#030712',
      colorBgContainer: '#111827',
      colorBgElevated: '#0a0f1c',
      colorText: '#f8fafc',
      colorTextSecondary: '#94a3b8',
      colorTextTertiary: '#64748b',
      colorBorder: 'rgba(148, 163, 184, 0.1)',
      colorBorderSecondary: 'rgba(148, 163, 184, 0.08)',
      borderRadius: 12,
      borderRadiusSM: 8,
      borderRadiusLG: 16,
      borderRadiusXL: 24,
      fontFamily: "'Noto Sans SC', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontFamilyCode: "'JetBrains Mono', 'Consolas', monospace",
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      paddingContentHorizontal: 16,
      paddingContentVertical: 12,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
      boxShadowSecondary: '0 8px 32px rgba(0, 0, 0, 0.4)',
      motionDurationFast: '0.15s',
      motionDurationMid: '0.25s',
      motionDurationSlow: '0.35s',
    },
    components: {
      Button: { borderRadius: 10, controlHeight: 44, controlHeightLG: 52 },
      Card: { borderRadius: 16, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)' },
      Input: { borderRadius: 12, controlHeight: 48 },
      Menu: {
        itemBorderRadius: 20,
        itemSelectedBg: 'rgba(168, 85, 247, 0.25)',
        itemSelectedColor: '#f8fafc',
      },
      Table: { borderRadius: 12, headerBg: 'rgba(15, 23, 42, 0.8)', headerColor: '#f8fafc' },
      Modal: { borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' },
      Select: { borderRadius: 12 },
      Tag: { borderRadius: 6 },
      Badge: { borderRadius: 10 },
      Avatar: { borderRadius: 12 },
      Tabs: { inkBarColor: '#00d4ff', itemSelectedColor: '#00d4ff' },
      Progress: { defaultColor: '#00d4ff' },
      Tooltip: { borderRadius: 8 },
      Popover: { borderRadius: 12 },
      Message: { borderRadius: 12 },
      Notification: { borderRadius: 12 },
    },
  } : {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#0284c7',
      colorPrimaryHover: '#0891b2',
      colorPrimaryActive: '#0369a1',
      colorBgBase: '#f8fafc',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorText: '#0f172a',
      colorTextSecondary: '#475569',
      colorTextTertiary: '#94a3b8',
      colorBorder: 'rgba(100, 116, 139, 0.15)',
      colorBorderSecondary: 'rgba(100, 116, 139, 0.1)',
      borderRadius: 12,
      borderRadiusSM: 8,
      borderRadiusLG: 16,
      borderRadiusXL: 24,
      fontFamily: "'Noto Sans SC', 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontFamilyCode: "'JetBrains Mono', 'Consolas', monospace",
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      paddingContentHorizontal: 16,
      paddingContentVertical: 12,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
      boxShadowSecondary: '0 8px 32px rgba(0, 0, 0, 0.08)',
      motionDurationFast: '0.15s',
      motionDurationMid: '0.25s',
      motionDurationSlow: '0.35s',
    },
    components: {
      Button: { borderRadius: 10, controlHeight: 44, controlHeightLG: 52 },
      Card: { borderRadius: 16, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)' },
      Input: { borderRadius: 12, controlHeight: 48 },
      Menu: {
        itemBorderRadius: 20,
        itemSelectedBg: 'rgba(99, 102, 241, 0.12)',
        itemSelectedColor: '#4f46e5',
      },
      Table: { borderRadius: 12, headerBg: 'rgba(248, 250, 252, 0.9)', headerColor: '#0f172a' },
      Modal: { borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' },
      Select: { borderRadius: 12 },
      Tag: { borderRadius: 6 },
      Badge: { borderRadius: 10 },
      Avatar: { borderRadius: 12 },
      Tabs: { inkBarColor: '#0284c7', itemSelectedColor: '#0284c7' },
      Progress: { defaultColor: '#0284c7' },
      Tooltip: { borderRadius: 8 },
      Popover: { borderRadius: 12 },
      Message: { borderRadius: 12 },
      Notification: { borderRadius: 12 },
    },
  }

  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <App />
    </ConfigProvider>
  )
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
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

// 延迟隐藏loader确保组件已渲染
setTimeout(hideLoader, 100)
