require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const client = new MongoClient(process.env.MONGO_URI);

// PA4: stories use the existing database.
const storiesCollection = client.db("pa2").collection("UserStories");
const priorities = ["High", "Medium", "Low"];
const storyStatuses = ["To Do", "In Progress", "Done"];

function isValidId(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function isNonblankText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Create a registered user.
app.post("/signup", async (req, res) => {
  const { f_name, l_name, username, password } = req.body || {};

  if (
    ![f_name, l_name, username, password].every(
      (value) => typeof value === "string" && value.trim()
    )
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const users = client.db("pa2").collection("users");
    const cleanUsername = username.trim();

    const existingUser = await users.findOne({
      username: cleanUsername,
    });

    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await users.insertOne({
      f_name: f_name.trim(),
      l_name: l_name.trim(),
      username: cleanUsername,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }

    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Check login credentials.
app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== "string" ||
    !username.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  try {
    const users = client.db("pa2").collection("users");
    const user = await users.findOne({
      username: username.trim(),
    });

    if (!user) {
      return res.status(401).json({
        message: "Username does not exist",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get users without exposing passwords.
app.get("/users", async (req, res) => {
  try {
    const users = await client
      .db("pa2")
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();

    return res.status(200).json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Could not retrieve users",
    });
  }
});

// Create a project and automatically include its lead as a member.
app.post("/projects", async (req, res) => {
  const { name, description, status, project_lead_id } = req.body || {};

  if (
    ![name, description, status, project_lead_id].every(
      (value) => typeof value === "string" && value.trim()
    )
  ) {
    return res.status(400).json({
      message: "All project fields are required",
    });
  }

  if (!["Planning", "Active", "Completed"].includes(status)) {
    return res.status(400).json({
      message: "Invalid project status",
    });
  }

  if (!ObjectId.isValid(project_lead_id)) {
    return res.status(400).json({
      message: "Invalid project lead ID",
    });
  }

  const session = client.startSession();

  try {
    const db = client.db("pa2");
    const users = db.collection("users");
    const projects = db.collection("Projects");
    const memberships = db.collection("ProjectMemberships");
    const leadId = new ObjectId(project_lead_id);

    const lead = await users.findOne({ _id: leadId });

    if (!lead) {
      return res.status(404).json({
        message: "Project lead does not exist",
      });
    }

    const project = {
      _id: new ObjectId(),
      name: name.trim(),
      description: description.trim(),
      status,
      project_lead_id: leadId,
    };

    // Save both records together or roll back both on failure.
    await session.withTransaction(async () => {
      await projects.insertOne(project, { session });

      await memberships.insertOne(
        {
          project_id: project._id,
          user_id: leadId,
        },
        { session }
      );
    });

    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Could not create project",
    });
  } finally {
    await session.endSession();
  }
});

// Retrieve all saved projects.
app.get("/projects", async (req, res) => {
  try {
    const projects = await client
      .db("pa2")
      .collection("Projects")
      .find({})
      .toArray();

    return res.status(200).json(projects);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Could not retrieve projects",
    });
  }
});

// Retrieve membership records for an existing project.
app.get("/projects/:projectId/members", async (req, res) => {
  const { projectId } = req.params;

  if (!ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const db = client.db("pa2");
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project does not exist" });
    }

    const memberships = await db
      .collection("ProjectMemberships")
      .find({ project_id: projectObjectId })
      .toArray();

    return res.status(200).json(memberships);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Could not retrieve project members",
    });
  }
});

// Add a registered user to an existing project.
app.post("/projects/:projectId/members", async (req, res) => {
  const { projectId } = req.params;
  const { user_id } = req.body || {};

  if (
    !ObjectId.isValid(projectId) ||
    typeof user_id !== "string" ||
    !ObjectId.isValid(user_id)
  ) {
    return res.status(400).json({
      message: "Valid project and user IDs are required",
    });
  }

  try {
    const db = client.db("pa2");
    const projectObjectId = new ObjectId(projectId);
    const userObjectId = new ObjectId(user_id);

    const project = await db.collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project does not exist" });
    }

    const user = await db.collection("users").findOne({
      _id: userObjectId,
    });

    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const memberships = db.collection("ProjectMemberships");
    const membership = {
      project_id: projectObjectId,
      user_id: userObjectId,
    };

    const existingMembership = await memberships.findOne(membership);

    if (existingMembership) {
      return res.status(409).json({
        message: "User is already a member of this project",
      });
    }

    const result = await memberships.insertOne(membership);

    return res.status(201).json({
      message: "Member added successfully",
      membership: {
        ...membership,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    // The unique index also protects against simultaneous duplicate requests.
    if (error.code === 11000) {
      return res.status(409).json({
        message: "User is already a member of this project",
      });
    }

    console.error(error);
    return res.status(500).json({ message: "Could not add member" });
  }
});

// Remove a non-lead member only when they have no assigned stories here.
app.delete("/projects/:projectId/members/:userId", async (req, res) => {
  const { projectId, userId } = req.params;

  if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)) {
    return res.status(400).json({
      message: "Valid project and user IDs are required",
    });
  }

  try {
    const db = client.db("pa2");
    const projectObjectId = new ObjectId(projectId);
    const userObjectId = new ObjectId(userId);

    const project = await db.collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project does not exist" });
    }

    if (project.project_lead_id.equals(userObjectId)) {
      return res.status(400).json({
        message: "The project lead cannot be removed",
      });
    }

    const user = await db.collection("users").findOne({
      _id: userObjectId,
    });

    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const membership = await db.collection("ProjectMemberships").findOne({
      project_id: projectObjectId,
      user_id: userObjectId,
    });

    if (!membership) {
      return res.status(404).json({
        message: "User is not a member of this project",
      });
    }

    // All assigned stories count, including Done. Other projects do not.
    const assignedStory = await storiesCollection.findOne({
      project_id: projectObjectId,
      assigned_user_id: userObjectId,
    });

    if (assignedStory) {
      return res.status(409).json({
        message:
          "Reassign, unassign, or delete this member's stories before removing them from the project.",
      });
    }

    const result = await db.collection("ProjectMemberships").deleteOne({
      project_id: projectObjectId,
      user_id: userObjectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "User is not a member of this project",
      });
    }

    return res.status(200).json({
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Could not remove member" });
  }
});

// List every story in the selected project, including Done stories.
app.get("/projects/:projectId/stories", async (req, res) => {
  const { projectId } = req.params;

  if (!isValidId(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const projectObjectId = new ObjectId(projectId);

    const project = await client.db("pa2").collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project does not exist" });
    }

    const stories = await storiesCollection
      .find({ project_id: projectObjectId })
      .toArray();

    return res.status(200).json(stories);
  } catch (error) {
    console.error("Could not retrieve user stories:", error.name);
    return res.status(500).json({
      message: "Could not retrieve user stories",
    });
  }
});

// Create a story belonging to the project identified in the URL.
app.post("/projects/:projectId/stories", async (req, res) => {
  const { projectId } = req.params;

  if (!isValidId(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }

  try {
    const db = client.db("pa2");
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project does not exist" });
    }

    const { title, description, priority, assigned_user_id } = req.body || {};

    if (!isNonblankText(title) || !isNonblankText(description)) {
      return res.status(400).json({
        message: "Title and description are required and cannot be blank",
      });
    }

    if (!priorities.includes(priority)) {
      return res.status(400).json({
        message: "Priority must be High, Medium, or Low",
      });
    }

    // The client must send null for Unassigned, otherwise a valid user ID.
    let assignedUserId = null;

    if (assigned_user_id !== null) {
      if (!isValidId(assigned_user_id)) {
        return res.status(400).json({
          message: "Assigned member must be a valid user ID or null",
        });
      }

      assignedUserId = new ObjectId(assigned_user_id);

      const user = await db.collection("users").findOne({
        _id: assignedUserId,
      });

      if (!user) {
        return res.status(404).json({
          message: "Assigned user does not exist",
        });
      }

      const membership = await db.collection("ProjectMemberships").findOne({
        project_id: projectObjectId,
        user_id: assignedUserId,
      });

      if (!membership) {
        return res.status(400).json({
          message: "Assigned user must be a member of this project",
        });
      }
    }

    // Explicit fields prevent requests from overriding the project or status.
    const story = {
      project_id: projectObjectId,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: "To Do",
      assigned_user_id: assignedUserId,
    };

    const result = await storiesCollection.insertOne(story);

    return res.status(201).json({
      message: "User story created successfully",
      story: { ...story, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Could not create user story:", error.name);
    return res.status(500).json({
      message: "Could not create user story",
    });
  }
});

// Edit only a story belonging to the project in the URL.
app.put("/projects/:projectId/stories/:storyId", async (req, res) => {
  const { projectId, storyId } = req.params;

  if (!isValidId(projectId) || !isValidId(storyId)) {
    return res.status(400).json({
      message: "Valid project and story IDs are required",
    });
  }

  try {
    const db = client.db("pa2");
    const projectObjectId = new ObjectId(projectId);

    const storyQuery = {
      _id: new ObjectId(storyId),
      project_id: projectObjectId,
    };

    const project = await db.collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        message: "Project does not exist",
      });
    }

    const existingStory = await storiesCollection.findOne(storyQuery);

    if (!existingStory) {
      return res.status(404).json({
        message: "Story does not exist in this project",
      });
    }

    const { title, description, priority, status, assigned_user_id } =
      req.body || {};

    if (!isNonblankText(title) || !isNonblankText(description)) {
      return res.status(400).json({
        message: "Title and description cannot be blank",
      });
    }

    if (!priorities.includes(priority)) {
      return res.status(400).json({
        message: "Priority must be High, Medium, or Low",
      });
    }

    if (!storyStatuses.includes(status)) {
      return res.status(400).json({
        message: "Status must be To Do, In Progress, or Done",
      });
    }

    let assignedUserId = null;

    if (assigned_user_id !== null) {
      if (!isValidId(assigned_user_id)) {
        return res.status(400).json({
          message: "Assigned member must be a valid user ID or null",
        });
      }

      assignedUserId = new ObjectId(assigned_user_id);

      const user = await db.collection("users").findOne({
        _id: assignedUserId,
      });

      if (!user) {
        return res.status(404).json({
          message: "Assigned user does not exist",
        });
      }

      const membership = await db.collection("ProjectMemberships").findOne({
        project_id: projectObjectId,
        user_id: assignedUserId,
      });

      if (!membership) {
        return res.status(400).json({
          message: "Assigned user must be a member of this project",
        });
      }
    }

    // Never include _id or project_id in the editable fields.
    const updates = {
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assigned_user_id: assignedUserId,
    };

    const result = await storiesCollection.updateOne(
      storyQuery,
      { $set: updates }
    );

    // Saving unchanged values is still successful.
    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Story does not exist in this project",
      });
    }

    return res.status(200).json({
      message: "Story updated successfully",
      story: { ...existingStory, ...updates },
    });
  } catch (error) {
    console.error("Could not update user story:", error.name);
    return res.status(500).json({
      message: "Could not update user story",
    });
  }
});

// Delete only a story belonging to the project in the URL.
app.delete("/projects/:projectId/stories/:storyId", async (req, res) => {
  const { projectId, storyId } = req.params;

  if (!isValidId(projectId) || !isValidId(storyId)) {
    return res.status(400).json({
      message: "Valid project and story IDs are required",
    });
  }

  try {
    const projectObjectId = new ObjectId(projectId);

    const project = await client.db("pa2").collection("Projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        message: "Project does not exist",
      });
    }

    const result = await storiesCollection.deleteOne({
      _id: new ObjectId(storyId),
      project_id: projectObjectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Story does not exist in this project",
      });
    }

    return res.status(200).json({
      message: "Story deleted successfully",
    });
  } catch (error) {
    console.error("Could not delete user story:", error.name);
    return res.status(500).json({
      message: "Could not delete user story",
    });
  }
});

// Connect to MongoDB before accepting requests.
async function startServer() {
  try {
    await client.connect();

    const db = client.db("pa2");

    await db.collection("users").createIndex(
      { username: 1 },
      { unique: true }
    );

    // Prevent duplicate membership pairs.
    await db.collection("ProjectMemberships").createIndex(
      { project_id: 1, user_id: 1 },
      { unique: true }
    );

    // Ensure the collection exists before using transactions.
    if (!(await db.listCollections({ name: "Projects" }).hasNext())) {
      await db.createCollection("Projects");
    }

    console.log("Connected to MongoDB");

    app.listen(9000, () => {
      console.log("Server running on port 9000");
    });
  } catch (error) {
    console.error("Could not start server");
    console.error(error);
    await client.close();
    process.exitCode = 1;
  }
}

startServer();