import { useEffect, useRef, useState } from "react";
import EditStory from "./EditStory";

const API = "http://localhost:9000";

async function fetchJson(path, signal, method = "GET") {
  const response = await fetch(API + path, { signal, method });

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "Unexpected server response. Check that the updated server.js is running on port 9000."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "The request failed");
  }

  return data;
}

function ProjectBacklog() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        const data = await fetchJson("/projects", controller.signal);

        if (!controller.signal.aborted) {
          setProjects(data);
          setLoading(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => controller.abort();
  }, []);

  if (loading) {
    return <p>Loading projects...</p>;
  }

  if (error) {
    return (
      <p role="alert" style={{ color: "crimson" }}>
        {error}
      </p>
    );
  }

  return (
    <section>
      <h2>Project Backlog</h2>

      <label>
        Project{" "}
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">Select a project</option>

          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {projects.length === 0 ? (
        <p>Create a project before viewing its backlog.</p>
      ) : !projectId ? (
        <p>Select a project to view its stories.</p>
      ) : (
        // Remounting clears the previous project's data immediately.
        <StoryList key={projectId} projectId={projectId} />
      )}
    </section>
  );
}

function StoryList({ projectId }) {
  const [stories, setStories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingStory, setEditingStory] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const deleteRequest = useRef(null);

  useEffect(() => {
    return () => deleteRequest.current?.abort();
  }, []);

  async function handleDelete(story) {
    if (deletingId || editingStory) return;

    // No request is sent when the user cancels.
    if (
      !window.confirm(
        `Delete "${story.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setFeedback("");
    setDeleteError("");
    setDeletingId(story._id);

    const controller = new AbortController();
    deleteRequest.current = controller;

    try {
      const data = await fetchJson(
        `/projects/${projectId}/stories/${story._id}`,
        controller.signal,
        "DELETE"
      );

      if (controller.signal.aborted) return;

      setStories((current) =>
        current.filter((item) => item._id !== story._id)
      );

      setEditingStory(null);
      setFeedback(data.message);
    } catch (error) {
      if (!controller.signal.aborted) {
        setDeleteError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setDeletingId(null);
      }
    }
  }

  function handleSaved(savedStory, message, currentUsers) {
    // Use the server's saved values, not the draft form values.
    setStories((current) =>
      current.map((story) =>
        story._id === savedStory._id ? savedStory : story
      )
    );

    setUsers(currentUsers);
    setEditingStory(null);
    setFeedback(message);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadStories() {
      try {
        const [storyData, userData] = await Promise.all([
          fetchJson(
            `/projects/${projectId}/stories`,
            controller.signal
          ),
          fetchJson("/users", controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setStories(storyData);
          setUsers(userData);
          setLoading(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      }
    }

    loadStories();

    // Stop older responses from appearing after a project switch.
    return () => controller.abort();
  }, [projectId]);

  if (loading) {
    return <p>Loading stories...</p>;
  }

  if (error) {
    return (
      <p role="alert" style={{ color: "crimson" }}>
        {error}
      </p>
    );
  }

  return (
    <div>
      {feedback && (
        <p role="status" style={{ color: "green" }}>
          {feedback}
        </p>
      )}

      {deleteError && (
        <p role="alert" style={{ color: "crimson" }}>
          {deleteError}
        </p>
      )}

      {stories.length === 0 && (
        <p>This project has no stories yet.</p>
      )}

      {editingStory && (
        <EditStory
          key={editingStory._id}
          projectId={projectId}
          story={editingStory}
          onSaved={handleSaved}
          onCancel={() => setEditingStory(null)}
        />
      )}

      {stories.map((story) => {
        const assignedUser = users.find(
          (user) => user._id === story.assigned_user_id
        );

        const assignedName =
          story.assigned_user_id === null
            ? "Unassigned"
            : assignedUser?.username || "User not found";

        return (
          <article
            key={story._id}
            style={{
              border: "1px solid #ccc",
              padding: "16px",
              margin: "16px auto",
              maxWidth: "700px",
              textAlign: "left",
              overflowWrap: "anywhere",
            }}
          >
            <h3>{story.title}</h3>

            <p style={{ whiteSpace: "pre-wrap" }}>
              {story.description}
            </p>

            <p>
              <strong>Priority:</strong> {story.priority}
            </p>

            <p>
              <strong>Status:</strong> {story.status}
            </p>

            <p>
              <strong>Assigned Member:</strong> {assignedName}
            </p>

            <button
              type="button"
              disabled={Boolean(editingStory) || Boolean(deletingId)}
              onClick={() => {
                setFeedback("");
                setDeleteError("");
                setEditingStory(story);
              }}
            >
              Edit
            </button>

            {" "}

            <button
              type="button"
              disabled={Boolean(editingStory) || Boolean(deletingId)}
              onClick={() => handleDelete(story)}
            >
              {deletingId === story._id ? "Deleting..." : "Delete"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default ProjectBacklog;