import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { useCallback, useEffect, useState } from "react";
import { createActor, type Note } from "./backend/api/backend";
import "./App.css";

interface CanisterEnv {
	readonly "PUBLIC_CANISTER_ID:backend": string;
}

const canisterEnv = getCanisterEnv<CanisterEnv>();
const canisterId = canisterEnv["PUBLIC_CANISTER_ID:backend"];

const backendActor = createActor(canisterId, {
	agentOptions: {
		rootKey: !import.meta.env.DEV ? canisterEnv?.IC_ROOT_KEY : undefined,
		shouldFetchRootKey: import.meta.env.DEV,
	},
});

function App() {
	const [notes, setNotes] = useState<Array<[bigint, Note]>>([]);
	const [selectedNoteId, setSelectedNoteId] = useState<bigint | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const fetchNotes = useCallback(async () => {
		setIsLoading(true);
		try {
			const fetchedNotes = await backendActor.listNotes();
			setNotes(fetchedNotes);
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNotes();
	}, [fetchNotes]);

	const handleSelectNote = (id: bigint, note: Note) => {
		setSelectedNoteId(id);
		setTitle(note.title);
		setContent(note.content);
	};

	const handleNewNote = () => {
		setSelectedNoteId(null);
		setTitle("");
		setContent("");
	};

	const handleSave = async () => {
		if (!title.trim() || !content.trim()) return;
		setIsLoading(true);
		try {
			if (selectedNoteId !== null) {
				await backendActor.updateNote(selectedNoteId, title, content);
			} else {
				await backendActor.createNote(title, content);
			}
			await fetchNotes();
			handleNewNote();
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async (id: bigint) => {
		setIsLoading(true);
		try {
			await backendActor.deleteNote(id);
			if (selectedNoteId === id) {
				handleNewNote();
			}
			await fetchNotes();
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<main className="app-container">
			<div className="glass-panel sidebar">
				<div className="sidebar-header">
					<h2>My Notes</h2>
					<button
						type="button"
						className="icon-btn"
						onClick={handleNewNote}
						onKeyUp={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								handleNewNote();
							}
						}}
						disabled={isLoading}
						aria-label="New Note"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<title>New Note</title>
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
					</button>
				</div>
				<div className="notes-list">
					{isLoading && notes.length === 0 ? (
						<div className="loader">Loading...</div>
					) : notes.length === 0 ? (
						<div className="loader">No notes yet. Create one!</div>
					) : (
						notes.map(([id, note]) => (
							<button
								type="button"
								key={id.toString()}
								className={`note-item ${selectedNoteId === id ? "active" : ""}`}
								onClick={() => handleSelectNote(id, note)}
								onKeyUp={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleSelectNote(id, note);
									}
								}}
								aria-label={`Select note: ${note.title}`}
							>
								<div className="note-item-content">
									<h3>{note.title}</h3>
									<p>
										{note.content.length > 30
											? `${note.content.substring(0, 30)}...`
											: note.content}
									</p>
								</div>
								<button
									type="button"
									className="delete-btn"
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(id);
									}}
									onKeyUp={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleDelete(id);
										}
									}}
									aria-label="Delete Note"
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<title>Delete Note</title>
										<polyline points="3 6 5 6 21 6"></polyline>
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
										<line x1="10" y1="11" x2="10" y2="17"></line>
										<line x1="14" y1="11" x2="14" y2="17"></line>
									</svg>
								</button>
							</button>
						))
					)}
				</div>
			</div>

			<div className="glass-panel editor">
				{isLoading && (
					<div className="editor-overlay">
						<div className="spinner"></div>
					</div>
				)}
				<input
					type="text"
					className="editor-title"
					placeholder="Note Title..."
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
				<textarea
					className="editor-content"
					placeholder="Start typing your note here..."
					value={content}
					onChange={(e) => setContent(e.target.value)}
				/>
				<div className="editor-footer">
					<button
						type="button"
						className="save-btn"
						onClick={handleSave}
						disabled={isLoading || !title.trim() || !content.trim()}
					>
						{selectedNoteId !== null ? "Update Note" : "Save Note"}
					</button>
				</div>
			</div>
		</main>
	);
}

export default App;
