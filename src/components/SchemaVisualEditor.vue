<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NButton,
  NSpace,
  NCollapse,
  NCollapseItem,
  NTag,
  NPopconfirm,
  NIcon,
  NTooltip
} from 'naive-ui'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Type,
  Hash,
  ToggleLeft,
  List,
  Braces,
  Move
} from 'lucide-vue-next'
import { SUPPORTED_TYPES, getDefaultSchemaForType, type SupportedType } from '../lib/schemaValidator'

// 定义 Schema 类型
interface JsonSchema {
  type?: SupportedType
  title?: string
  description?: string
  default?: any
  // 字符串类型
  minLength?: number
  maxLength?: number
  pattern?: string
  // 数字类型
  minimum?: number
  maximum?: number
  multipleOf?: number
  // 数组类型
  items?: JsonSchema
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  // 对象类型
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  minProperties?: number
  maxProperties?: number
  // 其他
  enum?: any[]
  const?: any
  [key: string]: any
}

interface Props {
  schema: JsonSchema
}

interface Emits {
  (e: 'update:schema', schema: JsonSchema): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地 schema 副本
const localSchema = ref<JsonSchema>({})

// 类型选项
const typeOptions = SUPPORTED_TYPES.map(type => ({
  label: getTypeLabel(type),
  value: type
}))

// 获取类型标签
function getTypeLabel(type: SupportedType): string {
  const labels: Record<SupportedType, string> = {
    string: '字符串',
    number: '数字',
    integer: '整数',
    boolean: '布尔值',
    array: '数组',
    object: '对象'
  }
  return labels[type]
}

// 获取类型图标
function getTypeIcon(type: SupportedType) {
  const icons: Record<SupportedType, any> = {
    string: Type,
    number: Hash,
    integer: Hash,
    boolean: ToggleLeft,
    array: List,
    object: Braces
  }
  return icons[type]
}

// 初始化本地 schema
watch(() => props.schema, (newSchema) => {
  if (newSchema && Object.keys(newSchema).length > 0) {
    localSchema.value = JSON.parse(JSON.stringify(newSchema))
  } else {
    localSchema.value = getDefaultSchemaForType('object')
  }
}, { immediate: true, deep: true })

// 发送更新事件
const emitUpdate = () => {
  emit('update:schema', JSON.parse(JSON.stringify(localSchema.value)))
}

// 更新 schema 类型
const updateSchemaType = (type: SupportedType) => {
  const newSchema = getDefaultSchemaForType(type) as JsonSchema
  
  // 保留一些通用属性
  if (localSchema.value.title) newSchema.title = localSchema.value.title
  if (localSchema.value.description) newSchema.description = localSchema.value.description
  if (localSchema.value.default !== undefined) {
    // 根据新类型调整默认值
    try {
      if (type === 'string') newSchema.default = String(localSchema.value.default)
      else if (type === 'number' || type === 'integer') newSchema.default = Number(localSchema.value.default)
      else if (type === 'boolean') newSchema.default = Boolean(localSchema.value.default)
      else if (type === 'array') newSchema.default = Array.isArray(localSchema.value.default) ? localSchema.value.default : []
      else if (type === 'object') newSchema.default = typeof localSchema.value.default === 'object' ? localSchema.value.default : {}
    } catch {
      // 如果转换失败，使用类型默认值
    }
  }
  
  localSchema.value = newSchema
  emitUpdate()
}

// 添加对象属性
const addObjectProperty = (schema: JsonSchema) => {
  if (!schema.properties) schema.properties = {}
  
  let newKey = 'newProperty'
  let counter = 1
  while (schema.properties[newKey]) {
    newKey = `newProperty${counter}`
    counter++
  }
  
  schema.properties[newKey] = getDefaultSchemaForType('string')
  emitUpdate()
}

// 删除对象属性
const removeObjectProperty = (schema: JsonSchema, key: string) => {
  if (schema.properties) {
    delete schema.properties[key]
    
    // 同时从 required 数组中移除
    if (schema.required && Array.isArray(schema.required)) {
      const index = schema.required.indexOf(key)
      if (index > -1) {
        schema.required.splice(index, 1)
      }
    }
    
    emitUpdate()
  }
}

// 重命名对象属性
const renameObjectProperty = (schema: JsonSchema, oldKey: string, newKey: string) => {
  if (!schema.properties || !newKey || newKey === oldKey) return
  
  if (schema.properties[newKey]) {
    // 新键已存在，不允许重命名
    return
  }
  
  // 复制属性
  schema.properties[newKey] = schema.properties[oldKey]
  delete schema.properties[oldKey]
  
  // 更新 required 数组
  if (schema.required && Array.isArray(schema.required)) {
    const index = schema.required.indexOf(oldKey)
    if (index > -1) {
      schema.required[index] = newKey
    }
  }
  
  emitUpdate()
}

// 拖拽相关状态
const draggedItem = ref<string | null>(null)
const dragOverItem = ref<string | null>(null)
const draggedItemData = ref<{ key: string, schema: JsonSchema, parentPath: string } | null>(null)
const dropZones = ref<Set<string>>(new Set())
const dragError = ref<string | null>(null)
const showDragError = ref(false)

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
        
        if (!propSchema.type) {
          errors.push(`属性 "${key}" 缺少type字段`)
        }
        
        // 递归检查嵌套对象
        if (propSchema.type === 'object') {
          const nestedValidation = validateSchemaIntegrity(propSchema)
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
  
  // 计算所有可能的放置区域
  updateDropZones()
}

// 更新可放置区域
const updateDropZones = () => {
  dropZones.value.clear()
  if (!draggedItem.value) return
  
  const addDropZones = (schema: JsonSchema, path = '') => {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const fullPath = getPropertyPath(key, path)
        
        // 如果是对象类型，可以作为放置目标
        if (propSchema.type === 'object' && canDropToTarget(draggedItem.value!, fullPath, propSchema)) {
          dropZones.value.add(fullPath)
        }
        
        // 递归处理嵌套对象
        if (propSchema.type === 'object' && propSchema.properties) {
          addDropZones(propSchema, fullPath)
        }
      })
    }
  }
  
  addDropZones(localSchema.value)
}

// 拖拽结束
const handleDragEnd = () => {
  draggedItem.value = null
  dragOverItem.value = null
  draggedItemData.value = null
  dropZones.value.clear()
}

// 拖拽进入
const handleDragEnter = (e: DragEvent, key: string, parentPath = '') => {
  e.preventDefault()
  const fullPath = getPropertyPath(key, parentPath)
  
  if (draggedItem.value && draggedItem.value !== fullPath) {
    // 只有在可放置区域才显示拖拽悬停效果
    if (dropZones.value.has(fullPath)) {
      dragOverItem.value = fullPath
    }
  }
}

// 拖拽离开
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  if (e.target === e.currentTarget) {
    dragOverItem.value = null
  }
}

// 拖拽悬停
const handleDragOver = (e: DragEvent, key?: string, parentPath = '') => {
  e.preventDefault()
  
  if (key) {
    const fullPath = getPropertyPath(key, parentPath)
    if (dropZones.value.has(fullPath)) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      return
    }
  }
  
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'none'
  }
}

// 显示错误提示
const showError = (message: string) => {
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
  
  if (!sourceKey || !draggedItemData.value || sourceKey === targetPath) {
    // 清除拖拽状态
    draggedItem.value = null
    dragOverItem.value = null
    draggedItemData.value = null
    dropZones.value.clear()
    return
  }
  
  // 检查是否可以放置
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
    
    showError(errorMessage)
    // 清除拖拽状态
    draggedItem.value = null
    dragOverItem.value = null
    draggedItemData.value = null
    dropZones.value.clear()
    return
  }
  
  try {
    // 执行跨层级拖拽操作
    performCrossLevelDrag(draggedItemData.value, targetPath, targetSchema)
    
    // 显示成功提示
    showError(`成功将属性 "${draggedItemData.value.key}" 移动到 "${targetKey}" 中`)
  } catch (error) {
    showError(`拖拽操作失败：${error instanceof Error ? error.message : '未知错误'}`)
  }
  
  // 清除拖拽状态
  draggedItem.value = null
  dragOverItem.value = null
  draggedItemData.value = null
  dropZones.value.clear()
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
  <div class="schema-visual-editor">
    <!-- 拖拽提示 -->
    <div v-if="draggedItem" class="drag-hint">
      <NAlert type="info" :show-icon="false" class="drag-alert">
        <template #icon>
          <NIcon :component="Move" />
        </template>
        正在拖拽属性 "{{ draggedItemData?.key }}"，将其拖拽到对象类型的属性中以移动到该对象内部
      </NAlert>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="showDragError" class="error-hint">
      <NAlert 
        :type="dragError?.includes('成功') ? 'success' : 'error'" 
        :show-icon="true" 
        class="error-alert"
        closable
        @close="showDragError = false"
      >
        {{ dragError }}
      </NAlert>
    </div>
    
    <div v-if="Object.keys(localSchema).length > 0">
      <!-- 基本信息 -->
      <NCard size="small" class="mb-4">
        <template #header>
          <div class="flex items-center gap-2">
            <NIcon :component="getTypeIcon(localSchema.type || 'object')" :size="20" />
            <span>基本配置</span>
          </div>
        </template>
        
        <NForm label-placement="left" :label-width="100">
          <NFormItem label="类型">
            <NSelect
              :value="localSchema.type"
              :options="typeOptions"
              @update:value="updateSchemaType"
              placeholder="选择类型"
            />
          </NFormItem>
          
          <NFormItem label="标题">
            <NInput
              :value="localSchema.title || ''"
              @update:value="(value) => updateField('title', value)"
              placeholder="输入标题"
            />
          </NFormItem>
          
          <NFormItem label="描述">
            <NInput
              type="textarea"
              :value="localSchema.description || ''"
              @update:value="(value) => updateField('description', value)"
              placeholder="输入描述"
              :rows="2"
            />
          </NFormItem>
        </NForm>
      </NCard>

      <!-- 字符串类型配置 -->
      <NCard v-if="localSchema.type === 'string'" title="字符串配置" size="small" class="mb-4">
        <NForm label-placement="left" :label-width="100">
          <NFormItem label="最小长度">
            <NInputNumber
              :value="localSchema.minLength"
              @update:value="(value) => updateField('minLength', value)"
              :min="0"
              placeholder="最小长度"
            />
          </NFormItem>
          
          <NFormItem label="最大长度">
            <NInputNumber
              :value="localSchema.maxLength"
              @update:value="(value) => updateField('maxLength', value)"
              :min="0"
              placeholder="最大长度"
            />
          </NFormItem>
          
          <NFormItem label="正则模式">
            <NInput
              :value="localSchema.pattern || ''"
              @update:value="(value) => updateField('pattern', value)"
              placeholder="输入正则表达式"
            />
          </NFormItem>
          
          <NFormItem label="默认值">
            <NInput
              :value="localSchema.default || ''"
              @update:value="(value) => updateField('default', value)"
              placeholder="输入默认值"
            />
          </NFormItem>
        </NForm>
      </NCard>

      <!-- 数字类型配置 -->
      <NCard v-if="localSchema.type === 'number' || localSchema.type === 'integer'" title="数字配置" size="small" class="mb-4">
        <NForm label-placement="left" :label-width="100">
          <NFormItem label="最小值">
            <NInputNumber
              :value="localSchema.minimum"
              @update:value="(value) => updateField('minimum', value)"
              placeholder="最小值"
            />
          </NFormItem>
          
          <NFormItem label="最大值">
            <NInputNumber
              :value="localSchema.maximum"
              @update:value="(value) => updateField('maximum', value)"
              placeholder="最大值"
            />
          </NFormItem>
          
          <NFormItem label="倍数">
            <NInputNumber
              :value="localSchema.multipleOf"
              @update:value="(value) => updateField('multipleOf', value)"
              :min="0"
              placeholder="必须是此数的倍数"
            />
          </NFormItem>
          
          <NFormItem label="默认值">
            <NInputNumber
              :value="localSchema.default"
              @update:value="(value) => updateField('default', value)"
              placeholder="输入默认值"
            />
          </NFormItem>
        </NForm>
      </NCard>

      <!-- 布尔值配置 -->
      <NCard v-if="localSchema.type === 'boolean'" title="布尔值配置" size="small" class="mb-4">
        <NForm label-placement="left" :label-width="100">
          <NFormItem label="默认值">
            <NSwitch
              :value="localSchema.default || false"
              @update:value="(value) => updateField('default', value)"
            />
          </NFormItem>
        </NForm>
      </NCard>

      <!-- 数组配置 -->
      <div v-if="localSchema.type === 'array'">
        <NCard title="数组配置" size="small" class="mb-4">
          <NForm label-placement="left" :label-width="100">
            <NFormItem label="最小项数">
              <NInputNumber
                :value="localSchema.minItems"
                @update:value="(value) => updateField('minItems', value)"
                :min="0"
                placeholder="最小项数"
              />
            </NFormItem>
            
            <NFormItem label="最大项数">
              <NInputNumber
                :value="localSchema.maxItems"
                @update:value="(value) => updateField('maxItems', value)"
                :min="0"
                placeholder="最大项数"
              />
            </NFormItem>
            
            <NFormItem label="唯一项">
              <NSwitch
                :value="localSchema.uniqueItems || false"
                @update:value="(value) => updateField('uniqueItems', value)"
              />
            </NFormItem>
          </NForm>
        </NCard>
        
        <!-- 数组项配置 -->
        <NCard title="数组项配置" size="small" class="mb-4">
          <div v-if="localSchema.items">
             <!-- 数组项编辑 -->
             <NForm label-placement="left" :label-width="100">
               <NFormItem label="项类型">
                 <NSelect
                   :value="localSchema.items.type"
                   :options="typeOptions"
                   @update:value="(type) => {
                     localSchema.items = getDefaultSchemaForType(type)
                     emitUpdate()
                   }"
                   placeholder="选择项类型"
                 />
               </NFormItem>
               
               <NFormItem label="项标题">
                 <NInput
                   :value="localSchema.items.title || ''"
                   @update:value="(value) => {
                     localSchema.items.title = value
                     emitUpdate()
                   }"
                   placeholder="输入项标题"
                 />
               </NFormItem>
               
               <NFormItem label="项描述">
                 <NInput
                   type="textarea"
                   :value="localSchema.items.description || ''"
                   @update:value="(value) => {
                     localSchema.items.description = value
                     emitUpdate()
                   }"
                   placeholder="输入项描述"
                   :rows="2"
                 />
               </NFormItem>
               
               <!-- 字符串类型项配置 -->
               <template v-if="localSchema.items.type === 'string'">
                 <NFormItem label="项默认值">
                   <NInput
                     :value="localSchema.items.default || ''"
                     @update:value="(value) => {
                       localSchema.items.default = value
                       emitUpdate()
                     }"
                     placeholder="输入默认值"
                   />
                 </NFormItem>
                 
                 <NFormItem label="最小长度">
                   <NInputNumber
                     :value="localSchema.items.minLength"
                     @update:value="(value) => {
                       localSchema.items.minLength = value
                       emitUpdate()
                     }"
                     :min="0"
                     placeholder="最小长度"
                   />
                 </NFormItem>
                 
                 <NFormItem label="最大长度">
                   <NInputNumber
                     :value="localSchema.items.maxLength"
                     @update:value="(value) => {
                       localSchema.items.maxLength = value
                       emitUpdate()
                     }"
                     :min="0"
                     placeholder="最大长度"
                   />
                 </NFormItem>
               </template>
               
               <!-- 数字类型项配置 -->
               <template v-if="localSchema.items.type === 'number' || localSchema.items.type === 'integer'">
                 <NFormItem label="项默认值">
                   <NInputNumber
                     :value="localSchema.items.default"
                     @update:value="(value) => {
                       localSchema.items.default = value
                       emitUpdate()
                     }"
                     placeholder="输入默认值"
                   />
                 </NFormItem>
                 
                 <NFormItem label="最小值">
                   <NInputNumber
                     :value="localSchema.items.minimum"
                     @update:value="(value) => {
                       localSchema.items.minimum = value
                       emitUpdate()
                     }"
                     placeholder="最小值"
                   />
                 </NFormItem>
                 
                 <NFormItem label="最大值">
                   <NInputNumber
                     :value="localSchema.items.maximum"
                     @update:value="(value) => {
                       localSchema.items.maximum = value
                       emitUpdate()
                     }"
                     placeholder="最大值"
                   />
                 </NFormItem>
               </template>
               
               <!-- 布尔类型项配置 -->
               <template v-if="localSchema.items.type === 'boolean'">
                 <NFormItem label="项默认值">
                   <NSwitch
                     :value="localSchema.items.default || false"
                     @update:value="(value) => {
                       localSchema.items.default = value
                       emitUpdate()
                     }"
                   />
                 </NFormItem>
               </template>
               
               <!-- 嵌套数组配置 -->
               <template v-if="localSchema.items.type === 'array'">
                 <NFormItem label="嵌套数组项类型">
                   <NSelect
                     :value="localSchema.items.items?.type || 'string'"
                     :options="typeOptions"
                     @update:value="(type) => {
                       if (!localSchema.items.items) localSchema.items.items = {}
                       localSchema.items.items = getDefaultSchemaForType(type)
                       emitUpdate()
                     }"
                     placeholder="选择嵌套项类型"
                   />
                 </NFormItem>
               </template>
               
               <!-- 嵌套对象配置 -->
               <template v-if="localSchema.items.type === 'object'">
                 <NFormItem>
                   <template #label>
                     <div class="flex items-center gap-2">
                       <span>嵌套对象属性</span>
                       <NButton
                         size="tiny"
                         type="primary"
                         @click="addObjectProperty(localSchema.items)"
                       >
                         <template #icon>
                           <Plus :size="12" />
                         </template>
                         添加
                       </NButton>
                     </div>
                   </template>
                   
                   <div v-if="localSchema.items.properties && Object.keys(localSchema.items.properties).length > 0" class="space-y-2">
                     <div
                       v-for="[key, propSchema] in Object.entries(localSchema.items.properties)"
                       :key="key"
                       class="border rounded p-2 bg-gray-50"
                     >
                       <div class="flex items-center justify-between mb-2">
                         <div class="flex items-center gap-2">
                           <NIcon :component="getTypeIcon(propSchema.type)" :size="14" />
                           <span class="text-sm font-medium">{{ key }}</span>
                         </div>
                         <NButton
                           size="tiny"
                           type="error"
                           @click="removeObjectProperty(localSchema.items, key)"
                         >
                           <template #icon>
                             <Trash2 :size="12" />
                           </template>
                         </NButton>
                       </div>
                       
                       <NSpace vertical size="small">
                         <NInput
                           :value="key"
                           @update:value="(newKey) => renameObjectProperty(localSchema.items, key, newKey)"
                           placeholder="属性名"
                           size="small"
                         />
                         
                         <NSelect
                           :value="propSchema.type"
                           :options="typeOptions"
                           @update:value="(type) => {
                             localSchema.items.properties[key] = getDefaultSchemaForType(type)
                             emitUpdate()
                           }"
                           placeholder="选择类型"
                           size="small"
                         />
                       </NSpace>
                     </div>
                   </div>
                   
                   <div v-else class="text-center text-gray-400 py-2 text-sm">
                     暂无属性
                   </div>
                 </NFormItem>
               </template>
             </NForm>
           </div>
          <div v-else class="text-center text-gray-500 py-4">
            <NButton @click="updateField('items', getDefaultSchemaForType('string'))">
              添加数组项配置
            </NButton>
          </div>
        </NCard>
      </div>

      <!-- 对象配置 -->
      <div v-if="localSchema.type === 'object'">
        <NCard title="对象配置" size="small" class="mb-4">
          <NForm label-placement="left" :label-width="100">
            <NFormItem label="最小属性数">
              <NInputNumber
                :value="localSchema.minProperties"
                @update:value="(value) => updateField('minProperties', value)"
                :min="0"
                placeholder="最小属性数"
              />
            </NFormItem>
            
            <NFormItem label="最大属性数">
              <NInputNumber
                :value="localSchema.maxProperties"
                @update:value="(value) => updateField('maxProperties', value)"
                :min="0"
                placeholder="最大属性数"
              />
            </NFormItem>
            
            <NFormItem label="允许额外属性">
              <NSwitch
                :value="localSchema.additionalProperties !== false"
                @update:value="(value) => updateField('additionalProperties', value)"
              />
            </NFormItem>
          </NForm>
        </NCard>
        
        <!-- 属性列表 -->
        <NCard title="属性配置" size="small">
          <div class="mb-4">
            <NButton
              type="primary"
              size="small"
              @click="addObjectProperty(localSchema)"
            >
              <template #icon>
                <Plus :size="16" />
              </template>
              添加属性
            </NButton>
          </div>
          
          <div v-if="localSchema.properties && Object.keys(localSchema.properties).length > 0">
            <NCollapse>
              <NCollapseItem
                v-for="[key, propSchema] in Object.entries(localSchema.properties)"
                :key="key"
                :name="key"
                :draggable="true"
                :class="{
                  'drag-over': dragOverItem === key,
                  'dragging': draggedItem === key,
                  'drop-zone': dropZones.has(key) && draggedItem && draggedItem !== key,
                  'can-drop': propSchema.type === 'object' && dropZones.has(key)
                }"
                @dragstart="handleDragStart($event, key, propSchema)"
                @dragend="handleDragEnd"
                @dragenter="handleDragEnter($event, key)"
                @dragleave="handleDragLeave"
                @dragover="handleDragOver($event, key)"
                @drop="handleDrop($event, key, propSchema)"
              >
                <template #header>
                  <div class="flex items-center justify-between w-full mr-4">
                    <div class="flex items-center gap-2">
                                 <NIcon :component="getTypeIcon((propSchema as JsonSchema).type || 'string')" :size="16" />
                                 <span class="font-medium">{{ key }}</span>
                                 <NTag v-if="isPropertyRequired(localSchema, key)" type="error" size="small">
                                   必需
                                 </NTag>
                               </div>
                    
                    <NSpace size="small" @click.stop>
                      <NTooltip trigger="hover">
                        <template #trigger>
                          <NButton
                            size="tiny"
                            :type="isPropertyRequired(localSchema, key) ? 'error' : 'default'"
                            @click="togglePropertyRequired(localSchema, key)"
                          >
                            {{ isPropertyRequired(localSchema, key) ? '必需' : '可选' }}
                          </NButton>
                        </template>
                        切换必需状态
                      </NTooltip>
                      
                      <NPopconfirm
                        @positive-click="removeObjectProperty(localSchema, key)"
                      >
                        <template #trigger>
                          <NButton size="tiny" type="error">
                            <template #icon>
                              <Trash2 :size="14" />
                            </template>
                          </NButton>
                        </template>
                        确定删除属性 "{{ key }}" 吗？
                      </NPopconfirm>
                    </NSpace>
                  </div>
                </template>
                
                <div class="pl-4">
                  <div class="mb-4">
                    <NFormItem label="属性名">
                      <NInput
                        :value="key"
                        @update:value="(newKey) => renameObjectProperty(localSchema, key, newKey)"
                        placeholder="输入属性名"
                      />
                    </NFormItem>
                  </div>
                  
                  <!-- 简化的属性编辑 -->
                   <NForm label-placement="left" :label-width="100">
                     <NFormItem label="属性类型">
                       <NSelect
                         :value="(propSchema as JsonSchema).type"
                         :options="typeOptions"
                         @update:value="(type) => {
                           localSchema.properties![key] = getDefaultSchemaForType(type) as JsonSchema
                           emitUpdate()
                         }"
                         placeholder="选择属性类型"
                       />
                     </NFormItem>
                     
                     <NFormItem label="属性标题">
                       <NInput
                         :value="(propSchema as JsonSchema).title || ''"
                         @update:value="(value) => {
                           (propSchema as JsonSchema).title = value
                           emitUpdate()
                         }"
                         placeholder="输入属性标题"
                       />
                     </NFormItem>
                     
                     <NFormItem label="属性描述">
                       <NInput
                         type="textarea"
                         :value="(propSchema as JsonSchema).description || ''"
                         @update:value="(value) => {
                           (propSchema as JsonSchema).description = value
                           emitUpdate()
                         }"
                         placeholder="输入属性描述"
                         :rows="2"
                       />
                     </NFormItem>
                     
                     <!-- 字符串类型特定配置 -->
                     <template v-if="(propSchema as JsonSchema).type === 'string'">
                       <NFormItem label="默认值">
                         <NInput
                           :value="(propSchema as JsonSchema).default || ''"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).default = value
                             emitUpdate()
                           }"
                           placeholder="输入默认值"
                         />
                       </NFormItem>
                     </template>
                     
                     <!-- 数字类型特定配置 -->
                     <template v-if="(propSchema as JsonSchema).type === 'number' || (propSchema as JsonSchema).type === 'integer'">
                       <NFormItem label="最小值">
                         <NInputNumber
                           :value="(propSchema as JsonSchema).minimum"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).minimum = value
                             emitUpdate()
                           }"
                           placeholder="最小值"
                         />
                       </NFormItem>
                       
                       <NFormItem label="最大值">
                         <NInputNumber
                           :value="(propSchema as JsonSchema).maximum"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).maximum = value
                             emitUpdate()
                           }"
                           placeholder="最大值"
                         />
                       </NFormItem>
                     </template>
                     
                     <!-- 布尔类型特定配置 -->
                     <template v-if="(propSchema as JsonSchema).type === 'boolean'">
                       <NFormItem label="默认值">
                         <NSwitch
                           :value="(propSchema as JsonSchema).default || false"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).default = value
                             emitUpdate()
                           }"
                         />
                       </NFormItem>
                     </template>
                     
                     <!-- 数组类型特定配置 -->
                     <template v-if="(propSchema as JsonSchema).type === 'array'">
                       <NFormItem label="数组项类型">
                         <NSelect
                           :value="(propSchema as JsonSchema).items?.type || 'string'"
                           :options="typeOptions"
                           @update:value="(type) => {
                              if (!(propSchema as JsonSchema).items) (propSchema as JsonSchema).items = {};
                              (propSchema as JsonSchema).items = getDefaultSchemaForType(type) as JsonSchema
                              emitUpdate()
                            }"
                           placeholder="选择数组项类型"
                         />
                       </NFormItem>
                       
                       <NFormItem label="最小项数">
                         <NInputNumber
                           :value="(propSchema as JsonSchema).minItems"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).minItems = value
                             emitUpdate()
                           }"
                           :min="0"
                           placeholder="最小项数"
                         />
                       </NFormItem>
                       
                       <NFormItem label="最大项数">
                         <NInputNumber
                           :value="(propSchema as JsonSchema).maxItems"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).maxItems = value
                             emitUpdate()
                           }"
                           :min="0"
                           placeholder="最大项数"
                         />
                       </NFormItem>
                     </template>
                     
                     <!-- 对象类型特定配置 -->
                     <template v-if="(propSchema as JsonSchema).type === 'object'">
                       <NFormItem>
                         <template #label>
                           <div class="flex items-center gap-2">
                             <span>子对象属性</span>
                             <NButton
                               size="tiny"
                               type="primary"
                               @click="addObjectProperty(propSchema as JsonSchema)"
                             >
                               <template #icon>
                                 <Plus :size="12" />
                               </template>
                               添加
                             </NButton>
                           </div>
                         </template>
                         
                         <div v-if="(propSchema as JsonSchema).properties && Object.keys((propSchema as JsonSchema).properties!).length > 0" class="space-y-2 max-h-40 overflow-y-auto">
                           <div
                             v-for="[subKey, subPropSchema] in Object.entries((propSchema as JsonSchema).properties!)"
                             :key="subKey"
                             class="border p-2 bg-blue-50 nested-property"
                             :draggable="true"
                             :class="{
                               'drag-over': dragOverItem === `${key}.${subKey}`,
                               'dragging': draggedItem === `${key}.${subKey}`,
                               'drop-zone': dropZones.has(`${key}.${subKey}`) && draggedItem && draggedItem !== `${key}.${subKey}`,
                               'can-drop': (subPropSchema as JsonSchema).type === 'object' && dropZones.has(`${key}.${subKey}`)
                             }"
                             @dragstart="handleDragStart($event, subKey, subPropSchema as JsonSchema, key)"
                             @dragend="handleDragEnd"
                             @dragenter="handleDragEnter($event, subKey, key)"
                             @dragleave="handleDragLeave"
                             @dragover="handleDragOver($event, subKey, key)"
                             @drop="handleDrop($event, subKey, subPropSchema as JsonSchema, key)"
                           >
                             <div class="flex items-center justify-between mb-2">
                               <div class="flex items-center gap-2">
                                 <NIcon :component="getTypeIcon((subPropSchema as JsonSchema).type || 'string')" :size="12" />
                                 <span class="text-xs font-medium">{{ subKey }}</span>
                               </div>
                               <NButton
                                 size="tiny"
                                 type="error"
                                 @click="removeObjectProperty(propSchema as JsonSchema, subKey)"
                               >
                                 <template #icon>
                                   <Trash2 :size="10" />
                                 </template>
                               </NButton>
                             </div>
                             
                             <NSpace vertical size="small">
                               <NInput
                                 :value="subKey"
                                 @update:value="(newKey) => renameObjectProperty(propSchema as JsonSchema, subKey, newKey)"
                                 placeholder="属性名"
                                 size="small"
                               />
                               
                               <NSelect
                                 :value="(subPropSchema as JsonSchema).type || 'string'"
                                 :options="typeOptions"
                                 @update:value="(type) => {
                                   ((propSchema as JsonSchema).properties!)[subKey] = getDefaultSchemaForType(type) as JsonSchema
                                   emitUpdate()
                                 }"
                                 placeholder="选择类型"
                                 size="small"
                               />
                             </NSpace>
                           </div>
                         </div>
                         
                         <div v-else class="text-center text-gray-400 py-2 text-xs">
                           暂无子属性
                         </div>
                       </NFormItem>
                       
                       <NFormItem label="允许额外属性">
                         <NSwitch
                           :value="(propSchema as JsonSchema).additionalProperties !== false"
                           @update:value="(value) => {
                             (propSchema as JsonSchema).additionalProperties = value
                             emitUpdate()
                           }"
                         />
                       </NFormItem>
                     </template>
                   </NForm>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
          
          <div v-else class="text-center text-gray-500 py-4">
            <p>暂无属性，点击上方按钮添加属性</p>
          </div>
        </NCard>
      </div>
    </div>
    
    <div v-else class="text-center text-gray-500 py-8">
      <p>请在左侧输入有效的 JSON Schema</p>
    </div>
  </div>
</template>

<style scoped>
.schema-visual-editor {
  max-width: 100%;
}

:deep(.n-collapse-item__header) {
  padding: 8px 0;
}

:deep(.n-collapse-item__content-wrapper) {
  padding-top: 0;
}

:deep(.n-card) {
  border-radius: 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(239, 239, 245, 0.8);
  transition: all 0.3s ease;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 252, 0.95));
}

:deep(.n-card:hover) {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

:deep(.n-card__header) {
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.05), rgba(24, 160, 88, 0.02));
  border-bottom: 1px solid rgba(24, 160, 88, 0.1);
  font-weight: 600;
  color: rgba(24, 160, 88, 0.8);
}

:deep(.n-card__content) {
  padding: 20px;
}

:deep(.n-form-item) {
  margin-bottom: 18px;
  transition: all 0.2s ease;
}

:deep(.n-form-item:hover) {
  transform: translateX(2px);
}

:deep(.n-form-item__label) {
  font-weight: 500;
  color: rgba(51, 54, 57, 0.8);
  margin-bottom: 6px;
}

:deep(.n-input), :deep(.n-input-number), :deep(.n-select) {
  border-radius: 0;
  transition: all 0.2s ease;
}

:deep(.n-input:hover), :deep(.n-input-number:hover), :deep(.n-select:hover) {
  box-shadow: 0 2px 8px rgba(24, 160, 88, 0.1);
}

:deep(.n-input:focus-within), :deep(.n-input-number:focus-within), :deep(.n-select:focus-within) {
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
}

/* 拖拽提示样式 */
.drag-hint {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 500px;
  animation: slideDown 0.3s ease;
}

.drag-alert {
  border-radius: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 错误提示样式 */
.error-hint {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  max-width: 500px;
  animation: slideDown 0.3s ease;
}

.error-alert {
  border-radius: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

/* 拖拽样式 */
:deep(.n-collapse-item[draggable="true"]) {
  cursor: move;
  transition: all 0.2s ease;
}

:deep(.n-collapse-item.dragging) {
  opacity: 0.5;
  transform: scale(0.95);
  background-color: #f0f8ff;
  border: 2px dashed #1890ff;
  filter: blur(1px);
}

:deep(.n-collapse-item.drag-over) {
  background-color: #e6f7ff;
  border: 2px solid #1890ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

:deep(.n-collapse-item.drop-zone) {
  background-color: rgba(24, 160, 88, 0.05);
  border: 1px solid rgba(24, 160, 88, 0.3);
  border-radius: 0;
  position: relative;
  transition: all 0.3s ease;
}

:deep(.n-collapse-item.drop-zone::before) {
  content: '可放置区域';
  position: absolute;
  top: -8px;
  right: 8px;
  background: #18a058;
  color: white;
  padding: 2px 8px;
  border-radius: 0;
  font-size: 12px;
  z-index: 10;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

:deep(.n-collapse-item.drop-zone:hover::before) {
  opacity: 1;
  transform: translateY(0);
}

:deep(.n-collapse-item.can-drop) {
  border-color: rgba(24, 160, 88, 0.5);
  background-color: rgba(24, 160, 88, 0.02);
}

:deep(.n-collapse-item.can-drop::after) {
  content: '📁';
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 16px;
  opacity: 0.7;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

:deep(.n-collapse-item[draggable="true"]:hover) {
  background-color: #fafafa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 拖拽手柄样式 */
:deep(.n-collapse-item__header) {
  position: relative;
}

:deep(.n-collapse-item[draggable="true"] .n-collapse-item__header::before) {
  content: '⋮⋮';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

:deep(.n-collapse-item[draggable="true"]:hover .n-collapse-item__header::before) {
  opacity: 1;
  color: #18a058;
}

/* 嵌套属性拖拽样式 */
.nested-property[draggable="true"] {
  cursor: move;
  transition: all 0.2s ease;
  position: relative;
  border-radius: 0;
  margin-bottom: 8px;
}

.nested-property.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  background-color: #f0f8ff !important;
  border: 2px dashed #1890ff !important;
  filter: blur(1px);
}

.nested-property.drag-over {
  background-color: #e6f7ff !important;
  border: 2px solid #1890ff !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

.nested-property.drop-zone {
  background-color: rgba(24, 160, 88, 0.05) !important;
  border: 1px solid rgba(24, 160, 88, 0.3) !important;
  border-radius: 0;
  position: relative;
  transition: all 0.3s ease;
}

.nested-property.drop-zone::before {
  content: '可放置区域';
  position: absolute;
  top: -8px;
  right: 8px;
  background: #18a058;
  color: white;
  padding: 2px 8px;
  border-radius: 0;
  font-size: 10px;
  z-index: 10;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

.nested-property.drop-zone:hover::before {
  opacity: 1;
  transform: translateY(0);
}

.nested-property.can-drop {
  border-color: rgba(24, 160, 88, 0.5) !important;
  background-color: rgba(24, 160, 88, 0.02) !important;
}

.nested-property.can-drop::after {
  content: '📁';
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  opacity: 0.7;
  animation: pulse 2s infinite;
}

.nested-property[draggable="true"]:hover {
  background-color: #f5f5f5 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.nested-property[draggable="true"]::before {
  content: '⋮⋮';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 10px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.nested-property[draggable="true"]:hover::before {
  opacity: 1;
  color: #18a058;
}

/* 嵌套结构优化 */
.nested-properties {
  margin-left: 20px;
  padding-left: 20px;
  border-left: 3px solid rgba(24, 160, 88, 0.2);
  position: relative;
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.02), rgba(24, 160, 88, 0.01));
  border-radius: 0;
  margin-top: 8px;
  margin-bottom: 8px;
}

.nested-properties::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, rgba(24, 160, 88, 0.4), rgba(24, 160, 88, 0.1));
  border-radius: 0;
  box-shadow: 0 0 4px rgba(24, 160, 88, 0.2);
}

.nested-properties::after {
  content: '';
  position: absolute;
  left: -10px;
  top: 16px;
  width: 8px;
  height: 8px;
  background: rgba(24, 160, 88, 0.3);
  border-radius: 0;
  box-shadow: 0 0 6px rgba(24, 160, 88, 0.4);
}

/* 改进的折叠面板样式 */
:deep(.n-collapse-item) {
  border-radius: 0;
  overflow: hidden;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(239, 239, 245, 0.6);
  transition: all 0.3s ease;
}

:deep(.n-collapse-item:hover) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

:deep(.n-collapse-item__header) {
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(250, 250, 252, 0.9), rgba(248, 250, 252, 0.8));
  border-bottom: 1px solid rgba(239, 239, 245, 0.6);
  transition: all 0.3s ease;
  position: relative;
}

:deep(.n-collapse-item__header::after) {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(24, 160, 88, 0.2), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

:deep(.n-collapse-item__header:hover) {
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.08), rgba(24, 160, 88, 0.04));
}

:deep(.n-collapse-item__header:hover::after) {
  opacity: 1;
}

:deep(.n-collapse-item__content-wrapper) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(250, 250, 252, 0.9));
}

:deep(.n-collapse-item__content-inner) {
  padding: 20px;
}

/* 按钮组样式优化 */
.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 8px;
}

:deep(.n-button) {
  border-radius: 0;
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
  overflow: hidden;
}

:deep(.n-button::before) {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

:deep(.n-button:hover::before) {
  left: 100%;
}

:deep(.n-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(.n-button--primary) {
  background: linear-gradient(135deg, #18a058, #16a085);
  border: none;
}

:deep(.n-button--primary:hover) {
  background: linear-gradient(135deg, #16a085, #138d75);
  box-shadow: 0 4px 12px rgba(24, 160, 88, 0.3);
}

:deep(.n-button--error) {
  background: linear-gradient(135deg, #d03050, #c0392b);
  border: none;
}

:deep(.n-button--error:hover) {
  background: linear-gradient(135deg, #c0392b, #a93226);
  box-shadow: 0 4px 12px rgba(208, 48, 80, 0.3);
}

:deep(.n-button--secondary) {
  background: linear-gradient(135deg, rgba(239, 239, 245, 0.8), rgba(229, 229, 235, 0.8));
  color: rgba(51, 54, 57, 0.8);
  border: 1px solid rgba(239, 239, 245, 0.6);
}

:deep(.n-button--secondary:hover) {
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.1), rgba(24, 160, 88, 0.05));
  color: rgba(24, 160, 88, 0.8);
  border-color: rgba(24, 160, 88, 0.2);
  box-shadow: 0 4px 12px rgba(24, 160, 88, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .nested-properties {
    margin-left: 8px;
    padding-left: 8px;
  }
  
  :deep(.n-collapse-item__header) {
    padding: 8px 12px;
  }
  
  :deep(.n-collapse-item__content-inner) {
    padding: 12px;
  }
}
</style>