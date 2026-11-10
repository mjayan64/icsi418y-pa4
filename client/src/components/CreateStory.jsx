import { useEffect, useState } from "react";

const API = "http://localhost:9000";

async function readResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "The request failed");
  }

  return data;
}

function CreateStory() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the projects available for story creation.
  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        const response = await fetch(`${API}/projects`, {
          signal: controller.signal,
        });
        const data = await readResponse(response);

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
    return <p role="alert">{error}</p>;
  }

  return (
    <section>
      <h2>Create User Story</h2>

      <label>
        Project
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={submitting}
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
        <p>Create a project before adding stories.</p>
      ) : !projectId ? (
        <p>Select a project to create a story.</p>
      ) : (
        <StoryForm
          key={projectId}
          projectId={projectId}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
    </section>
  );
}

// A different project key resets the form and its messages.
function StoryForm({ projectId, submitting, setSubmitting }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignedMemberId, setAssignedMemberId] = useState("");

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  // Memberships determine eligibility; users provide readable names.
  useEffect(() => {
    const controller = new AbortController();

    async function loadMembers() {
      try {
        const [memberships, users] = await Promise.all([
          fetch(`${API}/projects/${projectId}/members`, {
            signal: controller.signal,
          }).then(readResponse),
          fetch(`${API}/users`, {
            signal: controller.signal,
          }).then(readResponse),
        ]);

        if (controller.signal.aborted) return;

        const memberIds = new Set(
          memberships.map((membership) => membership.user_id)
        );

        setMembers(users.filter((user) => memberIds.has(user._id)));
        setLoadingMembers(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error.message);
          setLoadingMembers(false);
        }
      }
    }

    loadMembers();
    return () => controller.abort();
  }, [projectId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");
    setIsError(false);

    if (!title.trim() || !description.trim()) {
      setIsError(true);
      setFeedback("Title and description cannot be blank.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API}/projects/${projectId}/stories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            assigned_user_id: assignedMemberId || null,
          }),
        }
      );

      const data = await readResponse(response);

      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssignedMemberId("");
      setFeedback(data.message);
    } catch (error) {
      setIsError(true);
      setFeedback(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMembers) {
    return <p>Loading project members...</p>;
  }

  if (loadError) {
    return <p role="alert">{loadError}</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={submitting}>
        <legend>Story Details</legend>

        <div>
          <label htmlFor="story-title">Title</label>
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="story-description">Description</label>
          <textarea
            id="story-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="As a [type of user], I want [goal], so that [benefit]."
            rows={4}
            required
          />
        </div>

        <div>
          <label htmlFor="story-priority">Priority</label>
          <select
            id="story-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div>
          <label htmlFor="story-assignee">Assigned Member</label>
          <select
            id="story-assignee"
            value={assignedMemberId}
            onChange={(event) =>
              setAssignedMemberId(event.target.value)
            }
          >
            <option value="">Unassigned</option>

            {members.map((member) => (
              <option key={member._id} value={member._id}>
                {member.username}
              </option>
            ))}
          </select>
        </div>

        <p>New stories start with the status To Do.</p>

        <button type="submit">
          {submitting ? "Creating..." : "Create Story"}
        </button>
      </fieldset>

      {feedback && (
        <p
          role={isError ? "alert" : "status"}
          style={{ color: isError ? "crimson" : "green" }}
        >
          {feedback}
        </p>
      )}
    </form>
  );
}

export default CreateStory;