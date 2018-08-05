const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const TurndownService = require('turndown');

const srcUsers = require('./source/users.json');
const srcTasks = require('./source/tasks.json');
const srcFolders = require('./source/folders.json');

const ts = new TurndownService();

const toMarkdown = (str) => str && ts.turndown(str);
const exists = (x) => !!x;

// Remove wrike bot users from the team
const users = srcUsers.filter(u => u.firstName !== 'Wrike');

// Given a user uid, return that user's email
function getUserEmailById(uid) {
  const user = users.find(u => u.uid === uid);
  return user && user.email;
}

/**
 * Return the full name of the task's status
 * Prefer the custom name when it is set, otherwise use the default
 *
 * @param {*} t
 * @returns
 */
function getStatusName(t) {
  if (t.customStatus) return t.customStatus.title;
  if (t.status === 0) return 'New';
  if (t.status === 1) return 'Finished';
  if (t.status === 2) return 'Waiting';
  if (t.status === 3) return 'Canceled';
}

/**
 * Prepare a task in a format that's actually usable by Clickup
 *
 * @param {srcTask} t
 * @returns {task}
 */
function transformTask(t) {
  if (!t) return;
  return _(t)
    .omit(['comments', 'googleDocs', 'attachments', 'timelog', 'duration', ''])
    .assign(
      {
        id: t.id,
        title: t.title,
        descriptionDiff: toMarkdown(t.description) === t.description,
        description: toMarkdown(t.description),
        customStatus: getStatusName(t),
        shared: t.shared.map(getUserEmailById).filter(exists),
        assigned: t.assigned.map(getUserEmailById).filter(exists),
        successors: t.successors && t.successors.map(getTaskById).filter(exists),
        author: getUserEmailById(t.author),
      },
    )
    .value();
}

/**
 * Return a formatted task with its id
 *
 * @param {integer} id
 * @returns {task}
 */
function getTaskById(id) {
  const task = srcTasks.find(f => f.id === id);
  return transformTask(task);
}

/**
 * Prepare a folder in a format that's actually usable by Clickup (similar to a `List`)
 *
 * @param {*} f
 * @returns
 */
function transformFolder(f) {
  if (!f) return;
  return _(f)
    .omit(['comments', 'attachments', 'googleDocs', 'isProject', 'dateCreated', 'projectCreatedDate'])
    .assign(
      {
        id: f.id,
        title: f.title,
        description: toMarkdown(f.description),
        shared: f.shared.map(getUserEmailById).filter(exists),
        owners: f.owners.map(getUserEmailById).filter(exists),
        author: getUserEmailById(f.author),
        children: f.children.map(getTaskById).filter(c => c),
        successors: f.successors && f.successors.map(getTaskById),
      },
    )
    .value();
}

// Prepare folders and tasks
const folders = srcFolders.map(transformFolder).filter(exists);

// Write the output to file
fs.writeFileSync(path.join(__dirname, 'dist', 'lists.json'), JSON.stringify(folders));
