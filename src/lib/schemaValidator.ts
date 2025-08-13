import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// 创建单例 AJV 实例
let ajvInstance: Ajv | null = null

function getAjvInstance(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    })
    addFormats(ajvInstance)
  }
  return ajvInstance
}

// 验证结果接口
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

// 验证 JSON Schema
export function validateJsonSchema(schema: any): ValidationResult {
  try {
    const ajv = getAjvInstance()
    const errors: string[] = []
    const warnings: string[] = []
    
    // 基本格式检查
    if (typeof schema !== 'object' || schema === null) {
      return {
        valid: false,
        errors: ['Schema 必须是一个对象']
      }
    }

    // 递归验证 Schema 结构
    const validateSchemaStructure = (obj: any, path: string = 'root'): void => {
      if (typeof obj !== 'object' || obj === null) return
      
      // 检查 type 字段
      if (obj.type && !SUPPORTED_TYPES.includes(obj.type)) {
        errors.push(`${path}: 不支持的类型 "${obj.type}"，支持的类型: ${SUPPORTED_TYPES.join(', ')}`)
      }
      
      // 检查数字类型的约束
      if (obj.type === 'number' || obj.type === 'integer') {
        if (obj.minimum !== undefined && obj.maximum !== undefined && obj.minimum > obj.maximum) {
          errors.push(`${path}: minimum (${obj.minimum}) 不能大于 maximum (${obj.maximum})`)
        }
        if (obj.exclusiveMinimum !== undefined && obj.exclusiveMaximum !== undefined && obj.exclusiveMinimum >= obj.exclusiveMaximum) {
          errors.push(`${path}: exclusiveMinimum 必须小于 exclusiveMaximum`)
        }
        if (obj.multipleOf !== undefined && obj.multipleOf <= 0) {
          errors.push(`${path}: multipleOf 必须大于 0`)
        }
      }

      // 检查字符串长度约束
      if (obj.type === 'string') {
        if (obj.minLength !== undefined && obj.maxLength !== undefined && obj.minLength > obj.maxLength) {
          errors.push(`${path}: minLength (${obj.minLength}) 不能大于 maxLength (${obj.maxLength})`)
        }
        if (obj.minLength !== undefined && obj.minLength < 0) {
          errors.push(`${path}: minLength 不能为负数`)
        }
        if (obj.pattern) {
          try {
            new RegExp(obj.pattern)
          } catch (e) {
            errors.push(`${path}: pattern 不是有效的正则表达式`)
          }
        }
      }

      // 检查数组长度约束
      if (obj.type === 'array') {
        if (obj.minItems !== undefined && obj.maxItems !== undefined && obj.minItems > obj.maxItems) {
          errors.push(`${path}: minItems (${obj.minItems}) 不能大于 maxItems (${obj.maxItems})`)
        }
        if (obj.minItems !== undefined && obj.minItems < 0) {
          errors.push(`${path}: minItems 不能为负数`)
        }
        // 递归验证数组项
        if (obj.items) {
          validateSchemaStructure(obj.items, `${path}.items`)
        }
      }

      // 检查对象属性约束
      if (obj.type === 'object') {
        if (obj.minProperties !== undefined && obj.maxProperties !== undefined && obj.minProperties > obj.maxProperties) {
          errors.push(`${path}: minProperties (${obj.minProperties}) 不能大于 maxProperties (${obj.maxProperties})`)
        }
        if (obj.minProperties !== undefined && obj.minProperties < 0) {
          errors.push(`${path}: minProperties 不能为负数`)
        }
        
        // 递归验证对象属性
        if (obj.properties) {
          for (const [propName, propSchema] of Object.entries(obj.properties)) {
            validateSchemaStructure(propSchema, `${path}.properties.${propName}`)
          }
        }
        
        // 检查 required 字段
        if (obj.required && Array.isArray(obj.required)) {
          const properties = obj.properties || {}
          for (const requiredProp of obj.required) {
            if (!(requiredProp in properties)) {
              warnings.push(`${path}: required 字段 "${requiredProp}" 在 properties 中未定义`)
            }
          }
        }
      }
      
      // 检查枚举值
      if (obj.enum && Array.isArray(obj.enum) && obj.enum.length === 0) {
        errors.push(`${path}: enum 数组不能为空`)
      }
    }
    
    // 开始验证
    validateSchemaStructure(schema)
    
    // 检查根级别的 type 字段
    if (!schema.type && !schema.$ref && !schema.allOf && !schema.anyOf && !schema.oneOf) {
      warnings.push('建议在根级别指定 type 字段')
    }
    
    // 尝试用 AJV 编译 Schema（更严格的验证）
    try {
      ajv.compile(schema)
    } catch (ajvError) {
      errors.push(`AJV 编译错误: ${ajvError instanceof Error ? ajvError.message : String(ajvError)}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}

// 验证数据是否符合 Schema
export function validateDataAgainstSchema(data: any, schema: any): ValidationResult {
  try {
    const ajv = getAjvInstance()
    const validate = ajv.compile(schema)
    const valid = validate(data)
    
    if (!valid && validate.errors) {
      const errors = validate.errors.map(error => {
        const path = error.instancePath || 'root'
        return `${path}: ${error.message}`
      })
      
      return {
        valid: false,
        errors
      }
    }

    return {
      valid: true,
      errors: []
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}

// 支持的 JSON Schema 类型
export const SUPPORTED_TYPES = [
  'string',
  'number', 
  'integer',
  'boolean',
  'array',
  'object'
] as const

export type SupportedType = typeof SUPPORTED_TYPES[number]

// 类型默认值
export const TYPE_DEFAULTS: Record<SupportedType, any> = {
  string: '',
  number: 0,
  integer: 0,
  boolean: false,
  array: [],
  object: {}
}

// 获取类型的默认 Schema
export function getDefaultSchemaForType(type: SupportedType): any {
  const baseSchema = { type }
  
  switch (type) {
    case 'string':
      return {
        ...baseSchema,
        minLength: 0,
        maxLength: 100
      }
    case 'number':
      return {
        ...baseSchema,
        minimum: 0
      }
    case 'integer':
      return {
        ...baseSchema,
        minimum: 0
      }
    case 'boolean':
      return baseSchema
    case 'array':
      return {
        ...baseSchema,
        items: { type: 'string' },
        minItems: 0
      }
    case 'object':
      return {
        ...baseSchema,
        properties: {},
        additionalProperties: false
      }
    default:
      return baseSchema
  }
}