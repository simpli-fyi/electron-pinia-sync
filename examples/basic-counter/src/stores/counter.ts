import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0,
    name: 'Electron Counter',
  }),

  getters: {
    doubleCount: (state) => state.count * 2,
  },

  actions: {
    increment() {
      this.count++;
    },

    decrement() {
      this.count--;
    },

    reset() {
      this.count = 0;
    },

    setName(name: string) {
      this.name = name;
    },
  },
});

