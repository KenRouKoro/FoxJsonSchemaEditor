<script setup lang="ts">
import { computed } from 'vue'
import {
  NCard,
  NSelect,
  NFormItem
} from 'naive-ui'
import { SUPPORTED_TYPES, getDefaultSchemaForType, type SupportedType } from '../lib/schemaValidator'
import StringPropertyEditor from './StringPropertyEditor.vue'
import NumberPropertyEditor from './NumberPropertyEditor.vue'
import BooleanPropertyEditor from './BooleanPropertyEditor.vue'
import ArrayPropertyEditor from './ArrayPropertyEditor.vue'
import ObjectPropertyEditor from './ObjectPropertyEditor.vue'

interface JsonSchema {
  type?: SupportedType
  title?: string
  description?: string
  default?: any
  [key: string]: any
}

interface Props {
  schema: JsonSchema
  depth?: number
  maxDepth?: number
  showTypeSelector?: boolean
  showCard?: boolean
}

interface Emits {
  (e: 'update:schema', schema: JsonSchema): void
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  maxDepth: 10,
  showTypeSelector: true,
  showCard: true
})
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
  
  emit('update:schema', newSchema)
}

// 更新schema
const updateSchema = (newSchema: JsonSchema) => {
  emit('update:schema', newSchema)
}

// 获取当前类型
const currentType = computed(() => localSchema.value.type || 'string')

// 获取卡片标题
const cardTitle = computed(() => {
  const typeLabel = getTypeLabel(currentType.value)
  return props.depth > 0 ? `${typeLabel} (深度 ${props.depth})` : `${typeLabel}配置`
})
</script>

<template>
  <div class="property-editor">
    <NCard v-if="showCard" :title="cardTitle" size="small">
      <!-- 类型选择器 -->
      <div v-if="showTypeSelector" class="mb-4">
        <NFormItem label="属性类型" label-placement="left" :label-width="100">
          <NSelect
            :value="currentType"
            :options="typeOptions"
            @update:value="updateSchemaType"
            placeholder="选择属性类型"
          />
        </NFormItem>
      </div>
      
      <!-- 根据类型渲染对应的编辑器 -->
      <StringPropertyEditor
        v-if="currentType === 'string'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <NumberPropertyEditor
        v-else-if="currentType === 'number' || currentType === 'integer'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <BooleanPropertyEditor
        v-else-if="currentType === 'boolean'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <ArrayPropertyEditor
        v-else-if="currentType === 'array'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <ObjectPropertyEditor
        v-else-if="currentType === 'object'"
        :schema="localSchema as any"
        :depth="depth"
        :max-depth="maxDepth"
        @update:schema="updateSchema"
      />
    </NCard>
    
    <!-- 无卡片模式 -->
    <div v-else>
      <!-- 类型选择器 -->
      <div v-if="showTypeSelector" class="mb-4">
        <NFormItem label="属性类型" label-placement="left" :label-width="100">
          <NSelect
            :value="currentType"
            :options="typeOptions"
            @update:value="updateSchemaType"
            placeholder="选择属性类型"
          />
        </NFormItem>
      </div>
      
      <!-- 根据类型渲染对应的编辑器 -->
      <StringPropertyEditor
        v-if="currentType === 'string'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <NumberPropertyEditor
        v-else-if="currentType === 'number' || currentType === 'integer'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <BooleanPropertyEditor
        v-else-if="currentType === 'boolean'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <ArrayPropertyEditor
        v-else-if="currentType === 'array'"
        :schema="localSchema as any"
        @update:schema="updateSchema"
      />
      
      <ObjectPropertyEditor
        v-else-if="currentType === 'object'"
        :schema="localSchema as any"
        :depth="depth"
        :max-depth="maxDepth"
        @update:schema="updateSchema"
      />
    </div>
  </div>
</template>

<style scoped>
.property-editor {
  width: 100%;
}

:deep(.n-card) {
  border-radius: 8px;
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
  margin-bottom: 16px;
}

:deep(.n-form-item__label) {
  font-weight: 500;
  color: rgba(51, 54, 57, 0.8);
}

:deep(.n-select) {
  transition: all 0.2s ease;
}

:deep(.n-select:hover) {
  box-shadow: 0 2px 8px rgba(24, 160, 88, 0.1);
}

:deep(.n-select:focus-within) {
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
}
</style>