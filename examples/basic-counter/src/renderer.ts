import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRendererSync } from 'electron-pinia-sync/renderer';
import App from './App.vue';

const pinia = createPinia();

// Add the sync plugin
pinia.use(createRendererSync());

const app = createApp(App);
app.use(pinia);
app.mount('#app');

console.log('[Renderer] App mounted with Pinia sync');

