/**
 * E2E Functional Tests for electron-pinia-sync
 *
 * These tests verify the actual functionality of the sync logic
 * by simulating the Main ↔ Renderer communication flow.
 */

import { test, expect } from '@playwright/test';

// Helper: Simulate toRawState utility (same implementation as in src/utils/toRawState.ts)
function toRawState(state: any): any {
  return JSON.parse(JSON.stringify(state));
}

test.describe('Sync Logic Verification', () => {
  test('microdiff should detect nested object changes', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      user: { name: 'John', profile: { age: 30, city: 'Berlin' } }
    };
    const newState = {
      user: { name: 'John', profile: { age: 31, city: 'Berlin' } }
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
    expect(differences[0].path.join('.')).toBe('user.profile.age');
  });

  test('microdiff should detect array item additions', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = { items: ['a', 'b'] };
    const newState = { items: ['a', 'b', 'c'] };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
  });

  test('microdiff should detect array item removals', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = { items: ['a', 'b', 'c'] };
    const newState = { items: ['a', 'c'] };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
  });

  test('microdiff should detect object modifications in arrays', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      todos: [
        { id: 1, text: 'Buy milk', completed: false },
        { id: 2, text: 'Walk dog', completed: false }
      ]
    };
    const newState = {
      todos: [
        { id: 1, text: 'Buy milk', completed: true },
        { id: 2, text: 'Walk dog', completed: false }
      ]
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);

    // Should detect the completed field change
    const completedChange = differences.find(d => d.path.includes('completed'));
    expect(completedChange).toBeDefined();
  });

  test('microdiff should detect deep nesting changes', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      level1: {
        level2: {
          level3: {
            value: 1,
            items: ['a', 'b']
          }
        }
      }
    };
    const newState = {
      level1: {
        level2: {
          level3: {
            value: 42,
            items: ['a', 'b', 'c']
          }
        }
      }
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Deeply Nested Array Detection', () => {
  test('microdiff should detect deeply nested array changes (3 levels)', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      sections: [
        {
          id: 1,
          groups: [
            {
              id: 1,
              tasks: [
                { id: 1, title: 'Task 1', done: false }
              ]
            }
          ]
        }
      ]
    };

    const newState = {
      sections: [
        {
          id: 1,
          groups: [
            {
              id: 1,
              tasks: [
                { id: 1, title: 'Task 1', done: true }
              ]
            }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);

    // Should detect the done field change
    const doneChange = differences.find(d => d.path.includes('done'));
    expect(doneChange).toBeDefined();
  });

  test('microdiff should detect adding to deeply nested array', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' }
          ]
        }
      ]
    };

    const newState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' },
            { id: 2, title: 'Buy eggs' }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
  });

  test('microdiff should detect removing from deeply nested array', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' },
            { id: 2, title: 'Buy eggs' },
            { id: 3, title: 'Buy bread' }
          ]
        }
      ]
    };

    const newState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' },
            { id: 3, title: 'Buy bread' }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
  });

  test('microdiff should detect modifications in deeply nested objects within arrays', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk', metadata: { priority: 'low' } }
          ]
        }
      ]
    };

    const newState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk', metadata: { priority: 'high', urgent: true } }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    expect(differences.length).toBeGreaterThan(0);
  });
});

test.describe('Deeply Nested Patch Calculation', () => {
  test('should build correct patch for deeply nested array modification', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' }
          ]
        }
      ]
    };

    const newState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          items: [
            { id: 1, title: 'Buy milk' },
            { id: 2, title: 'Buy eggs' }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      patch[topLevelKey as string] = newState[topLevelKey as keyof typeof newState];
    }

    // Verify entire categories array is in patch
    expect(patch.categories).toBeDefined();
    expect(patch.categories.length).toBe(1);
    expect(patch.categories[0].items.length).toBe(2);
    // Verify original data preserved
    expect(patch.categories[0].name).toBe('Shopping');
  });

  test('should build correct patch for three-level nested modification', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      data: {
        sections: [
          {
            id: 1,
            title: 'Project A',
            groups: [
              {
                id: 1,
                name: 'Dev',
                tasks: [
                  { id: 1, description: 'Task 1', tags: ['urgent'] }
                ]
              }
            ]
          }
        ]
      }
    };

    const newState = {
      data: {
        sections: [
          {
            id: 1,
            title: 'Project A',
            groups: [
              {
                id: 1,
                name: 'Dev',
                tasks: [
                  { id: 1, description: 'Task 1', tags: ['urgent', 'reviewed'] }
                ]
              }
            ]
          }
        ]
      }
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      patch[topLevelKey as string] = newState[topLevelKey as keyof typeof newState];
    }

    // Verify entire data structure is in patch
    expect(patch.data).toBeDefined();
    expect(patch.data.sections).toBeDefined();
    expect(patch.data.sections[0].groups[0].tasks[0].tags.length).toBe(2);
    // Verify all parent data preserved
    expect(patch.data.sections[0].title).toBe('Project A');
    expect(patch.data.sections[0].groups[0].name).toBe('Dev');
  });

  test('should preserve all sibling data in deeply nested patches', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          priority: 'high',
          items: [
            { id: 1, title: 'Buy milk', urgent: false }
          ]
        },
        {
          id: 2,
          name: 'Work',
          priority: 'medium',
          items: []
        }
      ]
    };

    const newState = {
      categories: [
        {
          id: 1,
          name: 'Shopping',
          priority: 'high',
          items: [
            { id: 1, title: 'Buy milk', urgent: true }
          ]
        },
        {
          id: 2,
          name: 'Work',
          priority: 'medium',
          items: []
        }
      ]
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      patch[topLevelKey as string] = newState[topLevelKey as keyof typeof newState];
    }

    // Verify all data preserved
    const cats = patch.categories;
    expect(cats.length).toBe(2);
    expect(cats[0].priority).toBe('high');
    expect(cats[1].name).toBe('Work');
  });
});

test.describe('Real-World Complex Scenarios', () => {
  test('should handle project management structure (sections > groups > tasks)', async () => {
    const { default: diff } = await import('microdiff');

    // Realistic project management state
    const oldState = {
      project: {
        sections: [
          {
            id: 1,
            title: 'Backend',
            groups: [
              {
                id: 1,
                name: 'API',
                tasks: [
                  { id: 1, desc: 'Create endpoint', status: 'todo', assignee: 'John' },
                  { id: 2, desc: 'Add validation', status: 'todo', assignee: 'Jane' }
                ]
              }
            ]
          }
        ]
      }
    };

    // User marks first task as done
    const newState = {
      project: {
        sections: [
          {
            id: 1,
            title: 'Backend',
            groups: [
              {
                id: 1,
                name: 'API',
                tasks: [
                  { id: 1, desc: 'Create endpoint', status: 'done', assignee: 'John' },
                  { id: 2, desc: 'Add validation', status: 'todo', assignee: 'Jane' }
                ]
              }
            ]
          }
        ]
      }
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      patch[topLevelKey as string] = newState[topLevelKey as keyof typeof newState];
    }

    // Verify complete structure preserved
    const section = patch.project.sections[0];
    const group = section.groups[0];
    const tasks = group.tasks;

    expect(tasks[0].status).toBe('done');
    expect(tasks[0].assignee).toBe('John');
    expect(tasks[1].status).toBe('todo');
    expect(group.name).toBe('API');
    expect(section.title).toBe('Backend');
  });

  test('should handle e-commerce structure (categories > products > variants)', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      catalog: [
        {
          id: 1,
          name: 'Electronics',
          products: [
            {
              id: 101,
              name: 'Laptop',
              variants: [
                { sku: 'LAP-001', size: '13inch', price: 999, stock: 10 },
                { sku: 'LAP-002', size: '15inch', price: 1299, stock: 5 }
              ]
            }
          ]
        }
      ]
    };

    // Stock update for one variant
    const newState = {
      catalog: [
        {
          id: 1,
          name: 'Electronics',
          products: [
            {
              id: 101,
              name: 'Laptop',
              variants: [
                { sku: 'LAP-001', size: '13inch', price: 999, stock: 8 },
                { sku: 'LAP-002', size: '15inch', price: 1299, stock: 5 }
              ]
            }
          ]
        }
      ]
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      patch[topLevelKey as string] = newState[topLevelKey as keyof typeof newState];
    }

    // Verify
    const variant = patch.catalog[0].products[0].variants[0];
    expect(variant.stock).toBe(8);
    expect(variant.size).toBe('13inch');
    expect(patch.catalog[0].name).toBe('Electronics');
  });
});

test.describe('IPC Serialization Verification', () => {
  test('patches should be serializable with structuredClone (simulates Electron IPC)', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      count: 0,
      user: { name: 'John', profile: { age: 30 } }
    };
    const newState = {
      count: 5,
      user: { name: 'John', profile: { age: 31 } }
    };

    const differences = diff(oldState, newState);

    // Build patch (top-level properties)
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      if (typeof topLevelKey === 'string') {
        patch[topLevelKey] = newState[topLevelKey as keyof typeof newState];
      }
    }

    // THIS IS THE KEY TEST: Can we structuredClone the patch?
    // In real Electron, ipcRenderer.invoke does this internally
    const cloned = structuredClone(patch);

    expect(cloned).toBeDefined();
    expect(cloned.count).toBe(5);
    expect(cloned.user).toBeDefined();
    expect(cloned.user.profile.age).toBe(31);
  });

  test('complex nested patches should be serializable', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      data: {
        sections: [
          {
            id: 1,
            groups: [
              { id: 1, tasks: [{ id: 1, done: false }] }
            ]
          }
        ]
      }
    };

    const newState = {
      data: {
        sections: [
          {
            id: 1,
            groups: [
              { id: 1, tasks: [{ id: 1, done: true }] }
            ]
          }
        ]
      }
    };

    const differences = diff(oldState, newState);
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      if (typeof topLevelKey === 'string') {
        patch[topLevelKey] = newState[topLevelKey as keyof typeof newState];
      }
    }

    // Test IPC serialization
    const cloned = structuredClone(patch);

    expect(cloned.data).toBeDefined();
    expect(cloned.data.sections[0].groups[0].tasks[0].done).toBe(true);
  });

  test('patches with arrays should be serializable', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      items: [{ id: 1, name: 'A' }]
    };
    const newState = {
      items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
    };

    const differences = diff(oldState, newState);
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      if (typeof topLevelKey === 'string') {
        patch[topLevelKey] = newState[topLevelKey as keyof typeof newState];
      }
    }

    // Test IPC serialization
    const cloned = structuredClone(patch);

    expect(cloned.items).toBeDefined();
    expect(cloned.items.length).toBe(2);
    expect(cloned.items[1].name).toBe('B');
  });

  test('toRawState utility should remove non-serializable data', () => {
    const state = {
      count: 5,
      user: { name: 'John' },
      callback: function() { return 'test'; }, // Functions should be removed
      undef: undefined, // undefined should be removed
      date: new Date('2026-01-31'), // Date becomes string
      valid: 'data'
    };

    const raw = toRawState(state);

    // Test that result is IPC-serializable
    const cloned = structuredClone(raw);

    // Verify cleaned data
    expect(cloned.callback).toBeUndefined(); // Function removed
    expect('undef' in cloned).toBe(false); // undefined removed
    expect(typeof cloned.date).toBe('string'); // Date converted to string
    expect(cloned.count).toBe(5);
    expect(cloned.valid).toBe('data');
  });

  test('real-world scenario: Vue reactive proxy should NOT be serializable directly', async () => {
    const { reactive } = await import('vue');

    // Create a reactive proxy (like Pinia stores do)
    const reactiveState = reactive({
      count: 5,
      user: { name: 'John' }
    });

    // Attempt to clone it directly (this should FAIL)
    expect(() => {
      structuredClone(reactiveState);
    }).toThrow(); // Should throw because reactive proxies cannot be cloned

    const rawState = toRawState(reactiveState);

    // Now it should be cloneable
    const cloned = structuredClone(rawState);

    expect(cloned.count).toBe(5);
    expect(cloned.user.name).toBe('John');
  });

  test('calculatePatch logic should produce IPC-safe patches', async () => {
    const { default: diff } = await import('microdiff');

    // This simulates the calculatePatch function from renderer/index.ts
    function calculatePatch(oldState: any, newState: any): any {
      const differences = diff(oldState, newState);

      if (differences.length === 0) {
        return {};
      }

      const patch: Record<string, any> = {};
      for (const change of differences) {
        if (change.path.length === 0) {
          return newState;
        }

        const topLevelKey = change.path[0];
        if (typeof topLevelKey === 'string' || typeof topLevelKey === 'number') {
          patch[topLevelKey] = newState[topLevelKey];
        }
      }

      return patch;
    }

    const oldState = {
      count: 0,
      nested: { value: 'old', data: { deep: 1 } }
    };

    const newState = {
      count: 0,
      nested: { value: 'new', data: { deep: 2 } }
    };

    const patch = calculatePatch(oldState, newState);

    // The patch should be serializable
    expect(() => structuredClone(patch)).not.toThrow();

    const cloned = structuredClone(patch);
    expect(cloned.nested.value).toBe('new');
    expect(cloned.nested.data.deep).toBe(2);
  });

  test('entire top-level property is sent when nested value changes', async () => {
    const { default: diff } = await import('microdiff');

    const oldState = {
      user: {
        name: 'John',
        email: 'john@example.com',
        profile: { age: 30, city: 'Berlin' }
      }
    };

    const newState = {
      user: {
        name: 'John',
        email: 'john@example.com',
        profile: { age: 31, city: 'Berlin' } // Only age changed
      }
    };

    const differences = diff(oldState, newState);

    // Build patch
    const patch: Record<string, any> = {};
    for (const change of differences) {
      const topLevelKey = change.path[0];
      if (typeof topLevelKey === 'string') {
        // Send entire top-level property
        patch[topLevelKey] = newState[topLevelKey as keyof typeof newState];
      }
    }

    // Verify entire user object is in patch (preserves siblings)
    expect(patch.user).toBeDefined();
    expect(patch.user.name).toBe('John'); // Sibling preserved
    expect(patch.user.email).toBe('john@example.com'); // Sibling preserved
    expect(patch.user.profile.age).toBe(31); // Changed value
    expect(patch.user.profile.city).toBe('Berlin'); // Nested sibling preserved

    // And it should be IPC-serializable
    const cloned = structuredClone(patch);
    expect(cloned.user.profile.city).toBe('Berlin');
  });
});

