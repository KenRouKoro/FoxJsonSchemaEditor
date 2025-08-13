<script setup lang="ts">
import { computed } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber
} from 'naive-ui'

interface StringSchema {
  type: 'string'
  title?: string
  description?: string
  default?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: string[]
  const?: string
}

interface Props {
  schema: StringSchema
}

interface Emits {
  (e: 'update:schema', schema: StringSchema): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 计算属性用于双向绑定
const localSchema = computed({
  get: () => props.schema,
  set: (value) => emit('update:schema', value)
})

// 更新字段值
const updateField = (field: keyof StringSchema, value: any) => {
  const newSchema = { ...localSchema.value }
  if (value === null || value === undefined || value === '') {
    delete newSchema[field]
  } else {
    ;(newSchema as any)[field] = value
  }
  emit('update:schema', newSchema)
}
</script>

<template>
  <div class="string-property-editor">
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
      
      <NFormItem label="默认值">
        <NInput
          :value="localSchema.default || ''"
          @update:value="(value) => updateField('default', value)"
          placeholder="输入默认值"
        />
      </NFormItem>
      
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
    </NForm>
  </div>
</template>

<style scoped>
.string-property-editor {
  width: 100%;
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