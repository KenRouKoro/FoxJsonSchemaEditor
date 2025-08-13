<template>
  <div id="app">
    <NMessageProvider>
      <router-view />
    </NMessageProvider>
  </div>
</template>

<script setup lang="ts">
import { NMessageProvider } from 'naive-ui'
</script>