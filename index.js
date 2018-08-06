#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const json2csv = require('json2csv').parse;
const TurndownService = require('turndown');
const program = require('commander');

let srcUsersPath;
let srcTasksPath;
let srcFoldersPath;
let outputPath;
let excludeTags = [];
let listNames = [];

program.version(require('./package.json').version, '-v, --version');

program
  .option('-f, --folders <srcFoldersPath>', 'Path to your folders.json file')
  .option('-t, --tasks <srcTasksPath>', 'Path to your tasks.json file')
  .option('-u, --users <srcUsersPath>', 'Path to your users.json file')
  .option('-o, --output <outputPath>', 'Where to save the output file')
  .option('-e, --excludeTags [excludeTags]', "Don't convert these folder names to tags", '')
  .option('-l, --listNames [listNames]', 'Save these folders as lists and try to keep their tasks', '')
  .description("Convert all tasks in a Wrike account to Clickup's csv import format")
  .action((cmd) => {
    const {
      users,
      tasks,
      folders,
      output,
    } = cmd;

    if (!users || !tasks || !folders || !output) {
      program.help();
    }

    srcUsersPath = path.join(process.cwd(), users);
    srcTasksPath = path.join(process.cwd(), tasks);
    srcFoldersPath = path.join(process.cwd(), folders);
    outputPath = path.join(process.cwd(), output);

    excludeTags = cmd.excludeTags.split(',');
    listNames = cmd.listNames.split(',');
  });

program.parse(process.argv);

const srcUsers = JSON.parse(fs.readFileSync(srcUsersPath, 'utf8'));
const srcTasks = JSON.parse(fs.readFileSync(srcTasksPath, 'utf8'));
const srcFolders = JSON.parse(fs.readFileSync(srcFoldersPath, 'utf8'));

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
 * Traverse all subtasks of a task and flatten to a single array
 *
 * @param {*} t
 * @returns
 */
function flattenTask(t) {
  if (!t) return [];
  if (t.successors) {
    t.successor_ids = t.successors.map(s => s.id).join(',') || undefined;
    const subtasks = t.successors.reduce(
      (acc, sub) => {
        sub.parent_id = t.id;
        acc.push(...flattenTask(sub));
        return acc;
      },
      [],
    );
    delete t.successors;
    return [t, ...subtasks];
  }
  return [t];
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
    .omit(['comments', 'googleDocs', 'attachments', 'timelog', 'duration'])
    .assign(
      {
        id: t.id,
        title: t.title,
        description: toMarkdown(t.description),
        customStatus: getStatusName(t),
        shared: t.shared.map(getUserEmailById).filter(exists).join(',') || undefined,
        assigned: t.assigned.map(getUserEmailById).filter(exists).join(',') || undefined,
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
    .assign({
      id: f.id,
      title: f.title,
      description: toMarkdown(f.description),
      shared: f.shared.map(getUserEmailById).filter(exists).join(',') || undefined,
      owners: f.owners.map(getUserEmailById).filter(exists).join(',') || undefined,
      author: getUserEmailById(f.author),
      tasks: f.children.map(getTaskById).filter(exists).reduce((acc, t) => [...acc, ...flattenTask(t)], []),
    })
    .value();
}

// Prepare folders and tasks
const folders = srcFolders.map(transformFolder).filter(exists);

/*
 * Clickup (sadly) does not have a concept of linking the same task to multiple folders
 * Let's define what folders will be our future `lists`.
 * By default all folder names will be tags.
 */
const keepFolders = folders.filter(f => listNames.includes(f.title));
const tagFolders = folders.filter(f => !excludeTags.includes(f.title));

// return a list of comma-separated tags for the task from its parent folder
function getTagNames(t) {
  return tagFolders.filter(f => f.tasks.find(child => child.id === t.id)).map(f => f.title).join(',');
}

// return the main folder title
function getListTitle(t) {
  const match = keepFolders.find(f => f.tasks.find(child => child.id === t.id));
  return match && match.title;
}


const tasks = _
  .chain(srcTasks)

  // create the formatted object
  .map(transformTask)
  .filter(exists)

  // flatten the subtasks
  .reduce((acc, t) => [...acc, ...flattenTask(t)], [])

  // remove duplicates
  .uniqBy('id')

  // add each task's main folder name as list title
  // and all folder names the task is a member of as tags
  // this will get folders, subfolders, projects... except discarded folders
  .map(t => Object.assign(
    t,
    {
      tags: getTagNames(t),
      list: getListTitle(t),
    },
  ))
  .value();


// Let's convert this bad boy to CSV and we should be about done.
const fields = [
  'id',
  'title',
  'description',
  'status',
  'customStatus',
  'tags',
  'list',
  'importance',
  'author',
  'assigned',
  'shared',
  'dateCreated',
  'dateStart',
  'dateDue',
];
const csv = json2csv(tasks, { fields });

// Write the output to file
fs.writeFileSync(outputPath, csv);
