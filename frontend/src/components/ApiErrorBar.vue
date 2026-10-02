<script setup>
/* 顶部错误横幅（对应原生版的 #apiError / #apiErrorMsg / #apiRetry）
 * 局部降级：谁失败报谁，文案由调用方给（与 UI.partError 同口径）。
 * 可见性靠 .api-error.hide（board.css 已有 `.api-error.hide{display:none}` 兜底）。
 */
defineProps({ msg: { type: String, default: '' } });
defineEmits(['retry']);
</script>

<template>
  <div id="apiError" class="api-error" :class="{ hide: !msg }">
    <span id="apiErrorMsg">{{ msg }}</span>
    <button id="apiRetry" type="button" @click="$emit('retry')">重试</button>
  </div>
</template>
