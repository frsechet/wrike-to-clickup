# Easily switch from Wrike to Clickup

If you have a Wrike account and are dissatisfied with their service, and happen to want to switch to (Clickup)[https://www.clickup.com], you are in luck, here is how you can do it with very minimal trouble.

## Disclaimer

This script was written on a sunny Sunday afternoon while performing my own switch, and while it works for me, I don't intend to maintain it past my own current needs. Wrike and Clickup may both change their import/export formatting at any time without asking me first, so I won't do any issues and stuff, just use it, modify it, do whatever you want with it. If it helps you, I'm happy.

## Requirements

1. You need a Wrike and a Clickup account. I believe you even need some sort of premium account for Wrike (but free on Clickup works fine), because the export step might be a premium feature.
2. Obviously you also need some sort of admin privileges on both accounts as well.
3. Export your data from Wrike, using the "Quick account backup" tool in your account settings > configuration. You will receive after a while an email with a download link for a zip that contains 3 files: `users.json`, `folders.json`, `tasks.json`.

## Limitations

1. Given the way Clickup works, all your tasks will be "flattened" (you will lose parent tasks etc.). I'm sorry.
2. You *will* also lose your comments and attached files. Again, I'm sorry.
3. You can not link tasks to multiple lists in Clickup as well, so if you had tasks in several folders, those folder names will be converted to tags, then you can reorder at will.
5. If you want, you can also select which folders you want to convert to lists directly. If a task belongs to more than one of those folders, it will be randomly assigned to only one of those, but you still have the tags.
6. If you want, you can also exclude some tags.
7. Some other data also gets lost, such as: `dateStart`, `dateCreated`, `author`... but it will be in the csv if you want to see it. 

## Usage

Install with:
```
npm i -g wrike2clickup
```

Example usage:
```
wrike2clickup -u users.json -f folders.json -t tasks.json [--excludeTags "list,of,tags,to,exclude"] [--listNames "list,of,folders,to,convert,to,lists"] -o mytasks.csv
```

## License

Do whatever you want as long as it is ok with the license of the dependencies, which I haven't really checked.
