<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NCard,
  NButton,
  NSpace,
  useMessage
} from 'naive-ui'
import { Copy, Download, Upload } from 'lucide-vue-next'
import MonacoEditor from './MonacoEditor.vue'
import SchemaVisualEditor from './SchemaVisualEditor.vue'
import { validateJsonSchema } from '../lib/schemaValidator'

// 响应式数据
const jsonSchemaText = ref(`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "用户姓名"
    },
    "age": {
      "type": "integer",
      "minimum": 0,
      "description": "用户年龄"
    }
  },
  "required": ["name"]
}`)

const schemaObject = ref<any>({})
const validationErrors = ref<string[]>([])
const validationWarnings = ref<string[]>([])
const isValidSchema = ref(true)
const message = useMessage()

// 解析 JSON Schema 文本
const parseJsonSchema = () => {
  try {
    const parsed = JSON.parse(jsonSchemaText.value)
    schemaObject.value = parsed
    
    // 验证 Schema
    const validation = validateJsonSchema(parsed)
    isValidSchema.value = validation.valid
    validationErrors.value = validation.errors
    validationWarnings.value = validation.warnings || []
    
    if (!validation.valid) {
      message.error(`Schema 验证失败: ${validation.errors.join(', ')}`)
    } else if (validation.warnings && validation.warnings.length > 0) {
      message.warning(`Schema 警告: ${validation.warnings.join(', ')}`)
    }
  } catch (error) {
    isValidSchema.value = false
    validationErrors.value = ['JSON 格式错误']
    validationWarnings.value = []
    message.error('JSON 格式错误')
  }
}

// 监听文本变化
watch(jsonSchemaText, parseJsonSchema, { immediate: true })

// 从可视化编辑器更新 Schema
const updateSchemaFromVisual = (newSchema: any) => {
  schemaObject.value = newSchema
  jsonSchemaText.value = JSON.stringify(newSchema, null, 2)
}

// 复制到剪贴板
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(jsonSchemaText.value)
    message.success('已复制到剪贴板')
  } catch (error) {
    message.error('复制失败')
  }
}

// 粘贴从剪贴板
const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    jsonSchemaText.value = text
    message.success('已从剪贴板粘贴')
  } catch (error) {
    message.error('粘贴失败')
  }
}

// 导出 Schema
const exportSchema = () => {
  const blob = new Blob([jsonSchemaText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schema.json'
  a.click()
  URL.revokeObjectURL(url)
  message.success('Schema 已导出')
}

// 导入 Schema
const importSchema = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        jsonSchemaText.value = content
        message.success('Schema 已导入')
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// 键盘快捷键处理
const handleKeydown = (e: KeyboardEvent) => {
  // Alt+C：复制
  if (e.altKey && e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    copyToClipboard()
    return
  }
  
  // Alt+V：粘贴
  if (e.altKey && e.key === 'v' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    pasteFromClipboard()
    return
  }
  
  // Ctrl+S 或 Cmd+S：导出
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    exportSchema()
    return
  }
  
  // Ctrl+O 或 Cmd+O：导入
  if ((e.ctrlKey || e.metaKey) && e.key === 'o' && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    importSchema()
    return
  }
  
  // Alt+F：格式化
  if (e.altKey && e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    formatJson()
    return
  }
  
  // Alt+M：压缩
  if (e.altKey && e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    minifyJson()
    return
  }
  
  // Alt+G：生成示例数据
  if (e.altKey && e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault()
    generateSampleData()
    return
  }
}

// 格式化 JSON
const formatJson = () => {
  try {
    const parsed = JSON.parse(jsonSchemaText.value)
    jsonSchemaText.value = JSON.stringify(parsed, null, 2)
    message.success('JSON 已格式化')
  } catch (error) {
    message.error('JSON 格式错误，无法格式化')
  }
}

// 压缩 JSON
const minifyJson = () => {
  try {
    const parsed = JSON.parse(jsonSchemaText.value)
    jsonSchemaText.value = JSON.stringify(parsed)
    message.success('JSON 已压缩')
  } catch (error) {
    message.error('JSON 格式错误，无法压缩')
  }
}

// 生成示例数据
const generateSampleData = () => {
  try {
    const schema = JSON.parse(jsonSchemaText.value)
    const sampleData = generateSampleFromSchema(schema)
    
    // 复制示例数据到剪贴板
    navigator.clipboard.writeText(JSON.stringify(sampleData, null, 2))
    message.success('示例数据已生成并复制到剪贴板')
  } catch (error) {
    message.error('无法生成示例数据')
  }
}

// 从 Schema 生成示例数据
const generateSampleFromSchema = (schema: any): any => {
  if (!schema || typeof schema !== 'object') return null
  
  switch (schema.type) {
    case 'string':
      return schema.default || schema.example || 'example string'
    case 'number':
      return schema.default || schema.example || 42
    case 'integer':
      return schema.default || schema.example || 42
    case 'boolean':
      return schema.default !== undefined ? schema.default : true
    case 'array':
      if (schema.items) {
        return [generateSampleFromSchema(schema.items)]
      }
      return []
    case 'object':
      const obj: any = {}
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateSampleFromSchema(propSchema)
        }
      }
      return obj
    default:
      return null
  }
}

// 组件挂载时添加键盘事件监听
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时移除键盘事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="h-screen flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="border-b border-gray-200 p-4 bg-white">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Fox JSON Schema Editor</h1>
        <NSpace>
          <NButton @click="pasteFromClipboard" secondary title="粘贴 (Alt+V)">
            <template #icon>
              <Upload :size="16" />
            </template>
            粘贴
          </NButton>
          <NButton @click="copyToClipboard" secondary title="复制 (Alt+C)">
            <template #icon>
              <Copy :size="16" />
            </template>
            复制
          </NButton>
          <NButton @click="formatJson" secondary title="格式化 JSON (Alt+F)">
            格式化
          </NButton>
          <NButton @click="minifyJson" secondary title="压缩 JSON (Alt+M)">
            压缩
          </NButton>
          <NButton @click="generateSampleData" secondary title="生成示例数据 (Alt+G)">
            示例数据
          </NButton>
          <NButton @click="importSchema" secondary title="导入文件 (Ctrl+O)">
            导入
          </NButton>
          <NButton @click="exportSchema" type="primary" title="导出文件 (Ctrl+S)">
            <template #icon>
              <Download :size="16" />
            </template>
            导出
          </NButton>
        </NSpace>
      </div>
      
      <!-- 验证状态和快捷键提示 -->
      <div class="mt-2 flex items-center justify-between">
        <div class="flex-1">
          <div v-if="isValidSchema" class="text-green-600 text-sm">
            ✓ Schema 格式正确
            <span v-if="validationWarnings.length > 0" class="text-yellow-600 ml-2">
              ({{ validationWarnings.length }} 个警告)
            </span>
          </div>
          <div v-else class="text-red-600 text-sm">
            ✗ Schema 验证失败: {{ validationErrors.join(', ') }}
          </div>
          <div v-if="validationWarnings.length > 0" class="text-yellow-600 text-xs mt-1">
            ⚠ 警告: {{ validationWarnings.join('; ') }}
          </div>
        </div>
        <div class="text-xs text-gray-500 ml-4">
          快捷键: Alt+C(复制) | Alt+V(粘贴) | Alt+F(格式化) | Alt+M(压缩) | Alt+G(示例) | Ctrl+S(导出) | Ctrl+O(导入)
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="flex-1 overflow-hidden">
      <NLayout has-sider class="h-full">
        <!-- 左侧：JSON Schema 原文 -->
        <NLayoutSider
          bordered
          :width="600"
          :min-width="400"
          :max-width="800"
          show-trigger
          collapse-mode="width"
          :collapsed-width="0"
        >
          <div class="h-full flex flex-col">
            <div class="p-4 border-b border-gray-200 bg-gray-50">
              <h2 class="text-lg font-semibold text-gray-800">JSON Schema 原文</h2>
              <p class="text-sm text-gray-600 mt-1">支持语法高亮和格式化</p>
            </div>
            <div class="flex-1 overflow-hidden">
              <MonacoEditor
                v-model:value="jsonSchemaText"
                language="json"
                :options="{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto'
                  },
                  automaticLayout: true
                }"
              />
            </div>
          </div>
        </NLayoutSider>

        <!-- 右侧：可视化编辑界面 -->
        <NLayoutContent class="h-full">
          <div class="h-full flex flex-col">
            <div class="p-4 border-b border-gray-200 bg-gray-50">
              <h2 class="text-lg font-semibold text-gray-800">可视化编辑器</h2>
              <p class="text-sm text-gray-600 mt-1">拖拽和表单方式编辑 Schema</p>
            </div>
            <div class="flex-1 overflow-auto p-4">
              <SchemaVisualEditor
                :schema="schemaObject"
                @update:schema="updateSchemaFromVisual"
              />
            </div>
          </div>
        </NLayoutContent>
      </NLayout>
    </div>
  </div>
</template>

<style scoped>
.n-layout-sider .n-layout-toggle-button {
  top: 50%;
  transform: translateY(-50%);
}
</style>