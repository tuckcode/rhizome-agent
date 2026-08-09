# /laputa-next-task

Pick the next Laputa task from Todoist and move it to In Progress.

Priority order: **To Rework** first, then **Open** (sorted by Todoist priority p1→p4).

## Steps

1. Fetch tasks from To Rework (`6g6QqvR9rRpvJWvv`), then Open (`6g3XjWR832hVHhCM`)
2. **Sort by priority — this is mandatory.** Todoist returns tasks in arbitrary order. You must sort them yourself:
   - Todoist priority field: `4` = p1 (urgent), `3` = p2, `2` = p3, `1` = p4
   - Sort descending by `priority` field (4 first, 1 last)
   - To Rework tasks always come before Open tasks regardless of priority
   - **Never pick a p3/p4 task if a p1/p2 task exists in the same section**
3. Take the first task from the sorted list
4. Move it to In Progress (`6g3XjWjfmJFcGgHM`) via Todoist API:

```bash
curl -s -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjWjfmJFcGgHM"}'
```

5. Add a "started" comment to the task:

```bash
curl -s -X POST "https://api.todoist.com/api/v1/comments" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "<task_id>", "content": "🚀 Starting work. [Brief description of approach or what needs to be fixed]"}'
```

6. Fetch the full task details (description, comments) from Todoist:

```bash
curl -s "https://api.todoist.com/api/v1/tasks/<task_id>" \
  -H "Authorization: Bearer $TODOIST_API_KEY"

curl -s "https://api.todoist.com/api/v1/comments?task_id=<task_id>" \
  -H "Authorization: Bearer $TODOIST_API_KEY"
```

6. For To Rework tasks: read the ❌ QA failed comment — it tells you exactly what to fix
7. Output: task ID, title, and full description so you can start working immediately

If no tasks are available in either section → wait 10 minutes and try again (loop forever):

```bash
while true; do
  # ... check tasks ...
  if no_tasks; then
    sleep 600  # 10 minutes
  else
    break  # got a task, proceed
  fi
done
```

Do NOT exit when there are no tasks. Keep looping until a task appears. This keeps Claude Code alive permanently — the watchdog is a safety net only, not the primary dispatcher.
