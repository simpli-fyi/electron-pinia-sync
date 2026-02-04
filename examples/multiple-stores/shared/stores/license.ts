import {defineStore} from "pinia";

type LicenseState = 'unlicensed' | 'trial' | 'licensed';

interface ILicenseStore {
	state: LicenseState;
}

const useLicenseStore = defineStore('license', {
	state: (): ILicenseStore => ({
		state: 'unlicensed'
	}),
	actions: {},
});

export default useLicenseStore;
