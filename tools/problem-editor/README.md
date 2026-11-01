# Problem editor

Double-click `problem-editor.cmd` in the website folder, then open the localhost URL printed in its window. Keep that window open while editing.

Add a title and problem URL, choose a rough difficulty, and optionally add the platform, contest, date, topic tags, editorial URL, and notes. Save to update `problems.json`. The Problem-Setting page groups entries as Easy, Medium, Hard, and Very hard, preserving editor order within each group. Remove entries with the Remove button, then save.

The editor runs only on your computer at `127.0.0.1`. It makes a backup before each save in `.problem-editor-backups/`. Saving updates the local website; use your usual deployment process to publish changes. Node.js 18 or newer is required.
