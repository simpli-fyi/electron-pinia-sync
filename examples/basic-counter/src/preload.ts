// Preload script - exposes Pinia sync API to renderer
import { exposeElectronPiniaSync } from 'electron-pinia-sync/preload';

// Expose with debug logging enabled
exposeElectronPiniaSync({ debug: true });
