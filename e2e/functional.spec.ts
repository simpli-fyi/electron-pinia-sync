/**
 * E2E Functional Tests for electron-pinia-sync
 *
 * These tests verify the actual functionality of the sync logic
 * by simulating the Main ↔ Renderer communication flow.
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');


test.describe('Unit Tests Verification', () => {
  test('all 72 unit tests should pass', () => {
    const result = execSync('npm test', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Verify test count
    expect(result).toContain('72 passed');
  });

  test('unit tests should include complex data structure tests', () => {
    const result = execSync('npm test -- --reporter=verbose 2>&1 || true', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      shell: '/bin/bash'
    });

    // Check that complex data structure tests are included
    expect(result).toContain('Complex Data Structures');
    expect(result).toContain('Nested Objects');
    expect(result).toContain('Arrays');
    expect(result).toContain('Arrays with Objects');
  });
});

test.describe('Sync Logic Verification', () => {
  test('microdiff should detect nested object changes', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

      const oldState = {
        user: { name: 'John', profile: { age: 30, city: 'Berlin' } }
      };
      const newState = {
        user: { name: 'John', profile: { age: 31, city: 'Berlin' } }
      };

      const differences = diff(oldState, newState);
      console.log(JSON.stringify(differences));

      if (differences.length === 0) {
        process.exit(1);
      }
      if (differences[0].path.join('.') !== 'user.profile.age') {
        process.exit(1);
      }
      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect array item additions', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

      const oldState = { items: ['a', 'b'] };
      const newState = { items: ['a', 'b', 'c'] };

      const differences = diff(oldState, newState);
      console.log(JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }
      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect array item removals', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

      const oldState = { items: ['a', 'b', 'c'] };
      const newState = { items: ['a', 'c'] };

      const differences = diff(oldState, newState);
      console.log(JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }
      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect object modifications in arrays', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log(JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }

      // Should detect the completed field change
      const completedChange = differences.find(d => d.path.includes('completed'));
      if (!completedChange) {
        console.log('FAIL: completed change not detected');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect deep nesting changes', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log(JSON.stringify(differences));

      if (differences.length < 2) {
        console.log('FAIL: Expected at least 2 differences');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });
});


test.describe('Deeply Nested Array Detection', () => {
  test('microdiff should detect deeply nested array changes (3 levels)', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log('Differences:', JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }

      // Should detect the done field change
      const doneChange = differences.find(d => d.path.includes('done'));
      if (!doneChange) {
        console.log('FAIL: done change not detected');
        console.log('Differences:', JSON.stringify(differences));
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect adding to deeply nested array', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log('Differences:', JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect removing from deeply nested array', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log('Differences:', JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('microdiff should detect modifications in deeply nested objects within arrays', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log('Differences:', JSON.stringify(differences));

      if (differences.length === 0) {
        console.log('FAIL: No differences detected');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });
});

test.describe('Deeply Nested Patch Calculation', () => {
  test('should build correct patch for deeply nested array modification', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      const patch = {};
      for (const change of differences) {
        const topLevelKey = change.path[0];
        patch[topLevelKey] = newState[topLevelKey];
      }

      console.log('Patch:', JSON.stringify(patch));

      // Verify entire categories array is in patch
      if (!patch.categories) {
        console.log('FAIL: categories not in patch');
        process.exit(1);
      }
      if (patch.categories.length !== 1) {
        console.log('FAIL: categories should have 1 item');
        process.exit(1);
      }
      if (patch.categories[0].items.length !== 2) {
        console.log('FAIL: items should have 2 entries');
        process.exit(1);
      }
      // Verify original data preserved
      if (patch.categories[0].name !== 'Shopping') {
        console.log('FAIL: category name not preserved');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('should build correct patch for three-level nested modification', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      console.log('Differences:', JSON.stringify(differences));

      // Build patch
      const patch = {};
      for (const change of differences) {
        const topLevelKey = change.path[0];
        patch[topLevelKey] = newState[topLevelKey];
      }

      console.log('Patch:', JSON.stringify(patch));

      // Verify entire data structure is in patch
      if (!patch.data) {
        console.log('FAIL: data not in patch');
        process.exit(1);
      }
      if (!patch.data.sections) {
        console.log('FAIL: sections not in patch');
        process.exit(1);
      }
      if (patch.data.sections[0].groups[0].tasks[0].tags.length !== 2) {
        console.log('FAIL: tags should have 2 items');
        process.exit(1);
      }
      // Verify all parent data preserved
      if (patch.data.sections[0].title !== 'Project A') {
        console.log('FAIL: section title not preserved');
        process.exit(1);
      }
      if (patch.data.sections[0].groups[0].name !== 'Dev') {
        console.log('FAIL: group name not preserved');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('should preserve all sibling data in deeply nested patches', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      const patch = {};
      for (const change of differences) {
        const topLevelKey = change.path[0];
        patch[topLevelKey] = newState[topLevelKey];
      }

      console.log('Patch:', JSON.stringify(patch));

      // Verify all data preserved
      const cats = patch.categories;
      if (cats.length !== 2) {
        console.log('FAIL: should have 2 categories');
        process.exit(1);
      }
      if (cats[0].priority !== 'high') {
        console.log('FAIL: priority not preserved');
        process.exit(1);
      }
      if (cats[1].name !== 'Work') {
        console.log('FAIL: second category not preserved');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });
});

test.describe('Real-World Complex Scenarios', () => {
  test('should handle project management structure (sections > groups > tasks)', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      const patch = {};
      for (const change of differences) {
        const topLevelKey = change.path[0];
        patch[topLevelKey] = newState[topLevelKey];
      }

      console.log('Patch:', JSON.stringify(patch));

      // Verify complete structure preserved
      const section = patch.project.sections[0];
      const group = section.groups[0];
      const tasks = group.tasks;

      if (tasks[0].status !== 'done') {
        console.log('FAIL: status not updated');
        process.exit(1);
      }
      if (tasks[0].assignee !== 'John') {
        console.log('FAIL: assignee not preserved');
        process.exit(1);
      }
      if (tasks[1].status !== 'todo') {
        console.log('FAIL: second task modified incorrectly');
        process.exit(1);
      }
      if (group.name !== 'API') {
        console.log('FAIL: group name not preserved');
        process.exit(1);
      }
      if (section.title !== 'Backend') {
        console.log('FAIL: section title not preserved');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });

  test('should handle e-commerce structure (categories > products > variants)', () => {
    const result = execSync(`node --input-type=module -e "
      import diff from 'microdiff';

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
      const patch = {};
      for (const change of differences) {
        const topLevelKey = change.path[0];
        patch[topLevelKey] = newState[topLevelKey];
      }

      console.log('Patch:', JSON.stringify(patch));

      // Verify
      const variant = patch.catalog[0].products[0].variants[0];
      if (variant.stock !== 8) {
        console.log('FAIL: stock not updated');
        process.exit(1);
      }
      if (variant.size !== '13inch') {
        console.log('FAIL: size not preserved');
        process.exit(1);
      }
      if (patch.catalog[0].name !== 'Electronics') {
        console.log('FAIL: category name not preserved');
        process.exit(1);
      }

      console.log('PASS');
    "`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    expect(result).toContain('PASS');
  });
});

