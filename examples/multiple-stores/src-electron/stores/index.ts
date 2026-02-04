import {createMainSync} from "electron-pinia-sync/main";
import {app} from "electron";

export const mainSync = createMainSync({
	storeOptions: {
		name: 'my-test-app-store',
	},
	debug: 'verbose'
});

app.on('quit', () => {
	mainSync.destroy();
});
