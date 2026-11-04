import { Router } from 'express';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  addPerson,
  updatePerson,
  deletePerson,
  addHead,
  updateHead,
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
projectRouter.put('/:id/people/:personId', updatePerson);
projectRouter.delete('/:id/people/:personId', deletePerson);

projectRouter.post('/:id/heads', addHead);
projectRouter.put('/:id/heads/:headId', updateHead);
projectRouter.delete('/:id/heads/:headId', deleteHead);

projectRouter.get('/:id/entries', listEntries);
projectRouter.post('/:id/entries', createEntries);
projectRouter.put('/:id/entries/:entryId', updateEntry);
projectRouter.delete('/:id/entries/:entryId', deleteEntry);
