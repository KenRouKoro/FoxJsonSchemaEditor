<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import loader from '@monaco-editor/loader'

interface Props {
  value: string
  language?: string
  options?: monaco.editor.IStandaloneEditorConstructionOptions
  height?: string | number
  width?: string | number
}

interface Emits {
  (e: 'update:value', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  language: 'json',
  options: () => ({}),
  height: '100%',
  width: '100%'
})

const emit = defineEmits<Emits>()

const editorContainer = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let isEditorReady = ref(false)

// 默认编辑器选项
const defaultOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'vs',
  fontSize: 14,
  lineNumbers: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  formatOnPaste: true,
  formatOnType: true
}

// 初始化编辑器
const initEditor = async () => {
  if (!editorContainer.value) return

  try {
    // 配置 Monaco Editor
    loader.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'
      }
    })

    const monacoInstance = await loader.init()
    
    // 创建编辑器实例
    editor = monacoInstance.editor.create(editorContainer.value, {
      ...defaultOptions,
      ...props.options,
      value: props.value,
      language: props.language
    })

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
      if (editor) {
        const value = editor.getValue()
        emit('update:value', value)
        emit('change', value)
      }
    })

    // 设置 JSON Schema 验证
    if (props.language === 'json') {
      monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
        enableSchemaRequest: true
      })
    }

    isEditorReady.value = true
  } catch (error) {
    console.error('Failed to initialize Monaco Editor:', error)
  }
}

// 更新编辑器值
const updateEditorValue = (newValue: string) => {
  if (editor && isEditorReady.value) {
    const currentValue = editor.getValue()
    if (currentValue !== newValue) {
      editor.setValue(newValue)
    }
  }
}

// 格式化代码
const formatCode = () => {
  if (editor && isEditorReady.value) {
    editor.getAction('editor.action.formatDocument')?.run()
  }
}

// 监听 props 变化
watch(() => props.value, updateEditorValue)
watch(() => props.language, (newLanguage) => {
  if (editor && isEditorReady.value) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
    }
  }
})

// 组件挂载
onMounted(async () => {
  await nextTick()
  await initEditor()
})

// 组件卸载
onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})

// 暴露方法
defineExpose({
  formatCode,
  getEditor: () => editor
})
</script>

<template>
  <div 
    ref="editorContainer" 
    class="monaco-editor-container"
    :style="{
      height: typeof height === 'number' ? `${height}px` : height,
      width: typeof width === 'number' ? `${width}px` : width
    }"
  />
</template>

<style scoped>
.monaco-editor-container {
  border: 1px solid #e5e7eb;
  border-radius: 0;
  overflow: hidden;
}

.monaco-editor-container :deep(.monaco-editor) {
  background-color: #fafafa;
}

.monaco-editor-container :deep(.monaco-editor .margin) {
  background-color: #f5f5f5;
}

.monaco-editor-container :deep(.monaco-editor .monaco-editor-background) {
  background-color: #fafafa;
}
</style>