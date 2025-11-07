<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

withDefaults(defineProps<Props>(), {
  show: false,
  size: 'md'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl'
}

const handleBackdropClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        @click="handleBackdropClick"
      >
        <Transition
          enter-active-class="transition-transform duration-200"
          enter-from-class="scale-95 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition-transform duration-200"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-95 opacity-0"
        >
          <div v-if="show" :class="['bg-white rounded-lg shadow-xl w-full', sizeClasses[size]]">
            <!-- 标题栏 -->
            <div
              v-if="title || $slots.header"
              class="px-6 py-4 border-b border-gray-200 flex items-center justify-between"
            >
              <slot name="header">
                <h3 class="text-xl font-semibold text-gray-900">{{ title }}</h3>
              </slot>
              <button
                @click="emit('close')"
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- 内容区 -->
            <div class="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <slot></slot>
            </div>

            <!-- 底部操作栏 -->
            <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <slot name="footer"></slot>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
