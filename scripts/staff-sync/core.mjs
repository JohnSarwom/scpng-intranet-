const clean = value => typeof value === 'string' ? value.trim() : '';
export const emailKey = value => clean(value).toLowerCase();

export function validateSource(users) {
  if (!Array.isArray(users) || !users.length) throw new Error('Empty directory; refusing cleanup.');
  const ids = new Set();
  for (const user of users) {
    if (!user.id || ids.has(user.id)) throw new Error('Missing or duplicate directory ID.');
    ids.add(user.id);
    for (const field of ['assignedLicenses', 'mail', 'displayName', 'department', 'officeLocation', 'userType']) {
      if (!Object.hasOwn(user, field)) throw new Error(`Directory response omitted ${field}; refusing cleanup.`);
    }
    if (!Array.isArray(user.assignedLicenses)) throw new Error('Invalid licence response; refusing cleanup.');
  }
}

export function eligibility(user, config) {
  const reasons = [];
  if (user.userType !== 'Member') reasons.push('not an internal member');
  if (!user.assignedLicenses.length) reasons.push('unlicensed');
  for (const field of ['displayName', 'mail', 'department', 'officeLocation']) {
    if (!clean(user[field]) || /^(n\/a|none|unknown|not set|-)$/i.test(clean(user[field]))) reasons.push(`missing ${field}`);
  }
  const email = emailKey(user.mail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reasons.push('invalid email');
  if (!config.allowedDomains.includes(email.split('@')[1])) reasons.push('outside staff email domains');
  if (config.excludedEmails.map(emailKey).includes(email)) reasons.push('excluded service/group address');
  return reasons;
}

export function resolveColumns(columns, target) {
  const resolved = {};
  for (const [source, label] of Object.entries(target.fields)) {
    const matches = columns.filter(c => c.name === label || clean(c.displayName).toLowerCase() === label.trim().toLowerCase());
    if (matches.length !== 1 || matches[0].readOnly) throw new Error(`Missing, ambiguous or read-only column: ${target.name}/${label}`);
    resolved[source] = matches[0].name;
  }
  return resolved;
}

export function planList(users, items, target, columns, config) {
  validateSource(users);
  const mapping = resolveColumns(columns, target);
  const identity = mapping.id;
  const mailColumn = mapping.mail;
  if (!identity || !mailColumn) throw new Error('ID and email mappings are required.');
  const eligible = users.filter(u => !eligibility(u, config).length);
  const byId = new Map(users.map(u => [u.id, u]));
  const byEmail = new Map();
  for (const user of users) {
    for (const address of [user.mail, user.userPrincipalName]) {
      const key = emailKey(address);
      if (!key) continue;
      if (byEmail.has(key) && byEmail.get(key).id !== user.id) throw new Error(`Ambiguous directory email: ${key}`);
      byEmail.set(key, user);
    }
  }
  const actions = [];
  const retained = new Set();
  for (const item of [...items].sort((a, b) => Number(a.id) - Number(b.id))) {
    if (!/^\d+$/.test(String(item.id)) || !item.fields || !item.eTag) throw new Error('List item ID, fields or eTag missing; refusing cleanup.');
    const storedId = clean(item.fields[identity]);
    const user = storedId ? byId.get(storedId) : byEmail.get(emailKey(item.fields[mailColumn]));
    const reasons = user ? eligibility(user, config) : ['no matching Microsoft 365 user'];
    if (user && !reasons.length && retained.has(user.id)) reasons.push('duplicate staff entry');
    if (reasons.length) {
      actions.push({type: 'remove', itemId: item.id, eTag: item.eTag, email: emailKey(item.fields[mailColumn]), reasons});
      continue;
    }
    retained.add(user.id);
    const fields = Object.fromEntries(Object.entries(mapping).map(([source, column]) => [column, source === 'mail' ? emailKey(user[source]) : clean(user[source])]));
    const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => clean(item.fields[key]) !== value));
    if (Object.keys(changes).length) actions.push({type: 'update', itemId: item.id, eTag: item.eTag, email: user.mail, fields: changes});
  }
  for (const user of eligible) {
    if (!retained.has(user.id)) actions.push({type: 'create', email: user.mail, fields: Object.fromEntries(Object.entries(mapping).map(([source, column]) => [column, source === 'mail' ? emailKey(user[source]) : clean(user[source])]))});
  }
  return {name: target.name, eligibleCount: eligible.length, existingCount: items.length, actions};
}

export function assertRemovalLimit(plans, percentage) {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('Removal limit must be 0–100.');
  for (const plan of plans) {
    const removals = plan.actions.filter(a => a.type === 'remove').length;
    if (plan.existingCount && removals / plan.existingCount * 100 > percentage) throw new Error(`${plan.name}: removals exceed ${percentage}%; review the report first.`);
  }
}
