<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NIcon,
  NTooltip,
  NAlert
} from 'naive-ui'
import {
  FileText,
  Download,
  Upload,
  RefreshCw
} from 'lucide-vue-next'
import { getDefaultSchemaForType, type SupportedType } from '../lib/schemaValidator'
import PropertyEditor from './PropertyEditor.vue'

// 定义 Schema 类型
interface JsonSchema {
  type?: SupportedType
  title?: string
  description?: string
  default?: any
  [key: string]: any
}

interface Props {
  schema: JsonSchema
  maxDepth?: number
}

interface Emits {
  (e: 'update:schema', schema: JsonSchema): void
}

const props = withDefaults(defineProps<Props>(), {
  maxDepth: 10
})
const emit = defineEmits<Emits>()

// 本地 schema 副本
const localSchema = ref<JsonSchema>(getDefaultSchemaForType('object'))

// 初始化本地 schema
watch(() => props.schema, (newSchema) => {
  if (newSchema && Object.keys(newSchema).length > 0) {
    localSchema.value = JSON.parse(JSON.stringify(newSchema))
  } else {
    localSchema.value = getDefaultSchemaForType('object')
  }
}, { immediate: true, deep: true })

// 更新 schema
const updateSchema = (newSchema: JsonSchema) => {
  localSchema.value = newSchema
  emit('update:schema', JSON.parse(JSON.stringify(newSchema)))
}

// 发送更新事件
const emitUpdate = () => {
  emit('update:schema', JSON.parse(JSON.stringify(localSchema.value)))
}

// 重置 schema
const resetSchema = () => {
  const newSchema = getDefaultSchemaForType('object')
  updateSchema(newSchema)
}

// 导出 schema
const exportSchema = () => {
  const dataStr = JSON.stringify(localSchema.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'schema.json'
  link.click()
  URL.revokeObjectURL(url)
}

// 导入 schema
const importSchema = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target?.result as string)
          updateSchema(schema)
        } catch (error) {
          console.error('导入失败:', error)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// 计算 schema 统计信息
const schemaStats = computed(() => {
  const countProperties = (schema: JsonSchema): number => {
    let count = 0
    if (schema.properties) {
      count += Object.keys(schema.properties).length
      Object.values(schema.properties).forEach(prop => {
        count += countProperties(prop)
      })
    }
    if (schema.items) {
      count += countProperties(schema.items)
    }
    return count
  }
  
  const totalProperties = countProperties(localSchema.value)
  const schemaType = localSchema.value.type || 'object'
  
  return {
    type: schemaType,
    totalProperties,
    hasTitle: !!localSchema.value.title,
    hasDescription: !!localSchema.value.description
  }
})

// 拖拽相关状态
const draggedItem = ref<string | null>(null)
const dragOverItem = ref<string | null>(null)
const draggedItemData = ref<{ key: string, schema: JsonSchema, parentPath: string } | null>(null)
const dropZones = ref<Set<string>>(new Set())
const dragError = ref<string | null>(null)
const showDragError = ref(false)

// 拖拽模式和占位符相关状态
const dragMode = ref<'sort' | 'nest' | null>(null)
const dragPlaceholder = ref<{ position: 'before' | 'after' | 'inside', targetKey: string, parentPath: string } | null>(null)
const sortDropZones = ref<Set<string>>(new Set())

// 获取属性的完整路径
const getPropertyPath = (key: string, parentPath = '') => {
  return parentPath ? `${parentPath}.${key}` : key
}

// 检查是否可以拖拽到目标位置
const canDropToTarget = (sourceKey: string, targetKey: string, targetSchema: JsonSchema): boolean => {
  // 不能拖拽到自己
  if (sourceKey === targetKey) return false
  
  // 不能拖拽到自己的子属性中（避免循环引用）
  if (targetKey.startsWith(sourceKey + '.')) return false
  
  // 目标必须是对象类型才能接收子属性
  if (targetSchema.type !== 'object') return false
  
  // 检查目标对象是否已经存在同名属性
  if (draggedItemData.value && targetSchema.properties) {
    const sourcePropertyName = draggedItemData.value.key
    if (targetSchema.properties[sourcePropertyName]) {
      return false // 目标对象已存在同名属性
    }
  }
  
  // 检查是否会造成深度嵌套（限制最大嵌套深度为10层）
  const targetDepth = targetKey.split('.').length
  if (targetDepth >= 10) return false
  
  return true
}

// 验证Schema结构完整性
const validateSchemaIntegrity = (schema: JsonSchema): { isValid: boolean, errors: string[] } => {
  const errors: string[] = []
  
  // 检查基本结构
  if (!schema.type) {
    errors.push('Schema缺少type字段')
  }
  
  // 检查对象类型的完整性
  if (schema.type === 'object') {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        if (!key || key.trim() === '') {
          errors.push('发现空的属性名')
        }
        
        const typedPropSchema = propSchema as JsonSchema
        if (!typedPropSchema.type) {
          errors.push(`属性 "${key}" 缺少type字段`)
        }
        
        // 递归检查嵌套对象
        if (typedPropSchema.type === 'object') {
          const nestedValidation = validateSchemaIntegrity(typedPropSchema)
          errors.push(...nestedValidation.errors.map(err => `${key}.${err}`))
        }
      })
    }
    
    // 检查required数组的有效性
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach(requiredKey => {
        if (!schema.properties || !schema.properties[requiredKey]) {
          errors.push(`required数组中的属性 "${requiredKey}" 在properties中不存在`)
        }
      })
    }
  }
  
  // 检查数组类型的完整性
  if (schema.type === 'array') {
    if (!schema.items) {
      errors.push('数组类型缺少items定义')
    } else {
      const itemsValidation = validateSchemaIntegrity(schema.items)
      errors.push(...itemsValidation.errors.map(err => `items.${err}`))
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// 拖拽开始
const handleDragStart = (e: DragEvent, key: string, schema?: JsonSchema, parentPath = '') => {
  const fullPath = getPropertyPath(key, parentPath)
  draggedItem.value = fullPath
  
  // 存储拖拽项的详细信息
  if (schema) {
    draggedItemData.value = {
      key,
      schema: JSON.parse(JSON.stringify(schema)),
      parentPath
    }
  }
  
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', fullPath)
  }
  
  // 计算所有可能的放置区域（嵌套模式）
  updateDropZones()
  
  // 计算排序放置区域
  updateSortDropZones()
}

// 更新可放置区域（嵌套模式）
const updateDropZones = () => {
  dropZones.value.clear()
  if (!draggedItem.value) return
  
  const addDropZones = (schema: JsonSchema, path = '') => {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const fullPath = getPropertyPath(key, path)
        
        const typedPropSchema = propSchema as JsonSchema
        // 如果是对象类型，可以作为放置目标
        if (typedPropSchema.type === 'object' && canDropToTarget(draggedItem.value!, fullPath, typedPropSchema)) {
          dropZones.value.add(fullPath)
        }
        
        // 递归处理嵌套对象
        if (typedPropSchema.type === 'object' && typedPropSchema.properties) {
          addDropZones(typedPropSchema, fullPath)
        }
      })
    }
  }
  
  addDropZones(localSchema.value)
}

// 更新排序放置区域
const updateSortDropZones = () => {
  sortDropZones.value.clear()
  if (!draggedItem.value || !draggedItemData.value) return
  
  const draggedParentPath = draggedItemData.value.parentPath
  
  // 获取同级的所有属性
  const parentSchema = draggedParentPath ? getSchemaByPath(draggedParentPath) : localSchema.value
  if (parentSchema && parentSchema.properties) {
    Object.keys(parentSchema.properties).forEach(key => {
      const fullPath = getPropertyPath(key, draggedParentPath)
      if (fullPath !== draggedItem.value) {
        sortDropZones.value.add(fullPath)
      }
    })
  }
}

// 拖拽结束
const handleDragEnd = () => {
  // 清理所有拖拽相关状态
  draggedItem.value = null
  dragOverItem.value = null
  draggedItemData.value = null
  dropZones.value.clear()
  sortDropZones.value.clear()
  dragMode.value = null
  dragPlaceholder.value = null
  
  // 确保清理任何残留的视觉效果
  setTimeout(() => {
    dragMode.value = null
    dragPlaceholder.value = null
  }, 50)
}

// 拖拽进入
const handleDragEnter = (e: DragEvent, key: string, parentPath = '') => {
  e.preventDefault()
  const fullPath = getPropertyPath(key, parentPath)
  
  if (draggedItem.value && draggedItem.value !== fullPath) {
    // 只有在可放置区域才显示拖拽悬停效果
    if (dropZones.value.has(fullPath) || sortDropZones.value.has(fullPath)) {
      dragOverItem.value = fullPath
    }
  }
}

// 拖拽离开
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  if (e.target === e.currentTarget) {
    dragOverItem.value = null
    // 清理占位符状态
    dragMode.value = null
    dragPlaceholder.value = null
  }
}

// 拖拽悬停
const handleDragOver = (e: DragEvent, key?: string, parentPath = '') => {
  e.preventDefault()
  
  if (!key || !draggedItem.value || !draggedItemData.value) {
    // 清理状态
    dragMode.value = null
    dragPlaceholder.value = null
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'none'
    }
    return
  }
  
  const fullPath = getPropertyPath(key, parentPath)
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseY = e.clientY
  const elementTop = rect.top
  const elementHeight = rect.height
  const relativeY = mouseY - elementTop
  
  // 判断拖拽模式 - 优先级：排序 > 嵌套
  const isNestTarget = dropZones.value.has(fullPath)
  const isSortTarget = sortDropZones.value.has(fullPath)
  
  // 先清理之前的状态
  dragMode.value = null
  dragPlaceholder.value = null
  
  if (isSortTarget) {
    // 排序模式：优先处理排序
    dragMode.value = 'sort'
    const position = relativeY < elementHeight / 2 ? 'before' : 'after'
    dragPlaceholder.value = { position, targetKey: key, parentPath }
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  } else if (isNestTarget && relativeY > elementHeight * 0.25 && relativeY < elementHeight * 0.75) {
    // 嵌套模式：鼠标在元素中间区域且不是排序目标
    dragMode.value = 'nest'
    dragPlaceholder.value = { position: 'inside', targetKey: key, parentPath }
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  } else {
    // 无效区域
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'none'
    }
  }
}

// 显示拖拽消息提示
const showDragMessage = (message: string) => {
  dragError.value = message
  showDragError.value = true
  setTimeout(() => {
    showDragError.value = false
    setTimeout(() => {
      dragError.value = null
    }, 300)
  }, 3000)
}

// 拖拽放置
const handleDrop = (e: DragEvent, targetKey: string, targetSchema: JsonSchema, parentPath = '') => {
  e.preventDefault()
  
  const sourceKey = draggedItem.value
  const targetPath = getPropertyPath(targetKey, parentPath)
  
  if (!sourceKey || !draggedItemData.value || !dragMode.value) {
    handleDragEnd()
    return
  }
  
  try {
    if (dragMode.value === 'sort') {
      // 排序模式：在同级重新排序
      performSortDrag(draggedItemData.value, targetKey, parentPath)
      showDragMessage(`成功将属性 "${draggedItemData.value.key}" 重新排序`)
    } else if (dragMode.value === 'nest') {
      // 嵌套模式：移动到子对象中
      if (!canDropToTarget(sourceKey, targetPath, targetSchema)) {
        let errorMessage = `无法将属性 "${draggedItemData.value.key}" 拖拽到 "${targetKey}"`
        
        // 提供具体的错误原因
        if (sourceKey === targetPath) {
          errorMessage += '：不能拖拽到自己'
        } else if (targetPath.startsWith(sourceKey + '.')) {
          errorMessage += '：不能拖拽到自己的子属性中（避免循环引用）'
        } else if (targetSchema.type !== 'object') {
          errorMessage += '：目标不是对象类型'
        } else if (targetSchema.properties && targetSchema.properties[draggedItemData.value.key]) {
          errorMessage += '：目标对象已存在同名属性'
        } else if (targetPath.split('.').length >= 10) {
          errorMessage += '：嵌套层级过深（最大支持10层）'
        } else {
          errorMessage += '：未知原因'
        }
        
        showDragMessage(errorMessage)
        handleDragEnd()
        return
      }
      
      performCrossLevelDrag(draggedItemData.value, targetPath, targetSchema)
      showDragMessage(`成功将属性 "${draggedItemData.value.key}" 移动到 "${targetKey}" 中`)
    }
  } catch (error) {
    showDragMessage(`拖拽操作失败：${error instanceof Error ? error.message : '未知错误'}`)
  }
  
  handleDragEnd()
}

// 执行排序拖拽
const performSortDrag = (dragData: { key: string, schema: JsonSchema, parentPath: string }, targetKey: string, targetParentPath: string) => {
  // 确保是同级排序
  if (dragData.parentPath !== targetParentPath) {
    throw new Error('只能在同级属性间进行排序')
  }
  
  const parentSchema = targetParentPath ? getSchemaByPath(targetParentPath) : localSchema.value
  if (!parentSchema || !parentSchema.properties) {
    throw new Error('无法找到父级Schema')
  }
  
  // 获取当前位置信息
  const position = dragPlaceholder.value?.position
  if (!position || position === 'inside') {
    throw new Error('无效的排序位置')
  }
  
  // 执行重新排序
  const entries = Object.entries(parentSchema.properties)
  const sourceIndex = entries.findIndex(([key]) => key === dragData.key)
  const targetIndex = entries.findIndex(([key]) => key === targetKey)
  
  if (sourceIndex === -1 || targetIndex === -1) {
    throw new Error('无法找到源属性或目标属性')
  }
  
  // 如果源和目标相同，不需要移动
  if (sourceIndex === targetIndex) {
    return
  }
  
  // 移动元素 - 先计算插入位置，再移动
  const [sourceEntry] = entries.splice(sourceIndex, 1)
  
  // 计算正确的插入位置（考虑移除源元素后索引的变化）
  let insertIndex: number
  if (position === 'before') {
    // 插入到目标元素之前
    insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  } else { // position === 'after'
    // 插入到目标元素之后
    insertIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1
  }
  
  // 确保插入位置在有效范围内
  insertIndex = Math.max(0, Math.min(insertIndex, entries.length))
  
  entries.splice(insertIndex, 0, sourceEntry)
  
  // 重建 properties 对象
  const newProperties: Record<string, JsonSchema> = {}
  entries.forEach(([key, value]) => {
    newProperties[key] = value
  })
  
  parentSchema.properties = newProperties
  emitUpdate()
}

// 执行跨层级拖拽
const performCrossLevelDrag = (dragData: { key: string, schema: JsonSchema, parentPath: string }, targetPath: string, targetSchema: JsonSchema) => {
  // 创建Schema的深拷贝用于验证
  const backupSchema = JSON.parse(JSON.stringify(localSchema.value))
  
  try {
    // 从源位置移除属性
    removePropertyFromPath(dragData.key, dragData.parentPath)
    
    // 添加到目标位置
    addPropertyToTarget(dragData.key, dragData.schema, targetPath, targetSchema)
    
    // 验证操作后的Schema完整性
    const validation = validateSchemaIntegrity(localSchema.value)
    if (!validation.isValid) {
      // 如果验证失败，恢复备份
      localSchema.value = backupSchema
      throw new Error(`Schema结构验证失败: ${validation.errors.join(', ')}`)
    }
    
    // 验证成功，发送更新事件
    emitUpdate()
  } catch (error) {
    // 发生错误时恢复备份
    localSchema.value = backupSchema
    throw error
  }
}

// 从指定路径移除属性
const removePropertyFromPath = (key: string, parentPath: string) => {
  if (!parentPath) {
    // 从根对象移除
    if (localSchema.value.properties) {
      delete localSchema.value.properties[key]
      
      // 同时从 required 数组中移除
      if (localSchema.value.required) {
        const index = localSchema.value.required.indexOf(key)
        if (index > -1) {
          localSchema.value.required.splice(index, 1)
        }
      }
    }
  } else {
    // 从嵌套对象移除
    const parentSchema = getSchemaByPath(parentPath)
    if (parentSchema && parentSchema.properties) {
      delete parentSchema.properties[key]
      
      // 同时从 required 数组中移除
      if (parentSchema.required) {
        const index = parentSchema.required.indexOf(key)
        if (index > -1) {
          parentSchema.required.splice(index, 1)
        }
      }
    }
  }
}

// 添加属性到目标对象
const addPropertyToTarget = (key: string, schema: JsonSchema, targetPath: string, targetSchema: JsonSchema) => {
  if (!targetSchema.properties) {
    targetSchema.properties = {}
  }
  
  // 确保属性名唯一
  let newKey = key
  let counter = 1
  while (targetSchema.properties[newKey]) {
    newKey = `${key}_${counter}`
    counter++
  }
  
  targetSchema.properties[newKey] = schema
}

// 根据路径获取 Schema
const getSchemaByPath = (path: string): JsonSchema | null => {
  const parts = path.split('.')
  let current = localSchema.value
  
  for (const part of parts) {
    if (current.properties && current.properties[part]) {
      current = current.properties[part]
    } else {
      return null
    }
  }
  
  return current
}

// 重新排序对象属性
const reorderObjectProperties = (schema: JsonSchema, sourceKey: string, targetKey: string) => {
  if (!schema.properties) return
  
  const entries = Object.entries(schema.properties)
  const sourceIndex = entries.findIndex(([key]) => key === sourceKey)
  const targetIndex = entries.findIndex(([key]) => key === targetKey)
  
  if (sourceIndex === -1 || targetIndex === -1) return
  
  // 移动元素
  const [sourceEntry] = entries.splice(sourceIndex, 1)
  entries.splice(targetIndex, 0, sourceEntry)
  
  // 重建 properties 对象
  const newProperties: Record<string, JsonSchema> = {}
  entries.forEach(([key, value]) => {
    newProperties[key] = value
  })
  
  schema.properties = newProperties
  emitUpdate()
}

// 切换属性必需状态
const togglePropertyRequired = (schema: JsonSchema, key: string) => {
  if (!schema.required) schema.required = []
  
  const index = schema.required.indexOf(key)
  if (index > -1) {
    schema.required.splice(index, 1)
  } else {
    schema.required.push(key)
  }
  
  emitUpdate()
}

// 检查属性是否必需
const isPropertyRequired = (schema: JsonSchema, key: string): boolean => {
  return schema.required && Array.isArray(schema.required) && schema.required.includes(key)
}

// 更新数组项类型
const updateArrayItemType = (schema: JsonSchema, type: SupportedType) => {
  schema.items = getDefaultSchemaForType(type)
  emitUpdate()
}

// 更新基本字段
const updateField = (field: string, value: any) => {
  ;(localSchema.value as any)[field] = value
  emitUpdate()
}
</script>

<template>
  <div class="schema-editor">
    <!-- 头部工具栏 -->
    <NCard size="small" class="mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <NIcon :component="FileText" :size="20" />
            <span>JSON Schema 编辑器</span>
          </div>
          
          <!-- 统计信息 -->
          <div class="flex items-center gap-4 text-sm text-gray-600">
            <span>类型: {{ schemaStats.type }}</span>
            <span>属性数: {{ schemaStats.totalProperties }}</span>
          </div>
        </div>
      </template>
      
      <!-- 工具按钮 -->
      <NSpace>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton secondary @click="resetSchema">
              <template #icon>
                <NIcon :component="RefreshCw" />
              </template>
              重置
            </NButton>
          </template>
          重置为默认对象类型
        </NTooltip>
        
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton secondary @click="importSchema">
              <template #icon>
                <NIcon :component="Upload" />
              </template>
              导入
            </NButton>
          </template>
          从JSON文件导入Schema
        </NTooltip>
        
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton type="primary" @click="exportSchema">
              <template #icon>
                <NIcon :component="Download" />
              </template>
              导出
            </NButton>
          </template>
          导出Schema为JSON文件
        </NTooltip>
      </NSpace>
    </NCard>
    
    <!-- Schema 编辑区域 -->
    <!-- 主要编辑区域 -->
    <div v-if="Object.keys(localSchema).length > 0">
      <PropertyEditor
        :schema="localSchema"
        :max-depth="maxDepth"
        :show-type-selector="true"
        :show-card="true"
        @update:schema="updateSchema"
      />
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <NAlert type="info" :show-icon="false">
        <div class="text-center py-8">
          <NIcon :component="FileText" :size="48" class="text-gray-400 mb-4" />
          <p class="text-gray-600 mb-4">暂无Schema数据</p>
          <NButton type="primary" @click="resetSchema">
            创建新Schema
          </NButton>
        </div>
      </NAlert>
    </div>
  </div>
</template>
<style scoped>
.schema-editor {
  max-width: 100%;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.toolbar h2 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: #666;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.empty-state p {
  margin: 0 0 24px 0;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .stats {
    justify-content: center;
  }
  
  .actions {
    justify-content: center;
  }
}
</style>