<script setup lang="ts">
import { computed } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NSwitch
} from 'naive-ui'

interface BooleanSchema {
  type: 'boolean'
  title?: string
  description?: string
  default?: boolean
  const?: boolean
}

interface Props {
  schema: BooleanSchema
}

interface Emits {
  (e: 'update:schema', schema: BooleanSchema): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 计算属性用于双向绑定
const localSchema = computed({
  get: () => props.schema,
  set: (value) => emit('update:schema', value)
})

// 更新字段值
const updateField = (field: keyof BooleanSchema, value: any) => {
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
  <div class="boolean-property-editor">
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
        <NSwitch
          :value="localSchema.default || false"
          @update:value="(value) => updateField('default', value)"
        />
      </NFormItem>
    </NForm>
  </div>
</template>

<style scoped>
.boolean-property-editor {
  width: 100%;
}

:deep(.n-form-item) {
  margin-bottom: 16px;
}

:deep(.n-form-item__label) {
  font-weight: 500;
  color: rgba(51, 54, 57, 0.8);
}

:deep(.n-input), :deep(.n-switch) {
  transition: all 0.2s ease;
}

:deep(.n-input:hover) {
  box-shadow: 0 2px 8px rgba(24, 160, 88, 0.1);
}

:deep(.n-input:focus-within) {
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.2);
}
</style>