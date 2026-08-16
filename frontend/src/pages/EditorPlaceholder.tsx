import { Link, useParams } from 'react-router-dom';

/** Task 18's "navigate to the newly created project's editor" target.
 * The real three-panel editor workspace is built in a later task. */
function EditorPlaceholder() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h2>Editor</h2>
      <p>Project {id} opened. The full editor workspace is not built yet.</p>
      <p>
        <Link to={`/projects/${id}/settings`}>Edit project details</Link>
      </p>
      <p>
        <Link to="/">Back to your projects</Link>
      </p>
    </div>
  );
}

export default EditorPlaceholder;
