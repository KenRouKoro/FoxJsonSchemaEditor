# Fox JSON Schema Editor

一个基于 Vue3 的可视化 JSON Schema 编辑器，提供直观的界面来创建和编辑 JSON Schema。

## ✨ 特性

- 🎨 **可视化编辑** - 左右分栏布局，左侧代码编辑器，右侧可视化编辑界面
- 📝 **语法高亮** - 基于 Monaco Editor 的代码编辑器，支持语法高亮和格式化
- 🔧 **类型支持** - 支持 String、Number、Integer、Boolean、Array、Object 六种基本类型
- 🔄 **实时同步** - 代码编辑器与可视化编辑器实时双向同步
- ✅ **Schema 验证** - 内置 AJV 验证器，实时检查 Schema 有效性
- 📋 **便捷操作** - 支持复制粘贴、导入导出、一键格式化
- 🎯 **嵌套支持** - 完整支持 Array 和 Object 的深度嵌套

## 🚀 快速开始

### 环境要求

- Node.js >= 16
- pnpm

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

## 🛠️ 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI 组件**: Naive UI
- **代码编辑器**: Monaco Editor
- **样式**: Tailwind CSS
- **Schema 验证**: AJV
- **图标**: Lucide Vue Next

## 📖 使用说明

1. **左侧编辑器**: 直接编辑 JSON Schema 代码，支持语法高亮和自动补全
2. **右侧面板**: 通过可视化界面添加、编辑、删除 Schema 属性
3. **工具栏**: 提供复制、粘贴、导入、导出等便捷操作
4. **实时验证**: 编辑过程中实时验证 Schema 格式和语法

## 📄 许可证

MIT License
