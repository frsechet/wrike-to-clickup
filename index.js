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

const users = srcUsers.filter(u => u.firstName !== 'Wrike');
const getUserEmailById = (uid) => {
  const user = users.find(u => u.uid === uid);
  return user && user.email;
};

const getCustomStatus = (t) => {
  if (t.customStatus) return t.customStatus.title;
  if (t.status === 0) return 'New';
  if (t.status === 1) return 'Finished';
  if (t.status === 2) return 'Waiting';
  if (t.status === 3) return 'Canceled';
};

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
        customStatus: getCustomStatus(t),
        shared: t.shared.map(uid => getUserEmailById(uid)).filter(exists),
        assigned: t.assigned.map(uid => getUserEmailById(uid)).filter(exists),
        successors: t.successors && t.successors.map(getTaskById).filter(exists),
        author: getUserEmailById(t.author),
      },
    )
    .value();
}

function getTaskById(id) {
  const task = srcTasks.find(f => f.id === id);
  return transformTask(task);
}

function transformFolder(f) {
  if (!f) return;
  return _(f)
    .omit(['comments', 'attachments', 'googleDocs', 'isProject', 'dateCreated', 'projectCreatedDate'])
    .assign(
      {
        id: f.id,
        title: f.title,
        description: toMarkdown(f.description),
        shared: f.shared.map(uid => getUserEmailById(uid)).filter(exists),
        owners: f.owners.map(uid => getUserEmailById(uid)).filter(exists),
        author: getUserEmailById(f.author),
        children: f.children.map(getTaskById).filter(c => c),
        successors: f.successors && f.successors.map(getTaskById),
      },
    )
    .value();
}

const folders = srcFolders.map(transformFolder).filter(exists);
const tasks = srcTasks.map(transformTask).filter(exists);


fs.writeFileSync(path.join(__dirname, 'dist', 'tasks.json'), JSON.stringify(tasks));
fs.writeFileSync(path.join(__dirname, 'dist', 'folders.json'), JSON.stringify(folders));
fs.writeFileSync(path.join(__dirname, 'dist', 'users.json'), JSON.stringify(users));
