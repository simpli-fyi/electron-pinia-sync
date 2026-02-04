import {defineStore} from 'pinia';
import {mainSync} from "app/src-electron/stores/index";

interface NestedItem {
	test2: string;
}

interface TopLevelItem {
	test: string;
	testArray: NestedItem[];
}

export function initCounterStore() {

	const useCounterStore = defineStore('counter', {
		state: () => ({
			count: 0,
			name: 'Counter',
			items: [] as TopLevelItem[],
		}),
		actions: {
			increment() {
				this.count++;
			},

			// Top-level actions
			addTopLevelItem(test: string) {
				this.items.push({test, testArray: []});
			},

			deleteTopLevelItem(index: number) {
				if (index >= 0 && index < this.items.length) {
					this.items.splice(index, 1);
				}
			},

			moveTopLevelItem(index: number, direction: 'up' | 'down') {
				if (direction === 'up' && index > 0) {
					const temp = this.items[index]!;
					this.items[index] = this.items[index - 1]!;
					this.items[index - 1] = temp;
				} else if (direction === 'down' && index < this.items.length - 1) {
					const temp = this.items[index]!;
					this.items[index] = this.items[index + 1]!;
					this.items[index + 1] = temp;
				}
			},

			editTopLevelItem(index: number, newTest: string) {
				if (index >= 0 && index < this.items.length) {
					this.items[index]!.test = newTest;
				}
			},

			// Nested-level actions
			addNestedItem(topIndex: number, test2: string) {
				if (topIndex >= 0 && topIndex < this.items.length) {
					this.items[topIndex]!.testArray.push({test2});
				}
			},

			deleteNestedItem(topIndex: number, nestedIndex: number) {
				if (topIndex >= 0 && topIndex < this.items.length) {
					const testArray = this.items[topIndex]!.testArray;
					if (nestedIndex >= 0 && nestedIndex < testArray.length) {
						testArray.splice(nestedIndex, 1);
					}
				}
			},

			moveNestedItem(topIndex: number, nestedIndex: number, direction: 'up' | 'down') {
				if (topIndex >= 0 && topIndex < this.items.length) {
					const testArray = this.items[topIndex]!.testArray;
					if (direction === 'up' && nestedIndex > 0) {
						const temp = testArray[nestedIndex]!;
						testArray[nestedIndex] = testArray[nestedIndex - 1]!;
						testArray[nestedIndex - 1] = temp;
					} else if (direction === 'down' && nestedIndex < testArray.length - 1) {
						const temp = testArray[nestedIndex]!;
						testArray[nestedIndex] = testArray[nestedIndex + 1]!;
						testArray[nestedIndex + 1] = temp;
					}
				}
			},

			editNestedItem(topIndex: number, nestedIndex: number, newTest2: string) {
				if (topIndex >= 0 && topIndex < this.items.length) {
					const testArray = this.items[topIndex]!.testArray;
					if (nestedIndex >= 0 && nestedIndex < testArray.length) {
						testArray[nestedIndex]!.test2 = newTest2;
					}
				}
			},
		},
	});

	const counterStore = useCounterStore(mainSync.getPinia());

	mainSync.registerStore('counter', counterStore, {
		persist: true
	});
}
