项目名：Fox Json Shema Editor
使用技术栈：Vite + Vue3 + TypeScript + NaiveUI
使用环境： Node.JS Pnpm 包管理器
项目目标：  
实现一个基于 Vue3 的 Json Schema 编辑器，可选默认值（默认值为空则认为是没有默认值）。
界面使用左右布局，左侧为JsonShame原文（需要染色并且优化层级格式），右侧为JsonSchema的可视化编辑界面。
需要支持 Number , Integer , String, Boolean, Array, Object 这 6 种类型。
你需要支持Array和Object的嵌套。
需要支持粘贴输入，和快捷复制JsonSchema原文。
需要支持JsonSchema的校验。