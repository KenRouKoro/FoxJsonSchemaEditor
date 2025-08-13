<script setup lang="ts">
import { computed } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber
} from 'naive-ui'

interface NumberSchema {
  type: 'number' | 'integer'
  title?: string
  description?: string
  default?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  enum?: number[]
  const?: number
}

interface Props {
  schema: NumberSchema
}

interface Emits {
  (e: 'update:schema', schema: NumberSchema): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 计算属性用于双向绑定
const localSchema = computed({
  get: () => props.schema,
  set: (value) => emit('update:schema', value)
})

// 更新字段值
const updateField = (field: keyof NumberSchema, value: any) => {
  const newSchema = { ...localSchema.value }
  if (value === null || value === undefined || value === '') {
    delete (newSchema as any)[field]
  } else {
    ;(newSchema as any)[field] = value
  }
  emit('update:schema', newSchema)
}

// 判断是否为整数类型
const isInteger = computed(() => localSchema.value.type === 'integer')
</script>

<template>
  <div class="number-property-editor">
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
        <NInputNumber
          :value="localSchema.default"
          @update:value="(value) => updateField('default', value)"
          placeholder="输入默认值"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
      
      <NFormItem label="最小值">
        <NInputNumber
          :value="localSchema.minimum"
          @update:value="(value) => updateField('minimum', value)"
          placeholder="最小值"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
      
      <NFormItem label="最大值">
        <NInputNumber
          :value="localSchema.maximum"
          @update:value="(value) => updateField('maximum', value)"
          placeholder="最大值"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
      
      <NFormItem label="排他最小值">
        <NInputNumber
          :value="localSchema.exclusiveMinimum"
          @update:value="(value) => updateField('exclusiveMinimum', value)"
          placeholder="排他最小值（不包含此值）"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
      
      <NFormItem label="排他最大值">
        <NInputNumber
          :value="localSchema.exclusiveMaximum"
          @update:value="(value) => updateField('exclusiveMaximum', value)"
          placeholder="排他最大值（不包含此值）"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
      
      <NFormItem label="倍数">
        <NInputNumber
          :value="localSchema.multipleOf"
          @update:value="(value) => updateField('multipleOf', value)"
          :min="0"
          placeholder="必须是此数的倍数"
          :precision="isInteger ? 0 : undefined"
        />
      </NFormItem>
    </NForm>
  </div>
</template>

<style scoped>
.number-property-editor {
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