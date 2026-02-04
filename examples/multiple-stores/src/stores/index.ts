import {createPinia, defineStore} from 'pinia';
import { createRendererSync } from 'electron-pinia-sync/renderer';

export default defineStore(() => {
	const pinia = createPinia();
	pinia.use(createRendererSync({
		debug: 'verbose'
	}));
	return pinia;
});
