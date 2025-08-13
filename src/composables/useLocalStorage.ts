import { ref, watch, type Ref } from 'vue'

/**
 * 浏览器本地存储 composable
 * @param key 存储键名
 * @param defaultValue 默认值
 * @param options 配置选项
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: {
    serializer?: {
      read: (value: string) => T
      write: (value: T) => string
    }
    syncAcrossTabs?: boolean
  } = {}
) {
  const {
    serializer = {
      read: (v: string) => {
        try {
          return JSON.parse(v)
        } catch {
          return v as T
        }
      },
      write: (v: T) => JSON.stringify(v)
    },
    syncAcrossTabs = true
  } = options

  // 从localStorage读取初始值
  const read = (): T => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) {
        return defaultValue
      }
      return serializer.read(item)
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return defaultValue
    }
  }

  // 写入localStorage
  const write = (value: T): void => {
    try {
      localStorage.setItem(key, serializer.write(value))
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error)
    }
  }

  // 删除localStorage项
  const remove = (): void => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }

  // 创建响应式引用
  const storedValue = ref(read()) as Ref<T>

  // 监听值变化并自动保存
  watch(
    storedValue,
    (newValue) => {
      write(newValue)
    },
    { deep: true }
  )

  // 跨标签页同步
  if (syncAcrossTabs) {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          storedValue.value = serializer.read(e.newValue)
        } catch (error) {
          console.warn(`Error syncing localStorage key "${key}" across tabs:`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 清理函数
    const cleanup = () => {
      window.removeEventListener('storage', handleStorageChange)
    }

    return {
      value: storedValue,
      remove,
      cleanup
    }
  }

  return {
    value: storedValue,
    remove
  }
}

/**
 * JSON Schema 编辑器专用的本地存储 composable
 */
export function useSchemaStorage() {
  const STORAGE_KEY = 'fox-json-schema-editor-data'
  
  const { value: schemaData, remove } = useLocalStorage(STORAGE_KEY, {
    jsonSchemaText: '',
    lastModified: Date.now()
  })

  // 保存 schema 数据
  const saveSchema = (jsonSchemaText: string) => {
    schemaData.value = {
      jsonSchemaText,
      lastModified: Date.now()
    }
  }

  // 获取保存的 schema 数据
  const getSavedSchema = () => {
    return schemaData.value.jsonSchemaText
  }

  // 检查是否有保存的数据
  const hasSavedData = () => {
    return schemaData.value.jsonSchemaText.trim() !== ''
  }

  // 获取最后修改时间
  const getLastModified = () => {
    return new Date(schemaData.value.lastModified)
  }

  // 清除保存的数据
  const clearSavedData = () => {
    remove()
  }

  return {
    saveSchema,
    getSavedSchema,
    hasSavedData,
    getLastModified,
    clearSavedData
  }
}