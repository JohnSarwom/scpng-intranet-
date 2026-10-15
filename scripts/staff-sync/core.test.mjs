import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibility, validateSource, planList, assertRemovalLimit, resolveColumns} from './core.mjs';

const config = {allowedDomains: ['scpng.gov.pg'], excludedEmails: ['automation@scpng.gov.pg']};
const user = (overrides = {}) => ({id: 'user-1', displayName: 'Example Officer', mail: 'officer@scpng.gov.pg', userPrincipalName: 'officer@scpng.gov.pg', department: 'IT Unit', officeLocation: 'Corporate Services', jobTitle: 'Officer', userType: 'Member', assignedLicenses: [{skuId: 'sku-1'}], ...overrides});
const target = {name: 'Employee_Profiles', fields: {id: 'EntraUserId', mail: 'Title', department: 'Department'}};
const columns = Object.values(target.fields).map(name => ({name, displayName: name}));
const item = (fields = {}, id = '1') => ({id, eTag: '"v1"', fields: {Title: 'officer@scpng.gov.pg', EntraUserId: 'user-1', Department: 'IT Unit', ProfilePhoto: 'preserved.jpg', ...fields}});

test('licence and each required profile field determine eligibility', () => {
  assert.deepEqual(eligibility(user(), config), []);
  assert.ok(eligibility(user({assignedLicenses: []}), config).includes('unlicensed'));
  for (const field of ['displayName', 'mail', 'department', 'officeLocation']) assert.ok(eligibility(user({[field]: '  '}), config).includes(`missing ${field}`));
  assert.ok(eligibility(user({mail: 'not-an-email'}), config).includes('invalid email'));
  assert.ok(eligibility(user({userType: 'Guest'}), config).length);
  assert.ok(eligibility(user({mail: 'automation@scpng.gov.pg'}), config).length);
});
test('missing licence data and empty snapshots abort rather than infer removals', () => {
  assert.throws(() => validateSource([]), /Empty/);
  const incomplete = user(); delete incomplete.assignedLicenses;
  assert.throws(() => planList([incomplete], [item()], target, columns, config), /omitted assignedLicenses/);
});
test('updates by stable ID preserve photo fields and survive email changes', () => {
  const plan = planList([user({mail: 'new@scpng.gov.pg'})], [item()], target, columns, config);
  assert.deepEqual(plan.actions, [{type: 'update', itemId: '1', eTag: '"v1"', email: 'new@scpng.gov.pg', fields: {Title: 'new@scpng.gov.pg'}}]);
});
test('existing eligible user stays; qualifying missing user is added', () => {
  assert.equal(planList([user()], [item()], target, columns, config).actions.length, 0);
  assert.equal(planList([user()], [], target, columns, config).actions[0].type, 'create');
});
test('legacy row matches email case-insensitively and receives stable ID', () => {
  const plan = planList([user()], [item({Title: 'OFFICER@scpng.gov.pg', EntraUserId: ''})], target, columns, config);
  assert.equal(plan.actions[0].fields.EntraUserId, 'user-1');
});
test('unlicensed, missing users and duplicates are removed with reasons', () => {
  assert.deepEqual(planList([user({assignedLicenses: []})], [item()], target, columns, config).actions[0].reasons, ['unlicensed']);
  assert.deepEqual(planList([user({id: 'other', mail: 'other@scpng.gov.pg', userPrincipalName: 'other@scpng.gov.pg'})], [item()], target, columns, config).actions[0].reasons, ['no matching Microsoft 365 user']);
  const plan = planList([user()], [item(), item({}, '2')], target, columns, config);
  assert.deepEqual(plan.actions[0].reasons, ['duplicate staff entry']);
  assert.throws(() => assertRemovalLimit([plan], 25), /exceed/);
  assert.doesNotThrow(() => assertRemovalLimit([plan], 100));
});
test('display labels resolve to actual internal names; wrong schemas fail closed', () => {
  assert.equal(resolveColumns([{name: 'Email_x0020_', displayName: 'Email '}], {name: 'staff', fields: {mail: 'Email'}}).mail, 'Email_x0020_');
  assert.throws(() => resolveColumns([], target), /Missing/);
  assert.throws(() => planList([user()], [{id: '1', fields: {}}], target, columns, config), /eTag/);
});
test('ambiguous directory addresses abort', () => {
  assert.throws(() => planList([user(), user({id: 'user-2'})], [], target, columns, config), /Ambiguous/);
});
