<template>
   <div class="empty">
      <div class="tevel-loader">
         <div
            class="tevel-earth"
            role="img"
            aria-label="Loading"
         >
            {{ earth }}
         </div>
         <div class="tevel-loader-msg">
            {{ message }}
         </div>
      </div>
   </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

// Cycling the three earth glyphs shows different continents — a real "rotating
// globe" without any fragile 3D CSS. Messages rotate 4× slower so they're readable.
const EARTHS = ['🌍', '🌎', '🌏'];
const MESSAGES = [
   'Cooking…',
   'Fetching fresh data for you…',
   'Spinning up the globe…',
   'Rummaging through the rows…',
   'Warming up the query engine…',
   'Plating it up…',
   'Almost there…'
];

const earth = ref(EARTHS[0]);
const message = ref(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

let e = 0;
let m = MESSAGES.indexOf(message.value);
let tick = 0;
const timer = setInterval(() => {
   e = (e + 1) % EARTHS.length;
   earth.value = EARTHS[e];
   if (++tick % 4 === 0) {
      m = (m + 1) % MESSAGES.length;
      message.value = MESSAGES[m];
   }
}, 450);

onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.empty {
  position: absolute;
  display: flex;
  height: 100%;
  flex-direction: column;
  left: 0;
  justify-content: center;
  right: 0;
}

.tevel-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.tevel-earth {
  font-size: 44px;
  line-height: 1;
  animation: tevel-bob 1.6s ease-in-out infinite;
}

.tevel-loader-msg {
  font-size: 13px;
  opacity: 0.6;
}

@keyframes tevel-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* Respect users who prefer no motion — keep the glyph/message cycle, drop the bob. */
@media (prefers-reduced-motion: reduce) {
  .tevel-earth { animation: none; }
}
</style>
