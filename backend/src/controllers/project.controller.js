import { logger } from '../utils/logger.js';
import { projectService, ProjectError } from '../services/project.service.js';
import { isRealCalendarDate } from './transaction.controller.js';

const MAX_ENTRIES = 200;
const PAGE_LIMITS = [50, 100];
const BATCH_ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

const handle = (work) => async (req, res) => {
  try {
    await work(req, res);
  } catch (err) {
    if (err instanceof ProjectError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Project request failed.' });
  }
};

const requiredText = (value, label, max) => {
  const text = String(value ?? '').trim();
  if (!text) throw new ProjectError(400, `${label} is required.`);
  if (text.length > max) throw new ProjectError(400, `${label} is too long.`);
  return text;
};

const optionalText = (value, label, max) => {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new ProjectError(400, `${label} is too long.`);
  return text || null;
};

const optionalDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (!isRealCalendarDate(String(value))) throw new ProjectError(400, 'Please provide a valid date.');
  return String(value);
};

const cleanAmount = (value) => Math.round(Number(value) * 100) / 100;

const parseProject = (body) => {
  let budget = null;
  if (body.budget !== undefined && body.budget !== null && body.budget !== '') {
    budget = cleanAmount(body.budget);
    if (Number.isNaN(budget) || budget < 0) throw new ProjectError(400, 'Budget must be zero or more.');
  }
  return {
    name: requiredText(body.name, 'Project name', 128),
    clientName: optionalText(body.clientName, 'Client name', 128),
    location: optionalText(body.location, 'Location', 255),
    startDate: optionalDate(body.startDate),
    budget,
  };
};

const parseEntry = (entry, label = 'Entry') => {
  const type = entry?.type;
  if (type !== 'FUND' && type !== 'EXPENSE') throw new ProjectError(400, `${label}: type must be FUND or EXPENSE.`);
  const amount = cleanAmount(entry.amount);
  if (Number.isNaN(amount) || amount <= 0) throw new ProjectError(400, `${label}: amount must be a positive number.`);
  if (!isRealCalendarDate(String(entry.date ?? ''))) throw new ProjectError(400, `${label}: please provide a valid date.`);
  if (type === 'EXPENSE' && !entry.headId) throw new ProjectError(400, `${label}: please select a head.`);
  return {
    type,
    amount,
    date: String(entry.date),
    personId: entry.personId || null,
    headId: type === 'EXPENSE' ? entry.headId : null,
    description: optionalText(entry.description, `${label}: description`, 1000),
  };
};

export const listProjects = handle(async (req, res) => {
  res.json({ success: true, projects: await projectService.listProjects(req.user.id) });
});

export const createProject = handle(async (req, res) => {
  const project = await projectService.createProject(req.user.id, parseProject(req.body));
  res.status(201).json({ success: true, project });
});

export const getProject = handle(async (req, res) => {
  res.json({ success: true, project: await projectService.getProject(req.user.id, req.params.id) });
});

export const updateProject = handle(async (req, res) => {
  const status = req.body.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE';
  const project = await projectService.updateProject(req.user.id, req.params.id, { ...parseProject(req.body), status });
  res.json({ success: true, project });
});

export const deleteProject = handle(async (req, res) => {
  await projectService.deleteProject(req.user.id, req.params.id);
  res.json({ success: true });
});

export const addPerson = handle(async (req, res) => {
  const person = await projectService.addPerson(req.user.id, req.params.id, {
    name: requiredText(req.body.name, 'Name', 128),
    phone: optionalText(req.body.phone, 'Phone', 32),
  });
  res.status(201).json({ success: true, person });
});

export const deletePerson = handle(async (req, res) => {
  await projectService.deletePerson(req.user.id, req.params.id, req.params.personId);
  res.json({ success: true });
});

export const addHead = handle(async (req, res) => {
  const head = await projectService.addHead(req.user.id, req.params.id, { name: requiredText(req.body.name, 'Head name', 128) });
  res.status(201).json({ success: true, head });
});

export const deleteHead = handle(async (req, res) => {
  await projectService.deleteHead(req.user.id, req.params.id, req.params.headId);
  res.json({ success: true });
});

export const listEntries = handle(async (req, res) => {
  const type = req.query.type === 'FUND' || req.query.type === 'EXPENSE' ? req.query.type : undefined;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = PAGE_LIMITS.includes(Number(req.query.limit)) ? Number(req.query.limit) : PAGE_LIMITS[0];
  const result = await projectService.listEntries(req.user.id, req.params.id, { type, page, limit, all: req.query.all === 'true' });
  res.json({ success: true, ...result });
});

export const createEntries = handle(async (req, res) => {
  const { entries, batchId } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) throw new ProjectError(400, 'Please add at least one entry.');
  if (entries.length > MAX_ENTRIES) throw new ProjectError(400, `A maximum of ${MAX_ENTRIES} entries can be saved at once.`);
  if (batchId !== undefined && !BATCH_ID_PATTERN.test(String(batchId))) throw new ProjectError(400, 'Invalid batch id.');

  // Everything is validated first, so one bad row cannot leave a partial save.
  const parsed = entries.map((entry, index) => parseEntry(entry, `Entry #${index + 1}`));
  const result = await projectService.createEntries(req.user.id, req.params.id, parsed, batchId);
  res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
});

export const updateEntry = handle(async (req, res) => {
  await projectService.updateEntry(req.user.id, req.params.id, req.params.entryId, parseEntry(req.body));
  res.json({ success: true });
});

export const deleteEntry = handle(async (req, res) => {
  await projectService.deleteEntry(req.user.id, req.params.id, req.params.entryId);
  res.json({ success: true });
});
