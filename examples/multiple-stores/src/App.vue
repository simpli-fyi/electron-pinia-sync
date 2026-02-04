<template>
  <div class="app">
    <header>
      <h1>{{ counter.name }}</h1>
      <p class="subtitle">electron-pinia-sync example</p>
    </header>

    <main>
      <div class="counter-display">
        <div class="count">{{ counter.count }}</div>
        <div class="double">Double: {{ counter.doubleCount }}</div>
      </div>

      <div class="controls">
        <button @click="counter.decrement()" class="btn btn-secondary">
          <span>-</span> Decrement
        </button>
        <button @click="counter.increment()" class="btn btn-primary">
          <span>+</span> Increment
        </button>
        <button @click="counter.reset()" class="btn btn-danger">
          🔄 Reset
        </button>
      </div>

      <div class="info">
        <h3>How to test synchronization:</h3>
        <ol>
          <li>Click the buttons to change the counter</li>
          <li>Close and reopen the app - the value persists! 💾</li>
          <li>Open multiple windows to see real-time sync 🔄</li>
        </ol>
      </div>

      <div class="name-input">
        <label for="name">Counter Name:</label>
        <input
          id="name"
          v-model="localName"
          @change="updateName"
          type="text"
          placeholder="Enter counter name"
        />
      </div>
    </main>

    <footer>
      <p>State is synchronized between Main and Renderer processes</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useCounterStore } from './stores/counter';

const counter = useCounterStore();
const localName = ref(counter.name);

// Watch for changes from other processes
watch(() => counter.name, (newName) => {
  localName.value = newName;
});

function updateName() {
  counter.setName(localName.value);
}
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

header {
  text-align: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.2);
}

h1 {
  margin: 0;
  font-size: 3rem;
  font-weight: 700;
}

.subtitle {
  margin: 0.5rem 0 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.counter-display {
  text-align: center;
  margin-bottom: 3rem;
}

.count {
  font-size: 8rem;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.double {
  font-size: 1.5rem;
  opacity: 0.8;
  margin-top: 1rem;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 3rem;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #10b981;
  color: white;
}

.btn-secondary {
  background: #3b82f6;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn span {
  font-size: 1.5rem;
}

.info {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  margin-bottom: 2rem;
}

.info h3 {
  margin-top: 0;
}

.info ol {
  text-align: left;
  line-height: 1.8;
}

.name-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 300px;
  width: 100%;
}

.name-input label {
  font-weight: 600;
}

.name-input input {
  padding: 0.75rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: border-color 0.2s;
}

.name-input input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.name-input input:focus {
  outline: none;
  border-color: white;
  background: rgba(255, 255, 255, 0.2);
}

footer {
  text-align: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  font-size: 0.9rem;
  opacity: 0.8;
}
</style>

