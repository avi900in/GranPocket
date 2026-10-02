import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data/chat.db');
const db = new Database(dbPath);

const stmt = db.prepare(`
  UPDATE role_permissions 
  SET allowed_screens = ?
  WHERE role = ?
`);

const rolesToUpdate = ['ADMIN', 'CAREGIVER', 'MEMBER'];

for (const role of rolesToUpdate) {
  const row = db.prepare('SELECT allowed_screens FROM role_permissions WHERE role = ?').get(role);
  if (row) {
    const screens = JSON.parse(row.allowed_screens);
    if (!screens.includes('feedback')) {
      screens.push('feedback');
      stmt.run(JSON.stringify(screens), role);
      console.log(`Updated ${role} with feedback screen`);
    } else {
      console.log(`${role} already has feedback screen`);
    }
  }
}

console.log('Update complete.');
