<script setup lang="ts">
import { computed } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NSelect,
  NCard,
  NButton
} from 'naive-ui'
import { SUPPORTED_TYPES, getDefaultSchemaForType, type SupportedType } from '../lib/schemaValidator'

interface JsonSchema {
  type?: SupportedType
  title?: string
  description?: string
  default?: any
  [key: string]: any
}

interface ArraySchema {
  type: 'array'
  title?: string
  description?: string
  items?: JsonSchema
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  default?: any[]
}

interface Props {
  schema: ArraySchema
}

interface Emits {
  (e: 'update:schema', schema: ArraySchema): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

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

// 计算属性用于双向绑定
const localSchema = computed({
  get: () => props.schema,
  set: (value) => emit('update:schema', value)
})

// 更新字段值
const updateField = (field: keyof ArraySchema, value: any) => {
  const newSchema = { ...localSchema.value }
  if (value === null || value === undefined || value === '') {
    delete newSchema[field]
  } else {
    ;(newSchema as any)[field] = value
  }
  emit('update:schema', newSchema)
}

// 更新数组项字段
const updateItemsField = (field: string, value: any) => {
  const newSchema = { ...localSchema.value }
  if (!newSchema.items) {
    newSchema.items = getDefaultSchemaForType('string')
  }
  
  if (value === null || value === undefined || value === '') {
    delete newSchema.items[field]
  } else {
    newSchema.items[field] = value
  }
  
  emit('update:schema', newSchema)
}

// 更新数组项类型
const updateItemsType = (type: SupportedType) => {
  const newSchema = { ...localSchema.value }
  newSchema.items = getDefaultSchemaForType(type)
  emit('update:schema', newSchema)
}

// 初始化数组项配置
const initializeItems = () => {
  updateField('items', getDefaultSchemaForType('string'))
}
</script>

<template>
  <div class="array-property-editor">
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
    
    <!-- 数组项配置 -->
    <NCard title="数组项配置" size="small" class="mt-4">
      <div v-if="localSchema.items">
        <NForm label-placement="left" :label-width="100">
          <NFormItem label="项类型">
            <NSelect
              :value="localSchema.items.type"
              :options="typeOptions"
              @update:value="updateItemsType"
              placeholder="选择项类型"
            />
          </NFormItem>
          
          <NFormItem label="项标题">
            <NInput
              :value="localSchema.items.title || ''"
              @update:value="(value) => updateItemsField('title', value)"
              placeholder="输入项标题"
            />
          </NFormItem>
          
          <NFormItem label="项描述">
            <NInput
              type="textarea"
              :value="localSchema.items.description || ''"
              @update:value="(value) => updateItemsField('description', value)"
              placeholder="输入项描述"
              :rows="2"
            />
          </NFormItem>
          
          <!-- 字符串类型项配置 -->
          <template v-if="localSchema.items.type === 'string'">
            <NFormItem label="项默认值">
              <NInput
                :value="localSchema.items.default || ''"
                @update:value="(value) => updateItemsField('default', value)"
                placeholder="输入默认值"
              />
            </NFormItem>
            
            <NFormItem label="最小长度">
              <NInputNumber
                :value="localSchema.items.minLength"
                @update:value="(value) => updateItemsField('minLength', value)"
                :min="0"
                placeholder="最小长度"
              />
            </NFormItem>
            
            <NFormItem label="最大长度">
              <NInputNumber
                :value="localSchema.items.maxLength"
                @update:value="(value) => updateItemsField('maxLength', value)"
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
                @update:value="(value) => updateItemsField('default', value)"
                placeholder="输入默认值"
                :precision="localSchema.items.type === 'integer' ? 0 : undefined"
              />
            </NFormItem>
            
            <NFormItem label="最小值">
              <NInputNumber
                :value="localSchema.items.minimum"
                @update:value="(value) => updateItemsField('minimum', value)"
                placeholder="最小值"
                :precision="localSchema.items.type === 'integer' ? 0 : undefined"
              />
            </NFormItem>
            
            <NFormItem label="最大值">
              <NInputNumber
                :value="localSchema.items.maximum"
                @update:value="(value) => updateItemsField('maximum', value)"
                placeholder="最大值"
                :precision="localSchema.items.type === 'integer' ? 0 : undefined"
              />
            </NFormItem>
          </template>
          
          <!-- 布尔类型项配置 -->
          <template v-if="localSchema.items.type === 'boolean'">
            <NFormItem label="项默认值">
              <NSwitch
                :value="localSchema.items.default || false"
                @update:value="(value) => updateItemsField('default', value)"
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
                  const newItems = { ...localSchema.items }
                  newItems.items = getDefaultSchemaForType(type)
                  updateField('items', newItems)
                }"
                placeholder="选择嵌套项类型"
              />
            </NFormItem>
          </template>
        </NForm>
      </div>
      
      <div v-else class="text-center text-gray-500 py-4">
        <NButton @click="initializeItems">
          添加数组项配置
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.array-property-editor {
  width: 100%;
}

:deep(.n-form-item) {
  margin-bottom: 16px;
}

:deep(.n-form-item__label) {
  font-weight: 500;
  color: rgba(51, 54, 57, 0.8);
}

:deep(.n-input), :deep(.n-input-number), :deep(.n-select) {
  transition: all 0.2s ease;
}

:deep(.n-input:hover), :deep(.n-input-number:hover), :deep(.n-select:hover) {
  box-shadow: 0 2px 8px rgba(24, 160, 88, 0.1);
}

:deep(.n-input:focus-within), :deep(.n-input-number:focus-within), :deep(.n-select:focus-within) {
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
}

:deep(.n-card) {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
</style>