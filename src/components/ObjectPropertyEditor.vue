<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NButton,
  NSpace,
  NCollapse,
  NCollapseItem,
  NTag,
  NPopconfirm,
  NIcon,
  NTooltip,
  NSelect
} from 'naive-ui'
import {
  Plus,
  Trash2,
  Type,
  Hash,
  ToggleLeft,
  List,
  Braces
} from 'lucide-vue-next'
import { getDefaultSchemaForType as getDefaultSchema, type SupportedType } from '../lib/schemaValidator'

interface JsonSchema {
  type?: SupportedType
  title?: string
  description?: string
  default?: any
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  minProperties?: number
  maxProperties?: number
  [key: string]: any
}

interface ObjectSchema {
  type: 'object'
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  minProperties?: number
  maxProperties?: number
  default?: Record<string, any>
}

interface Props {
  schema: ObjectSchema
  depth?: number
  maxDepth?: number
}

interface Emits {
  (e: 'update:schema', schema: ObjectSchema): void
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  maxDepth: 10
})
const emit = defineEmits<Emits>()

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

// 获取属性类型图标
const getPropertyTypeIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    string: Type,
    number: Hash,
    integer: Hash,
    boolean: ToggleLeft,
    array: List,
    object: Braces
  }
  return iconMap[type] || Type
}

// 获取类型的默认schema
const getDefaultSchemaForType = (type: SupportedType): JsonSchema => {
  const baseSchema: JsonSchema = { type }
  
  switch (type) {
    case 'string':
      return { ...baseSchema }
    case 'number':
    case 'integer':
      return { ...baseSchema }
    case 'boolean':
      return { ...baseSchema }
    case 'array':
      return { ...baseSchema, items: { type: 'string' } }
    case 'object':
      return { ...baseSchema, properties: {}, required: [] }
    default:
      return { ...baseSchema }
  }
}

// 计算属性用于双向绑定
const localSchema = computed({
  get: () => props.schema,
  set: (value) => emit('update:schema', value)
})

// 更新字段值
const updateField = (field: keyof ObjectSchema, value: any) => {
  const newSchema = { ...localSchema.value }
  if (value === null || value === undefined || value === '') {
    delete (newSchema as any)[field]
  } else {
    ;(newSchema as any)[field] = value
  }
  emit('update:schema', newSchema)
}

// 添加对象属性
const addObjectProperty = () => {
  const newSchema = { ...localSchema.value }
  if (!newSchema.properties) newSchema.properties = {}
  
  let newKey = 'newProperty'
  let counter = 1
  while (newSchema.properties[newKey]) {
    newKey = `newProperty${counter}`
    counter++
  }
  
  newSchema.properties[newKey] = getDefaultSchemaForType('string')
  emit('update:schema', newSchema)
}

// 删除对象属性
const removeObjectProperty = (key: string) => {
  const newSchema = { ...localSchema.value }
  if (newSchema.properties) {
    delete newSchema.properties[key]
    
    // 同时从 required 数组中移除
    if (newSchema.required && Array.isArray(newSchema.required)) {
      const index = newSchema.required.indexOf(key)
      if (index > -1) {
        newSchema.required.splice(index, 1)
      }
    }
    
    emit('update:schema', newSchema)
  }
}

// 重命名对象属性
const renameObjectProperty = (oldKey: string, newKey: string) => {
  if (!newKey || newKey === oldKey) return
  
  const newSchema = { ...localSchema.value }
  if (!newSchema.properties) return
  
  if (newSchema.properties[newKey]) {
    // 新键已存在，不允许重命名
    return
  }
  
  // 复制属性
  newSchema.properties[newKey] = newSchema.properties[oldKey]
  delete newSchema.properties[oldKey]
  
  // 更新 required 数组
  if (newSchema.required && Array.isArray(newSchema.required)) {
    const index = newSchema.required.indexOf(oldKey)
    if (index > -1) {
      newSchema.required[index] = newKey
    }
  }
  
  emit('update:schema', newSchema)
}

// 更新属性schema
const updatePropertySchema = (key: string, propertySchema: JsonSchema) => {
  const newSchema = { ...localSchema.value }
  if (!newSchema.properties) newSchema.properties = {}
  newSchema.properties[key] = propertySchema
  emit('update:schema', newSchema)
}

// 检查属性是否必需
const isPropertyRequired = (key: string): boolean => {
  return localSchema.value.required?.includes(key) || false
}

// 切换属性必需状态
const togglePropertyRequired = (key: string) => {
  const newSchema = { ...localSchema.value }
  if (!newSchema.required) newSchema.required = []
  
  const index = newSchema.required.indexOf(key)
  if (index > -1) {
    newSchema.required.splice(index, 1)
  } else {
    newSchema.required.push(key)
  }
  
  emit('update:schema', newSchema)
}

// 检查是否可以继续嵌套
const canNest = computed(() => props.depth < props.maxDepth)
</script>

<template>
  <div class="object-property-editor">
    <NForm label-placement="left" :label-width="100">
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
    
    <!-- 属性列表 -->
    <div class="mt-4">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-sm font-medium text-gray-700">对象属性</h4>
        <NButton
          type="primary"
          size="small"
          @click="addObjectProperty"
          :disabled="!canNest"
        >
          <template #icon>
            <Plus :size="16" />
          </template>
          添加属性
        </NButton>
      </div>
      
      <div v-if="!canNest" class="text-center text-orange-500 text-sm mb-4">
        已达到最大嵌套深度 ({{ maxDepth }})
      </div>
      
      <div v-if="localSchema.properties && Object.keys(localSchema.properties).length > 0">
        <NCollapse>
          <NCollapseItem
            v-for="[key, propSchema] in Object.entries(localSchema.properties)"
            :key="key"
            :name="key"
          >
            <template #header>
              <div class="flex items-center justify-between w-full mr-4">
                <div class="flex items-center gap-2">
                  <NIcon :component="getTypeIcon(propSchema.type || 'string')" :size="16" />
                  <span class="font-medium">{{ key }}</span>
                  <NTag v-if="isPropertyRequired(key)" type="error" size="small">
                    必需
                  </NTag>
                  <NTag v-if="propSchema.type === 'object'" type="info" size="small">
                    深度: {{ depth + 1 }}
                  </NTag>
                </div>
                
                <NSpace size="small" @click.stop>
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <NButton
                        size="tiny"
                        :type="isPropertyRequired(key) ? 'error' : 'default'"
                        @click="togglePropertyRequired(key)"
                      >
                        {{ isPropertyRequired(key) ? '必需' : '可选' }}
                      </NButton>
                    </template>
                    切换必需状态
                  </NTooltip>
                  
                  <NPopconfirm
                    @positive-click="removeObjectProperty(key)"
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
                    @update:value="(newKey) => renameObjectProperty(key, newKey)"
                    placeholder="输入属性名"
                  />
                </NFormItem>
              </div>
              
              <!-- 递归编辑嵌套属性 -->
              <div class="nested-property" :class="`depth-${depth + 1}`">
                <!-- 类型选择器 -->
                <NFormItem label="属性类型">
                  <NSelect
                    :value="propSchema.type || 'string'"
                    :options="[
                      { label: '字符串', value: 'string' },
                      { label: '数字', value: 'number' },
                      { label: '整数', value: 'integer' },
                      { label: '布尔值', value: 'boolean' },
                      { label: '数组', value: 'array' },
                      { label: '对象', value: 'object' }
                    ]"
                    @update:value="(type) => {
                      const newPropSchema = getDefaultSchemaForType(type)
                      // 保留标题和描述
                      if (propSchema.title) newPropSchema.title = propSchema.title
                      if (propSchema.description) newPropSchema.description = propSchema.description
                      updatePropertySchema(key, newPropSchema)
                    }"
                    placeholder="选择属性类型"
                  />
                </NFormItem>
                
                <!-- 通用属性 -->
                <NFormItem label="属性标题">
                  <NInput
                    :value="propSchema.title || ''"
                    @update:value="(value) => {
                      const newPropSchema = { ...propSchema, title: value }
                      updatePropertySchema(key, newPropSchema)
                    }"
                    placeholder="输入属性标题"
                  />
                </NFormItem>
                
                <NFormItem label="属性描述">
                  <NInput
                    type="textarea"
                    :value="propSchema.description || ''"
                    @update:value="(value) => {
                      const newPropSchema = { ...propSchema, description: value }
                      updatePropertySchema(key, newPropSchema)
                    }"
                    placeholder="输入属性描述"
                    :rows="2"
                  />
                </NFormItem>
                <!-- 字符串类型 -->
                <div v-if="propSchema.type === 'string'" class="property-config">
                  <NFormItem label="默认值">
                    <NInput
                      :value="propSchema.default || ''"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, default: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      placeholder="输入默认值"
                    />
                  </NFormItem>
                  <NFormItem label="最小长度">
                    <NInputNumber
                      :value="propSchema.minLength"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, minLength: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      :min="0"
                      placeholder="最小长度"
                    />
                  </NFormItem>
                  <NFormItem label="最大长度">
                    <NInputNumber
                      :value="propSchema.maxLength"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, maxLength: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      :min="0"
                      placeholder="最大长度"
                    />
                  </NFormItem>
                </div>
                
                <!-- 数字类型 -->
                <div v-else-if="propSchema.type === 'number' || propSchema.type === 'integer'" class="property-config">
                  <NFormItem label="默认值">
                    <NInputNumber
                      :value="propSchema.default"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, default: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      placeholder="输入默认值"
                    />
                  </NFormItem>
                  <NFormItem label="最小值">
                    <NInputNumber
                      :value="propSchema.minimum"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, minimum: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      placeholder="最小值"
                    />
                  </NFormItem>
                  <NFormItem label="最大值">
                    <NInputNumber
                      :value="propSchema.maximum"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, maximum: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      placeholder="最大值"
                    />
                  </NFormItem>
                </div>
                
                <!-- 布尔类型 -->
                <div v-else-if="propSchema.type === 'boolean'" class="property-config">
                  <NFormItem label="默认值">
                    <NSwitch
                      :value="propSchema.default || false"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, default: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                    />
                  </NFormItem>
                </div>
                
                <!-- 数组类型 -->
                <div v-else-if="propSchema.type === 'array'" class="property-config">
                  <NFormItem label="数组项类型">
                    <NSelect
                      :value="propSchema.items?.type || 'string'"
                      :options="[
                        { label: '字符串', value: 'string' },
                        { label: '数字', value: 'number' },
                        { label: '整数', value: 'integer' },
                        { label: '布尔值', value: 'boolean' },
                        { label: '对象', value: 'object' }
                      ]"
                      @update:value="(type) => {
                        const newPropSchema = { ...propSchema, items: getDefaultSchemaForType(type) }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      placeholder="选择数组项类型"
                    />
                  </NFormItem>
                  <NFormItem label="最小项数">
                    <NInputNumber
                      :value="propSchema.minItems"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, minItems: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      :min="0"
                      placeholder="最小项数"
                    />
                  </NFormItem>
                  <NFormItem label="最大项数">
                    <NInputNumber
                      :value="propSchema.maxItems"
                      @update:value="(value) => {
                        const newPropSchema = { ...propSchema, maxItems: value }
                        updatePropertySchema(key, newPropSchema)
                      }"
                      :min="0"
                      placeholder="最大项数"
                    />
                  </NFormItem>
                </div>
                
                <!-- 嵌套对象类型 -->
                <div v-else-if="propSchema.type === 'object' && canNest" class="property-config">
                  <ObjectPropertyEditor
                    :schema="propSchema as ObjectSchema"
                    :depth="depth + 1"
                    :max-depth="maxDepth"
                    @update:schema="(newSchema) => updatePropertySchema(key, newSchema)"
                  />
                </div>
                
                <!-- 达到最大嵌套深度的对象 -->
                <div v-else-if="propSchema.type === 'object' && !canNest" class="property-config">
                  <div class="text-center text-orange-500 text-sm py-4">
                    对象嵌套已达到最大深度 ({{ maxDepth }})
                  </div>
                </div>
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </div>
      
      <div v-else class="text-center text-gray-500 py-4">
        <p>暂无属性，点击上方按钮添加属性</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.object-property-editor {
  width: 100%;
}

.nested-property {
  border-left: 2px solid #e5e7eb;
  padding-left: 16px;
  margin-left: 8px;
}

.nested-property.depth-1 {
  border-left-color: #3b82f6;
}

.nested-property.depth-2 {
  border-left-color: #10b981;
}

.nested-property.depth-3 {
  border-left-color: #f59e0b;
}

.nested-property.depth-4 {
  border-left-color: #ef4444;
}

.nested-property.depth-5 {
  border-left-color: #8b5cf6;
}

:deep(.n-collapse-item__header) {
  padding: 8px 0 !important;
}

:deep(.n-collapse-item__content-wrapper) {
  padding-top: 0;
}

:deep(.n-form-item) {
  margin-bottom: 16px;
}

:deep(.n-form-item__label) {
  font-weight: 500;
  color: rgba(51, 54, 57, 0.8);
}

:deep(.n-input), :deep(.n-input-number) {
  transition: all 0.2s ease;
}

:deep(.n-input:hover), :deep(.n-input-number:hover) {
  box-shadow: 0 2px 8px rgba(24, 160, 88, 0.1);
}

:deep(.n-input:focus-within), :deep(.n-input-number:focus-within) {
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
}
</style>