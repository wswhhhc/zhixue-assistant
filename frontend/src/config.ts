// Docker 构建时可通过 VITE_API_BASE 环境变量覆盖，留空则使用相对路径（同源）
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
