import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createActor, type Note } from "./backend/api/backend";
import "./App.css";

import type { Components } from "react-markdown";
// Markdown Imports
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import remarkBreaks from "remark-breaks";
import remarkFlexibleMarkers from "remark-flexible-markers";
import type { PluggableList } from "unified";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

interface CanisterEnv {
	readonly "PUBLIC_CANISTER_ID:backend": string;
	readonly IC_ROOT_KEY?: string;
}

const canisterEnv = getCanisterEnv<CanisterEnv>();
const canisterId = canisterEnv["PUBLIC_CANISTER_ID:backend"];

const backendActor = createActor(canisterId, {
	agentOptions: {
		rootKey: !import.meta.env.DEV ? canisterEnv.IC_ROOT_KEY : undefined,
		shouldFetchRootKey: import.meta.env.DEV,
	},
});

const formatTimestamp = (timestamp: bigint | undefined | null) => {
	if (!timestamp) return "";
	const date = new Date(Number(timestamp / 1_000_000n));
	return date.toLocaleString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const SLASH_COMMANDS = [
	{ name: "Heading 1", cmd: "h1", syntax: "# ", offset: 2, icon: "H1" },
	{ name: "Heading 2", cmd: "h2", syntax: "## ", offset: 3, icon: "H2" },
	{ name: "Heading 3", cmd: "h3", syntax: "### ", offset: 4, icon: "H3" },
	{ name: "Bold", cmd: "bold", syntax: "** **", offset: 3, icon: "B" },
	{ name: "Italic", cmd: "italic", syntax: "* *", offset: 2, icon: "I" },
	{ name: "Bullet List", cmd: "ul", syntax: "- ", offset: 2, icon: "•" },
	{ name: "Numbered List", cmd: "ol", syntax: "1. ", offset: 3, icon: "1." },
	{ name: "Sub Bullet", cmd: "subul", syntax: "    - ", offset: 6, icon: "↳•" },
	{
		name: "Sub Numbered",
		cmd: "subol",
		syntax: "    1. ",
		offset: 7,
		icon: "↳1.",
	},
	{ name: "Task List", cmd: "todo", syntax: "- [ ] ", offset: 6, icon: "☑" },
	{ name: "Inline Code", cmd: "ic", syntax: "` `", offset: 1, icon: "i{}" },
	{
		name: "Code Block",
		cmd: "code",
		syntax: "```\n\n```",
		offset: 4,
		icon: "{ }",
	},
	{ name: "Inline Math", cmd: "im", syntax: "$ $", offset: 1, icon: "i∑" },
	{ name: "Math Block", cmd: "math", syntax: "$$\n\n$$", offset: 3, icon: "∑" },
	{
		name: "Mermaid",
		cmd: "mermaid",
		syntax: "```mermaid\n\n```",
		offset: 11,
		icon: "⫸",
	},
	{
		name: "Table",
		cmd: "table",
		syntax:
			"| Column 1 | Column 2 |\n| -------- | -------- |\n| Text     | Text     |",
		offset: 56,
		icon: "⊞",
	},
	{ name: "Highlight", cmd: "mark", syntax: "== ==", offset: 3, icon: "H" },
];

const Mermaid = ({ chart }: { chart: string }) => {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (ref.current) {
			const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
			mermaid
				.render(id, chart)
				.then(({ svg }) => {
					if (ref.current) ref.current.innerHTML = svg;
				})
				.catch((e) => {
					if (ref.current)
						ref.current.innerText = `Mermaid Error: ${e.message}`;
				});
		}
	}, [chart]);
	return <div ref={ref} className="mermaid-chart" />;
};

interface MemoCardProps {
	id: bigint;
	note: Note;
	onEdit: (id: bigint, note: Note) => void;
	onDelete: (id: bigint) => void;
	onTagClick: (tag: string) => void;
	remarkPlugins: PluggableList;
	rehypePlugins: PluggableList;
	MarkdownComponents: Components;
}

const MemoCard = ({
	id,
	note,
	onEdit,
	onDelete,
	onTagClick,
	remarkPlugins,
	rehypePlugins,
	MarkdownComponents,
}: MemoCardProps) => {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div
			className={`memo-card ${note.pinned ? "pinned" : ""} ${isExpanded ? "expanded" : "collapsed"}`}
		>
			<button
				type="button"
				className="memo-header"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="memo-meta">
					<div className="memo-time">
						{formatTimestamp(note.created)}
						{note.updated !== note.created && " (edited)"}
					</div>
					<div className="memo-title-preview">{note.title}</div>
				</div>
				<div className="memo-actions">
					{note.pinned && (
						<svg
							className="pin-icon"
							viewBox="0 0 24 24"
							fill="currentColor"
							stroke="none"
						>
							<title>Pinned</title>
							<path d="M16 11V5.5C16 4.67 15.33 4 14.5 4h-5C8.67 4 8 4.67 8 5.5V11L6 14v2h5.5v5l.5 1 .5-1v-5H18v-2l-2-3z" />
						</svg>
					)}
					<button
						type="button"
						className="icon-btn"
						onClick={(e) => {
							e.stopPropagation();
							onEdit(id, note);
						}}
						title="Edit"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<title>Edit</title>
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
						</svg>
					</button>
					<button
						type="button"
						className="icon-btn delete-btn"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(id);
						}}
						title="Delete"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<title>Delete</title>
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							<line x1="10" y1="11" x2="10" y2="17" />
							<line x1="14" y1="11" x2="14" y2="17" />
						</svg>
					</button>
					<div className={`expand-icon ${isExpanded ? "rotated" : ""}`}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							width="16"
							height="16"
						>
							<title>Expand</title>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</div>
				</div>
			</button>
			{isExpanded && (
				<div className="memo-body">
					<div className="memo-content markdown-body">
						<ReactMarkdown
							remarkPlugins={remarkPlugins}
							rehypePlugins={rehypePlugins}
							components={MarkdownComponents}
						>
							{note.content}
						</ReactMarkdown>
					</div>
					{note.tags && note.tags.length > 0 && (
						<div className="memo-tags">
							{note.tags.map((tag) => (
								<button
									type="button"
									key={tag}
									className="tag-pill"
									onClick={() => onTagClick(tag)}
								>
									# {tag}
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// Extract plugins and components outside of App to prevent unnecessary re-renders
const remarkPlugins: PluggableList = [
	remarkGfm,
	remarkMath,
	remarkBreaks,
	remarkFlexibleMarkers,
];
const rehypePlugins: PluggableList = [rehypeKatex];

const MarkdownComponents: Components = {
	pre({ children }) {
		// Attempt to extract language from the child code element
		const child = React.Children.only(children) as React.ReactElement;
		const childProps =
			(child?.props as { className?: string; children?: React.ReactNode }) ||
			{};
		const className = childProps.className || "";
		const match = /language-(\w+)/.exec(className);
		const language = (match ? match[1] : "code").toUpperCase();
		const rawContent = childProps.children || "";

		return (
			<div className="code-block-container">
				<div className="code-block-header">
					<div className="code-lang">
						<span className="code-icon">{"< >"}</span>
						{language}
					</div>
					<div className="code-actions">
						<button type="button" className="code-action-btn" title="Download">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								width="14"
								height="14"
							>
								<title>Download Code</title>
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
						</button>
						<button
							type="button"
							className="code-action-btn"
							title="Copy"
							onClick={() => navigator.clipboard.writeText(String(rawContent))}
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								width="14"
								height="14"
							>
								<title>Copy Code</title>
								<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
								<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
							</svg>
						</button>
					</div>
				</div>
				{React.Children.map(children, (c) =>
					React.cloneElement(c as React.ReactElement<{ isBlock?: boolean }>, {
						isBlock: true,
					}),
				)}
			</div>
		);
	},
	code({ className, children, ...props }) {
		const isBlock = (props as { isBlock?: boolean }).isBlock;
		const match = /language-(\w+)/.exec(className || "");
		const language = match ? match[1] : "";

		if (isBlock && language === "mermaid") {
			return <Mermaid chart={String(children).replace(/\n$/, "")} />;
		}

		if (isBlock) {
			return (
				<SyntaxHighlighter
					style={vscDarkPlus}
					language={language || "text"}
					PreTag="div"
					customStyle={{
						background: "transparent",
						padding: "16px",
						margin: 0,
					}}
					codeTagProps={{
						style: {
							background: "transparent",
							display: "block",
							width: "100%",
						},
					}}
				>
					{String(children).replace(/\n$/, "")}
				</SyntaxHighlighter>
			);
		}

		return (
			<code className={`inline-code ${className || ""}`} {...props}>
				{children}
			</code>
		);
	},
};

function App() {
	const [notes, setNotes] = useState<Array<[bigint, Note]>>([]);
	const [editingId, setEditingId] = useState<bigint | null>(null);
	const [content, setContent] = useState("");
	const [tags, setTags] = useState("");
	const [pinned, setPinned] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showSlashMenu, setShowSlashMenu] = useState(false);
	const [slashFilter, setSlashFilter] = useState("");
	const editorRef = useRef<HTMLTextAreaElement>(null);

	const adjustEditorHeight = useCallback(() => {
		const textarea = editorRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, []);

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

	useEffect(() => {
		adjustEditorHeight();
	}, [adjustEditorHeight]);

	const handleEditNote = (id: bigint, note: Note) => {
		setEditingId(id);
		setContent(note.content);
		setTags(note.tags ? note.tags.join(", ") : "");
		setPinned(note.pinned || false);
		window.scrollTo({ top: 0, behavior: "smooth" });
		setTimeout(() => {
			editorRef.current?.focus();
			adjustEditorHeight();
		}, 100);
	};

	const handleNewNote = () => {
		setEditingId(null);
		setContent("");
		setTags("");
		setPinned(false);
		setShowSlashMenu(false);
		setTimeout(adjustEditorHeight, 0);
	};

	const handleSave = async () => {
		if (!content.trim()) return;
		setIsLoading(true);
		try {
			const tagsArray = tags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0);
			const finalTitle = content.split("\n")[0].substring(0, 50);
			if (editingId !== null) {
				await backendActor.updateNote(
					editingId,
					finalTitle,
					content,
					tagsArray,
					pinned,
				);
			} else {
				await backendActor.createNote(finalTitle, content, tagsArray, pinned);
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
		if (!window.confirm("Are you sure you want to delete this memo?")) return;
		setIsLoading(true);
		try {
			await backendActor.deleteNote(id);
			if (editingId === id) {
				handleNewNote();
			}
			await fetchNotes();
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	};

	const togglePinned = () => {
		setPinned((prev) => !prev);
	};

	const filteredNotes = notes.filter(([_, note]) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			note.title.toLowerCase().includes(q) ||
			note.content.toLowerCase().includes(q) ||
			note.tags?.some((t) => t.toLowerCase().includes(q))
		);
	});

	const sortedNotes = filteredNotes.sort((a, b) => {
		if (a[1].pinned && !b[1].pinned) return -1;
		if (!a[1].pinned && b[1].pinned) return 1;
		return Number((b[1].updated || 0n) - (a[1].updated || 0n));
	});

	const uniqueTags = useMemo(() => {
		const tagSet = new Set<string>();
		for (const [_, note] of notes) {
			if (note.tags) {
				for (const t of note.tags) {
					tagSet.add(t);
				}
			}
		}
		return Array.from(tagSet).sort();
	}, [notes]);

	const handleTagClick = (tag: string) => {
		setSearchQuery((prev) => {
			if (prev.includes(tag)) return prev.replace(tag, "").trim();
			return `${prev} ${tag}`.trim();
		});
	};

	const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setContent(val);
		adjustEditorHeight();

		const cursorPos = e.target.selectionStart;
		const textBeforeCursor = val.substring(0, cursorPos);
		const lastWord = textBeforeCursor.split(/[\s\n]/).pop();

		if (lastWord?.startsWith("/")) {
			setShowSlashMenu(true);
			setSlashFilter(lastWord.substring(1).toLowerCase());
		} else {
			setShowSlashMenu(false);
		}
	};

	const applySlashCommand = (syntax: string, cursorOffset: number) => {
		const textarea = editorRef.current;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const val = textarea.value;
		const textBeforeCursor = val.substring(0, start);
		const slashIndex = textBeforeCursor.lastIndexOf("/");

		if (slashIndex !== -1) {
			const newValue =
				val.substring(0, slashIndex) + syntax + val.substring(start);
			setContent(newValue);
			setShowSlashMenu(false);

			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(
					slashIndex + cursorOffset,
					slashIndex + cursorOffset,
				);
				adjustEditorHeight();
			}, 0);
		}
	};

	const filteredCommands = SLASH_COMMANDS.filter(
		(cmd) =>
			cmd.name.toLowerCase().includes(slashFilter) ||
			cmd.cmd.toLowerCase().includes(slashFilter),
	).sort((a, b) => {
		const aCmd = a.cmd.toLowerCase();
		const bCmd = b.cmd.toLowerCase();
		const aName = a.name.toLowerCase();
		const bName = b.name.toLowerCase();

		// Priority 1: Exact command match
		if (aCmd === slashFilter && bCmd !== slashFilter) return -1;
		if (bCmd === slashFilter && aCmd !== slashFilter) return 1;

		// Priority 2: Prefix command match
		if (aCmd.startsWith(slashFilter) && !bCmd.startsWith(slashFilter))
			return -1;
		if (bCmd.startsWith(slashFilter) && !aCmd.startsWith(slashFilter)) return 1;

		// Priority 3: Prefix name match
		if (aName.startsWith(slashFilter) && !bName.startsWith(slashFilter))
			return -1;
		if (bName.startsWith(slashFilter) && !aName.startsWith(slashFilter))
			return 1;

		return 0;
	});

	return (
		<main className="memos-container">
			<div className="sidebar">
				<div className="sidebar-header">
					<div className="logo-area">
						<div className="logo-icon">M</div>
						<h2>Memos</h2>
					</div>
				</div>
				<div className="search-bar-container">
					<svg
						className="search-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<title>Search</title>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						className="search-input"
						placeholder="Search memos..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<div className="sidebar-section">
					<h3>Tags</h3>
					<div className="tags-list">
						{uniqueTags.length === 0 ? (
							<div className="empty-tags">
								You can create tags by inputting them in the editor.
							</div>
						) : (
							uniqueTags.map((tag) => (
								<button
									type="button"
									key={tag}
									className={`sidebar-tag ${searchQuery.includes(tag) ? "active" : ""}`}
									onClick={() => handleTagClick(tag)}
								>
									# {tag}
								</button>
							))
						)}
					</div>
				</div>
			</div>

			<div className="main-content">
				{isLoading && <div className="loading-bar" />}

				<div className="editor-card relative">
					<textarea
						ref={editorRef}
						className="editor-content"
						placeholder="Any thoughts... Type '/' for commands"
						value={content}
						onChange={handleContentChange}
						onKeyDown={(e) => {
							if (
								showSlashMenu &&
								(e.key === "Tab" || e.key === "Enter") &&
								filteredCommands.length > 0
							) {
								e.preventDefault();
								const firstCmd = filteredCommands[0];
								applySlashCommand(firstCmd.syntax, firstCmd.offset);
								return;
							}

							if (e.key === "Enter" && !e.shiftKey) {
								const textarea = e.currentTarget;
								const start = textarea.selectionStart;
								const value = textarea.value;

								const lastNewLine = value.lastIndexOf("\n", start - 1);
								const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
								const lineText = value.substring(lineStart, start);

								// Task list prefix
								const todoMatch = lineText.match(/^(\s*- \[[ xX]\]\s+)/);
								// Bullet list prefix (prevent matching task list)
								const ulMatch = !todoMatch
									? lineText.match(/^(\s*[-*+]\s+)/)
									: null;
								// Ordered list prefix
								const olMatch = lineText.match(/^(\s*)(\d+)\.\s+/);

								let prefix = "";
								if (todoMatch) {
									prefix = todoMatch[1].replace(/\[[xX]\]/, "[ ]");
								} else if (ulMatch) {
									prefix = ulMatch[1];
								} else if (olMatch) {
									const spaces = olMatch[1];
									const num = Number.parseInt(olMatch[2], 10);
									prefix = `${spaces}${num + 1}. `;
								}

								if (prefix) {
									const contentAfterPrefix = lineText
										.substring(prefix.length)
										.trim();
									if (contentAfterPrefix === "") {
										// Empty item - clear the prefix and end the list
										e.preventDefault();
										const newValue =
											value.substring(0, lineStart) + value.substring(start);
										setContent(newValue);
										setTimeout(() => {
											textarea.setSelectionRange(lineStart, lineStart);
											adjustEditorHeight();
										}, 0);
									} else {
										// Continue the list
										e.preventDefault();
										const insertion = `\n${prefix}`;
										const newValue =
											value.substring(0, start) +
											insertion +
											value.substring(start);
										setContent(newValue);
										setTimeout(() => {
											const newPos = start + insertion.length;
											textarea.setSelectionRange(newPos, newPos);
											adjustEditorHeight();
										}, 0);
									}
								}
							}
						}}
					/>

					{showSlashMenu && filteredCommands.length > 0 && (
						<div className="slash-menu">
							{filteredCommands.map((cmd) => (
								<button
									type="button"
									key={cmd.cmd}
									className="slash-menu-item"
									onClick={() => applySlashCommand(cmd.syntax, cmd.offset)}
								>
									<span className="slash-icon">{cmd.icon}</span>
									<div className="slash-details">
										<span className="slash-name">{cmd.name}</span>
										<span className="slash-cmd">/{cmd.cmd}</span>
									</div>
								</button>
							))}
						</div>
					)}

					<input
						type="text"
						className="editor-tags"
						placeholder="Add tags (comma separated)..."
						value={tags}
						onChange={(e) => setTags(e.target.value)}
					/>
					<div className="editor-footer">
						<button
							type="button"
							className={`action-btn ${pinned ? "active" : ""}`}
							onClick={togglePinned}
							title={pinned ? "Unpin note" : "Pin note"}
						>
							<svg
								viewBox="0 0 24 24"
								fill={pinned ? "currentColor" : "none"}
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<title>Pin</title>
								<path d="M16 11V5.5C16 4.67 15.33 4 14.5 4h-5C8.67 4 8 4.67 8 5.5V11L6 14v2h5.5v5l.5 1 .5-1v-5H18v-2l-2-3z" />
							</svg>
						</button>
						<div className="editor-actions">
							{editingId !== null && (
								<button
									type="button"
									className="cancel-btn"
									onClick={handleNewNote}
								>
									Cancel
								</button>
							)}
							<button
								type="button"
								className="save-btn"
								onClick={handleSave}
								disabled={isLoading || !content.trim()}
							>
								{editingId !== null ? "Update" : "Save"}
							</button>
						</div>
					</div>
				</div>

				<div className="memos-feed">
					{notes.length === 0 && !isLoading ? (
						<div className="empty-state">
							No memos yet. Share your thoughts!
						</div>
					) : sortedNotes.length === 0 && !isLoading ? (
						<div className="empty-state">No memos found.</div>
					) : (
						sortedNotes.map(([id, note]) => (
							<MemoCard
								key={id.toString()}
								id={id}
								note={note}
								onEdit={handleEditNote}
								onDelete={handleDelete}
								onTagClick={handleTagClick}
								remarkPlugins={remarkPlugins}
								rehypePlugins={rehypePlugins}
								MarkdownComponents={MarkdownComponents}
							/>
						))
					)}
				</div>
			</div>
		</main>
	);
}

export default App;
