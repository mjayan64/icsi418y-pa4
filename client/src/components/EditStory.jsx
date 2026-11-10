import { useEffect, useRef, useState } from "react";

const API = "http://localhost:9000";

async function requestJson(path, options = {}) {
  const response = await fetch(API + path, options);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Unexpected server response. Make sure the updated server.js is running.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The request failed");
  return data;
}

function EditStory({ projectId, story, onSaved, onCancel }) {
  // Keep the draft separate from the saved story displayed in the backlog.
  const [form, setForm] = useState({
    title: story.title,
    description: story.description,
    priority: story.priority,
    status: story.status,
    assigned_user_id: story.assigned_user_id ?? "",
  });
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveController = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();

    // Fetch fresh memberships each time an edit form is opened.
    async function loadMembers() {
      try {
        const [memberships, currentUsers] = await Promise.all([
          requestJson(`/projects/${projectId}/members`, { signal: controller.signal }),
          requestJson("/users", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const eligibleIds = new Set(memberships.map((member) => member.user_id));
        setMembers(currentUsers.filter((user) => eligibleIds.has(user._id)));
        setUsers(currentUsers);
        setLoading(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error.message);
          setLoading(false);
        }
      }
    }
    loadMembers();
    return () => {
      active.current = false;
      controller.abort();
      saveController.current?.abort();
    };
  }, [projectId]);

  function changeField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  const invalidAssignee = form.assigned_user_id !== "" &&
    !members.some((member) => member._id === form.assigned_user_id);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description cannot be blank.");
      return;
    }
    if (invalidAssignee) {
      setError("Choose a current project member or Unassigned.");
      return;
    }
    setSaving(true);
    const controller = new AbortController();
    saveController.current = controller;
    try {
      const data = await requestJson(
        `/projects/${projectId}/stories/${story._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...form,
            title: form.title.trim(),
            description: form.description.trim(),
            assigned_user_id: form.assigned_user_id || null,
          }),
        }
      );
      if (active.current && !controller.signal.aborted) {
        onSaved(data.story, data.message, users);
      }
    } catch (error) {
      if (active.current && !controller.signal.aborted) setError(error.message);
    } finally {
      if (active.current && !controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "700px", margin: "16px auto", textAlign: "left" }}>
      <h3>Edit Story</h3>
      {loading && <p>Loading current project members...</p>}
      {loadError && <p role="alert" style={{ color: "crimson" }}>{loadError}</p>}

      {!loading && !loadError && (
        <fieldset disabled={saving}>
          <legend>Story Details</legend>
          <p><label>Title<br />
            <input name="title" value={form.title} onChange={changeField} required />
          </label></p>
          <p><label>Description<br />
            <textarea name="description" value={form.description} onChange={changeField} rows={4} required style={{ width: "100%", boxSizing: "border-box" }} />
          </label></p>
          <p><label>Priority{" "}
            <select name="priority" value={form.priority} onChange={changeField}>
              {["High", "Medium", "Low"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label></p>
          <p><label>Status{" "}
            <select name="status" value={form.status} onChange={changeField}>
              {["To Do", "In Progress", "Done"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label></p>
          <p><label>Assigned Member{" "}
            <select
              name="assigned_user_id"
              value={invalidAssignee ? "__choose__" : form.assigned_user_id}
              onChange={changeField}
            >
              {invalidAssignee && <option value="__choose__" disabled>Choose a current member or Unassigned</option>}
              <option value="">Unassigned</option>
              {members.map((member) => <option key={member._id} value={member._id}>{member.username}</option>)}
            </select>
          </label></p>
          {invalidAssignee && <p role="alert">The previous assignee is no longer an eligible member. Choose a new assignment.</p>}
          <button type="submit" disabled={invalidAssignee}>{saving ? "Saving..." : "Save Changes"}</button>
        </fieldset>
      )}
      <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}

export default EditStory;
