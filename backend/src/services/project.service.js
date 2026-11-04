// Project money is a separate ledger: nothing here touches accounts, transactions, or personal reports.
import crypto from 'node:crypto';
import { dbService } from './db.service.js';

const DEFAULT_HEADS = ['Rod', 'Cement', 'Brick', 'Sand', 'Labor', 'Transport', 'Other'];

export class ProjectError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

const pool = () => {
  if (!dbService.isPostgresConnected || !dbService.pool) {
    throw new ProjectError(503, 'Projects need the PostgreSQL database.');
  }
  return dbService.pool;
};

const withTransaction = async (work) => {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const PROJECT_COLUMNS = `p.id, p.name, p.client_name AS "clientName", p.location, p.start_date::text AS "startDate",
  p.budget::float8 AS budget, p.status, p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

const TOTALS_COLUMNS = `
  COALESCE((SELECT SUM(amount) FROM project_entries e WHERE e.project_id = p.id AND e.type = 'FUND'), 0)::float8 AS "totalFunds",
  COALESCE((SELECT SUM(amount) FROM project_entries e WHERE e.project_id = p.id AND e.type = 'EXPENSE'), 0)::float8 AS "totalExpense"`;

const withBalance = (project) => ({
  ...project,
  balance: Math.round((project.totalFunds - project.totalExpense) * 100) / 100,
});

// Every project route goes through this, so one user can never reach another user's project.
const assertOwned = async (db, userId, projectId, lock = false) => {
  const res = await db.query(
    `SELECT id FROM projects WHERE id = $1 AND user_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
    [projectId, userId]
  );
  if (res.rows.length === 0) throw new ProjectError(404, 'Project not found.');
};

// Postgres reports a blocked delete as 23503 or 23001 depending on its version.
const isStillReferenced = (err) => err.code === '23503' || err.code === '23001';

const translateConstraint = (err, conflictMessage) => {
  if (err.code === '23505') return new ProjectError(409, conflictMessage);
  return err;
};

export const projectService = {
  async listProjects(userId) {
    const res = await pool().query(
      `SELECT ${PROJECT_COLUMNS}, ${TOTALS_COLUMNS}
       FROM projects p WHERE p.user_id = $1
       ORDER BY CASE WHEN p.status = 'ACTIVE' THEN 0 ELSE 1 END, p.created_at DESC`,
      [userId]
    );
    return res.rows.map(withBalance);
  },

  async createProject(userId, data) {
    const id = newId('prj');
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO projects (id, user_id, name, client_name, location, start_date, budget)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId, data.name, data.clientName, data.location, data.startDate, data.budget]
      );
      for (const name of DEFAULT_HEADS) {
        await client.query('INSERT INTO project_heads (id, project_id, name) VALUES ($1, $2, $3)', [newId('phd'), id, name]);
      }
    });
    return this.getProject(userId, id);
  },

  async getProject(userId, projectId) {
    const db = pool();
    const res = await db.query(
      `SELECT ${PROJECT_COLUMNS}, ${TOTALS_COLUMNS} FROM projects p WHERE p.id = $1 AND p.user_id = $2`,
      [projectId, userId]
    );
    if (res.rows.length === 0) throw new ProjectError(404, 'Project not found.');

    const [people, heads, byHead, byPerson] = await Promise.all([
      db.query('SELECT id, name, phone FROM project_people WHERE project_id = $1 ORDER BY name', [projectId]),
      db.query('SELECT id, name FROM project_heads WHERE project_id = $1 ORDER BY name', [projectId]),
      db.query(
        `SELECT h.id, h.name, SUM(e.amount)::float8 AS amount, COUNT(*)::int AS count
         FROM project_entries e JOIN project_heads h ON h.id = e.head_id
         WHERE e.project_id = $1 AND e.type = 'EXPENSE'
         GROUP BY h.id, h.name ORDER BY amount DESC`,
        [projectId]
      ),
      db.query(
        `SELECT e.person_id AS id, COALESCE(pp.name, 'Not assigned') AS name,
                COALESCE(SUM(e.amount) FILTER (WHERE e.type = 'EXPENSE'), 0)::float8 AS expense,
                COALESCE(SUM(e.amount) FILTER (WHERE e.type = 'FUND'), 0)::float8 AS funds
         FROM project_entries e LEFT JOIN project_people pp ON pp.id = e.person_id
         WHERE e.project_id = $1
         GROUP BY e.person_id, pp.name ORDER BY expense DESC, funds DESC`,
        [projectId]
      ),
    ]);

    return {
      ...withBalance(res.rows[0]),
      people: people.rows,
      heads: heads.rows,
      byHead: byHead.rows,
      byPerson: byPerson.rows,
    };
  },

  async updateProject(userId, projectId, data) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    await db.query(
      `UPDATE projects SET name = $1, client_name = $2, location = $3, start_date = $4, budget = $5, status = $6, updated_at = NOW()
       WHERE id = $7`,
      [data.name, data.clientName, data.location, data.startDate, data.budget, data.status, projectId]
    );
    return this.getProject(userId, projectId);
  },

  async deleteProject(userId, projectId) {
    const res = await pool().query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (res.rowCount === 0) throw new ProjectError(404, 'Project not found.');
  },

  async addPerson(userId, projectId, { name, phone }) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    const id = newId('ppl');
    try {
      await db.query('INSERT INTO project_people (id, project_id, name, phone) VALUES ($1, $2, $3, $4)', [id, projectId, name, phone]);
    } catch (err) {
      throw translateConstraint(err, 'A person with this name already exists in the project.');
    }
    return { id, name, phone };
  },

  async updatePerson(userId, projectId, personId, { name, phone }) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    try {
      const res = await db.query(
        'UPDATE project_people SET name = $1, phone = $2 WHERE id = $3 AND project_id = $4',
        [name, phone, personId, projectId]
      );
      if (res.rowCount === 0) throw new ProjectError(404, 'Person not found.');
    } catch (err) {
      throw translateConstraint(err, 'A person with this name already exists in the project.');
    }
    return { id: personId, name, phone };
  },

  async deletePerson(userId, projectId, personId) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    try {
      const res = await db.query('DELETE FROM project_people WHERE id = $1 AND project_id = $2', [personId, projectId]);
      if (res.rowCount === 0) throw new ProjectError(404, 'Person not found.');
    } catch (err) {
      if (isStillReferenced(err)) throw new ProjectError(409, 'This person has entries in the project, so they cannot be removed.');
      throw err;
    }
  },

  async addHead(userId, projectId, { name }) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    const id = newId('phd');
    try {
      await db.query('INSERT INTO project_heads (id, project_id, name) VALUES ($1, $2, $3)', [id, projectId, name]);
    } catch (err) {
      throw translateConstraint(err, 'This head already exists in the project.');
    }
    return { id, name };
  },

  async updateHead(userId, projectId, headId, { name }) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    try {
      const res = await db.query('UPDATE project_heads SET name = $1 WHERE id = $2 AND project_id = $3', [name, headId, projectId]);
      if (res.rowCount === 0) throw new ProjectError(404, 'Head not found.');
    } catch (err) {
      throw translateConstraint(err, 'This head already exists in the project.');
    }
    return { id: headId, name };
  },

  async deleteHead(userId, projectId, headId) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    try {
      const res = await db.query('DELETE FROM project_heads WHERE id = $1 AND project_id = $2', [headId, projectId]);
      if (res.rowCount === 0) throw new ProjectError(404, 'Head not found.');
    } catch (err) {
      if (isStillReferenced(err)) throw new ProjectError(409, 'This head has expenses in the project, so it cannot be removed.');
      throw err;
    }
  },

  async listEntries(userId, projectId, { type, page, limit, all }) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    const values = [projectId];
    let filter = '';
    if (type) {
      values.push(type);
      filter = 'AND e.type = $2';
    }
    const select = `SELECT e.id, e.type, e.amount::float8 AS amount, e.date::text AS date, e.description,
        e.person_id AS "personId", pp.name AS "personName", e.head_id AS "headId", h.name AS "headName"
      FROM project_entries e
      LEFT JOIN project_people pp ON pp.id = e.person_id
      LEFT JOIN project_heads h ON h.id = e.head_id
      WHERE e.project_id = $1 ${filter}
      ORDER BY e.date DESC, e.created_at DESC, e.id`;

    if (all) {
      return { items: (await db.query(select, values)).rows, hasNextPage: false };
    }
    // One extra row reveals whether another page exists without a separate count.
    const res = await db.query(`${select} LIMIT ${limit + 1} OFFSET ${(page - 1) * limit}`, values);
    return { items: res.rows.slice(0, limit), hasNextPage: res.rows.length > limit };
  },

  async createEntries(userId, projectId, entries, batchId) {
    return withTransaction(async (client) => {
      await assertOwned(client, userId, projectId, true);

      const ids = entries.map((_, index) => (batchId ? `pe_${batchId}_${index}` : newId('pe')));
      // A repeated batch was already saved by an attempt whose response got lost.
      const existing = await client.query('SELECT id FROM project_entries WHERE id = ANY($1::varchar[]) AND project_id = $2', [ids, projectId]);
      if (existing.rows.length > 0) return { count: existing.rows.length, replayed: true };

      await this.assertReferences(client, projectId, entries);
      for (const [index, entry] of entries.entries()) {
        await client.query(
          `INSERT INTO project_entries (id, project_id, type, amount, date, person_id, head_id, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [ids[index], projectId, entry.type, entry.amount, entry.date, entry.personId, entry.headId, entry.description]
        );
      }
      return { count: entries.length, replayed: false };
    });
  },

  async updateEntry(userId, projectId, entryId, entry) {
    return withTransaction(async (client) => {
      await assertOwned(client, userId, projectId, true);
      await this.assertReferences(client, projectId, [entry]);
      const res = await client.query(
        `UPDATE project_entries SET type = $1, amount = $2, date = $3, person_id = $4, head_id = $5, description = $6
         WHERE id = $7 AND project_id = $8`,
        [entry.type, entry.amount, entry.date, entry.personId, entry.headId, entry.description, entryId, projectId]
      );
      if (res.rowCount === 0) throw new ProjectError(404, 'Entry not found.');
    });
  },

  async deleteEntry(userId, projectId, entryId) {
    const db = pool();
    await assertOwned(db, userId, projectId);
    const res = await db.query('DELETE FROM project_entries WHERE id = $1 AND project_id = $2', [entryId, projectId]);
    if (res.rowCount === 0) throw new ProjectError(404, 'Entry not found.');
  },

  // People and heads must belong to this project, even though the ids come from the client.
  async assertReferences(client, projectId, entries) {
    const personIds = [...new Set(entries.map((e) => e.personId).filter(Boolean))];
    const headIds = [...new Set(entries.map((e) => e.headId).filter(Boolean))];
    if (personIds.length > 0) {
      const res = await client.query('SELECT COUNT(*)::int AS n FROM project_people WHERE project_id = $1 AND id = ANY($2::varchar[])', [projectId, personIds]);
      if (res.rows[0].n !== personIds.length) throw new ProjectError(400, 'A selected person does not belong to this project.');
    }
    if (headIds.length > 0) {
      const res = await client.query('SELECT COUNT(*)::int AS n FROM project_heads WHERE project_id = $1 AND id = ANY($2::varchar[])', [projectId, headIds]);
      if (res.rows[0].n !== headIds.length) throw new ProjectError(400, 'A selected head does not belong to this project.');
    }
  },
};
