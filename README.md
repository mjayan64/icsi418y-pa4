# PA4 User Stories and Project Backlog

This application extends PA3 with user stories and a separate backlog for
each project. It uses React, Express, and MongoDB.

## Features

- Register users and check login credentials.
- Create projects and select a Project Lead.
- View projects and manage project memberships.
- Automatically include the Project Lead as a member.
- Prevent duplicate memberships and removal of the Project Lead.
- Create stories with a title, description, priority, and optional assignee.
- Automatically assign new stories the status To Do.
- View all stories for a selected project, including Done stories.
- Edit story details, status, and assignment.
- Cancel edits without changing saved data.
- Delete stories after confirmation.
- Restrict assignments to current members of the selected project.
- Block member removal while any stories in that project remain assigned
  to that member, including Done stories.
- Preserve changes in MongoDB after refreshing the browser.

## Requirements

- Node.js and npm compatible with the dependencies in package.json.
- A MongoDB Atlas cluster.
- A database user with read and write access.
- Your current IP address included in the Atlas project's IP access list.

## Backend Setup

From the main project folder:

```bash
cd server
npm install
```

Create a file named `.env` inside `server`:

```env
MONGO_URI=your_mongodb_connection_string
```

Replace the placeholder with your MongoDB Atlas connection string.

Start the backend:

```bash
node server.js
```

The server connects to MongoDB before accepting requests and runs at:

```text
http://localhost:9000
```

## Frontend Setup

Open another terminal in the main project folder:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

Keep both terminals running.

If PowerShell blocks npm.ps1, use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run dev
```

To check the frontend production build, run this from `client`:

```bash
npm run build
```

Restart the backend after changing server.js. Vite normally updates the
frontend automatically after saving React files.

## Database

The application uses the existing `pa2` database with these collections:

- `users`
- `Projects`
- `ProjectMemberships`
- `UserStories`

Each user story contains:

| Field | Stored value |
| --- | --- |
| `_id` | MongoDB-generated ObjectId |
| `project_id` | ObjectId referencing a project |
| `title` | Nonblank string |
| `description` | Nonblank user-story description |
| `priority` | High, Medium, or Low |
| `status` | To Do, In Progress, or Done |
| `assigned_user_id` | ObjectId referencing a user, or null |

Stories are stored as separate documents. An existing story's project
cannot change.

## Preparing Test Data

Use the application interface to prepare the following data.
Existing accounts can be used instead of creating duplicate users.

1. Register three users: `mehul`, `alex`, and `sam`.
2. Create these projects:
   - Campus Events App: Active, with mehul as Project Lead.
   - Study Group Finder: Planning, with mehul as Project Lead.
3. Under Project Members:
   - Add alex to Campus Events App.
   - Add sam to Study Group Finder.
   - Keep alex out of Study Group Finder and sam out of Campus Events App.
4. Create the following five stories.

| Project | Title | Priority | Final status | Assignee |
| --- | --- | --- | --- | --- |
| Campus Events App | View event details | High | To Do | alex |
| Campus Events App | Register for an event | Medium | In Progress | mehul |
| Campus Events App | Filter events by category | Low | Done | Unassigned |
| Study Group Finder | Search by course | High | To Do | sam |
| Study Group Finder | Join a study group | Medium | In Progress | Unassigned |

Use these descriptions:

- View event details: As a student, I want to view an event's date,
  location, and description, so that I can decide whether to attend.
- Register for an event: As a student, I want to register for an event,
  so that I can reserve my place.
- Filter events by category: As a student, I want to filter events by
  category, so that I can find activities that interest me.
- Search by course: As a student, I want to search for study groups by
  course, so that I can find classmates studying the same material.
- Join a study group: As a student, I want to join a study group,
  so that I can collaborate with classmates.

All new stories start as To Do. Use View Backlog and Edit to set the
other statuses shown in the table.

## Using the Application

- Create Story: select a project, enter the story fields, and choose
  a current project member or Unassigned.
- View Backlog: select a project to see its saved stories.
- Edit: change the story fields and save, or cancel to discard the draft.
- Delete: confirm deletion or cancel to keep the story.
- Project Members: manage memberships and view explanations when
  removal is blocked.

## Validation and API Behavior

The backend validates required text, allowed priorities and statuses,
identifier formats, referenced records, and project memberships.

The story endpoints are:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/projects/:projectId/stories` | List a project's stories |
| POST | `/projects/:projectId/stories` | Create a story |
| PUT | `/projects/:projectId/stories/:storyId` | Update a story |
| DELETE | `/projects/:projectId/stories/:storyId` | Delete a story |

Creation accepts title, description, priority, and assigned_user_id.
The server sets the project from the URL and the status to To Do.

Updates require all five editable fields: title, description, priority,
status, and assigned_user_id. Send null for Unassigned.

Update and delete queries include both the story ID and project ID.
Saving unchanged values succeeds.

Member removal checks assignments only within the selected project.
Done stories still block removal, but assignments in other projects do not.

## Manual Testing

- Verify signup, login, project creation, and membership management.
- Verify duplicate memberships and Project Lead removal are rejected.
- Create assigned and unassigned stories.
- Verify new stories have status To Do.
- Switch projects and confirm each backlog contains only its own stories.
- Verify the assignment dropdown contains only current project members.
- Edit every editable field and verify changes survive a refresh.
- Cancel an edit and verify the saved story remains unchanged.
- Change Done back to To Do.
- Save unchanged values and confirm success.
- Cancel deletion, then confirm deletion and verify persistence.
- Try saving a title containing only spaces.
- Verify assigned stories block member removal, including Done stories.
- Reassign, unassign, or delete the member's stories and retry removal.
- Verify assignments in another project do not block removal here.
- Check the UserStories documents and ObjectId references in Atlas.

## Files Excluded from Git

Do not commit `.env`, `node_modules`, or generated build output.
Install dependencies separately in client and server after cloning.