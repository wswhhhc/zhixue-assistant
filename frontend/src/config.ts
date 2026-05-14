// 开发环境默认直连本地后端，部署时可通过 VITE_API_BASE 覆盖
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
