import { Router } from 'express';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  addPerson,
  deletePerson,
  addHead,
  deleteHead,
  listEntries,
  createEntries,
  updateEntry,
  deleteEntry,
} from '../controllers/project.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const projectRouter = Router();

projectRouter.use(authenticateToken, requireUserOnly);

projectRouter.get('/', listProjects);
projectRouter.post('/', createProject);
projectRouter.get('/:id', getProject);
projectRouter.put('/:id', updateProject);
projectRouter.delete('/:id', deleteProject);

projectRouter.post('/:id/people', addPerson);
projectRouter.delete('/:id/people/:personId', deletePerson);

projectRouter.post('/:id/heads', addHead);
projectRouter.delete('/:id/heads/:headId', deleteHead);

projectRouter.get('/:id/entries', listEntries);
projectRouter.post('/:id/entries', createEntries);
projectRouter.put('/:id/entries/:entryId', updateEntry);
projectRouter.delete('/:id/entries/:entryId', deleteEntry);
