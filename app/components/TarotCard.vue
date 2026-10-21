<script setup lang="ts">
defineProps<{image:string;name:string;revealed:boolean;reversed?:boolean;index?:number;interactive?:boolean}>()
defineEmits<{open:[]}>()
</script>
<template>
  <button class="tarot-card" :class="{'is-revealed':revealed,'can-open':interactive}" :aria-label="revealed ? `Увеличить: ${name}${reversed?', перевёрнутая':''}` : `Открыть карту ${(index||0)+1}`" @click="$emit('open')">
    <span class="card-rotator">
      <span class="card-face card-back"><img src="/cards/78.jpg" alt="Рубашка карты" /><span class="back-glow"/><span class="back-hint"><UIcon name="i-lucide-sparkles"/>Коснитесь</span></span>
      <span class="card-face card-front"><img :src="image" :alt="name" :class="{'upside-down':reversed}" loading="eager" /></span>
    </span>
    <span v-if="index!==undefined" class="card-number">{{index+1}}</span>
  </button>
</template>
