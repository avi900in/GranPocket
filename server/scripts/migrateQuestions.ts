import db from '../db.js';
import { getQuestionTree as getStaticQuestionTree, AILMENTS } from '../../src/engine/triageEngine_old.js';

// Setup DB table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS triage_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ailment_code TEXT NOT NULL,
      is_child BOOLEAN NOT NULL,
      questions_json TEXT NOT NULL,
      UNIQUE(ailment_code, is_child)
    );
  `);
} catch (e) {
  console.error("DB init error", e);
}

const adultPerson = { name: 'Adult', dob: '1990-01-01', medicalProfile: {} } as any;
const infantPerson = { name: 'Infant', dob: new Date().toISOString(), medicalProfile: {} } as any;

let count = 0;
const insertStmt = db.prepare('INSERT OR REPLACE INTO triage_questions (ailment_code, is_child, questions_json) VALUES (?, ?, ?)');

const tx = db.transaction(() => {
  for (const ailment of AILMENTS) {
    const adultQuestions = getStaticQuestionTree(ailment.code, adultPerson);
    const childQuestions = getStaticQuestionTree(ailment.code, infantPerson);

    if (adultQuestions.length > 0) {
      insertStmt.run(ailment.code, 0, JSON.stringify(adultQuestions));
      count++;
    }
    if (childQuestions.length > 0) {
      insertStmt.run(ailment.code, 1, JSON.stringify(childQuestions));
      count++;
    }
  }
});

try {
  tx();
  console.log(`Successfully migrated ${count} static question sets to the SQLite database!`);
} catch (err) {
  console.error("Failed to migrate static questions:", err);
}
