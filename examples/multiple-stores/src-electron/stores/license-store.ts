import useLicenseStore from "../shared/stores/license";
import {mainSync} from "./";

export function initLicenseStore() {
	const licenseStore = useLicenseStore(mainSync.getPinia());

	mainSync.registerStore('license', licenseStore, {
		persist: false
	});
}
