import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { createActor, type Note } from "./backend/api/backend";
import "./App.css";

// Markdown Imports
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import remarkBreaks from 'remark-breaks';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

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

const formatTimestamp = (timestamp: bigint | undefined | null) => {
	if (!timestamp) return "";
	const date = new Date(Number(timestamp / 1_000_000n));
	return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const SLASH_COMMANDS = [
	{ name: 'Heading 1', cmd: 'h1', syntax: '# ', offset: 2, icon: 'H1' },
	{ name: 'Heading 2', cmd: 'h2', syntax: '## ', offset: 3, icon: 'H2' },
	{ name: 'Heading 3', cmd: 'h3', syntax: '### ', offset: 4, icon: 'H3' },
	{ name: 'Bold', cmd: 'bold', syntax: '** **', offset: 3, icon: 'B' },
	{ name: 'Italic', cmd: 'italic', syntax: '* *', offset: 2, icon: 'I' },
	{ name: 'Bullet List', cmd: 'ul', syntax: '- ', offset: 2, icon: '•' },
	{ name: 'Numbered List', cmd: 'ol', syntax: '1. ', offset: 3, icon: '1.' },
	{ name: 'Sub Bullet', cmd: 'subul', syntax: '    - ', offset: 6, icon: '↳•' },
	{ name: 'Sub Numbered', cmd: 'subol', syntax: '    1. ', offset: 7, icon: '↳1.' },
	{ name: 'Task List', cmd: 'todo', syntax: '- [ ] ', offset: 6, icon: '☑' },
	{ name: 'Code Block', cmd: 'code', syntax: '```\n\n```', offset: 4, icon: '{ }' },
	{ name: 'Math Block', cmd: 'math', syntax: '$$\n\n$$', offset: 3, icon: '∑' },
	{ name: 'Mermaid', cmd: 'mermaid', syntax: '```mermaid\n\n```', offset: 11, icon: '⫸' },
	{ name: 'Table', cmd: 'table', syntax: '| Column 1 | Column 2 |\n| -------- | -------- |\n| Text     | Text     |', offset: 56, icon: '⊞' },
];

const Mermaid = ({ chart }: { chart: string }) => {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (ref.current) {
			const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
			mermaid.render(id, chart).then(({ svg }) => {
				if (ref.current) ref.current.innerHTML = svg;
			}).catch(e => {
				if (ref.current) ref.current.innerText = "Mermaid Error: " + e.message;
			});
		}
	}, [chart]);
	return <div ref={ref} className="mermaid-chart" />;
};

// Extract plugins and components outside of App to prevent unnecessary re-renders
const remarkPlugins = [remarkGfm, remarkMath, remarkBreaks];
const rehypePlugins = [rehypeKatex];

const MarkdownComponents = {
	code({ inline, className, children, ...props }: any) {
		const match = /language-(\w+)/.exec(className || '');
		if (!inline && match && match[1] === 'mermaid') {
			return <Mermaid chart={String(children).replace(/\n$/, '')} />;
		}
		return !inline && match ? (
			<SyntaxHighlighter
				style={vscDarkPlus as any}
				language={match[1]}
				PreTag="div"
				{...props}
			>
				{String(children).replace(/\n$/, '')}
			</SyntaxHighlighter>
		) : (
			<code className={className} {...props}>
				{children}
			</code>
		);
	}
};

function App() {
	const [notes, setNotes] = useState<Array<[bigint, Note]>>([]);
	const [selectedNoteId, setSelectedNoteId] = useState<bigint | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [tags, setTags] = useState("");
	const [pinned, setPinned] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const [showSlashMenu, setShowSlashMenu] = useState(false);
	const [slashFilter, setSlashFilter] = useState("");

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

	const handleEditNote = (id: bigint, note: Note) => {
		setSelectedNoteId(id);
		setTitle(note.title);
		setContent(note.content);
		setTags(note.tags ? note.tags.join(", ") : "");
		setPinned(note.pinned || false);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleNewNote = () => {
		setSelectedNoteId(null);
		setTitle("");
		setContent("");
		setTags("");
		setPinned(false);
		setShowSlashMenu(false);
	};

	const handleSave = async () => {
		if (!content.trim()) return;
		setIsLoading(true);
		try {
			const tagsArray = tags.split(",").map(t => t.trim()).filter(t => t.length > 0);
			const finalTitle = title.trim() || content.split('\n')[0].substring(0, 20);
			if (selectedNoteId !== null) {
				await backendActor.updateNote(selectedNoteId, finalTitle, content, tagsArray, pinned);
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

	const togglePinned = () => {
		setPinned(prev => !prev);
	};

	const filteredNotes = notes.filter(([_, note]) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return note.title.toLowerCase().includes(q) || 
			   note.content.toLowerCase().includes(q) || 
			   note.tags?.some(t => t.toLowerCase().includes(q));
	});

	const sortedNotes = filteredNotes.sort((a, b) => {
		if (a[1].pinned && !b[1].pinned) return -1;
		if (!a[1].pinned && b[1].pinned) return 1;
		return Number((b[1].updated || 0n) - (a[1].updated || 0n));
	});

	const uniqueTags = useMemo(() => {
		const tagSet = new Set<string>();
		notes.forEach(([_, note]) => {
			if (note.tags) {
				for (const t of note.tags) {
					tagSet.add(t);
				}
			}
		});
		return Array.from(tagSet).sort();
	}, [notes]);

	const handleTagClick = (tag: string) => {
		setSearchQuery(prev => {
			if (prev.includes(tag)) return prev.replace(tag, "").trim();
			return (prev + " " + tag).trim();
		});
	};

	const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setContent(val);
		
		const cursorPos = e.target.selectionStart;
		const textBeforeCursor = val.substring(0, cursorPos);
		const lastWord = textBeforeCursor.split(/[\s\n]/).pop();
		
		if (lastWord?.startsWith('/')) {
			setShowSlashMenu(true);
			setSlashFilter(lastWord.substring(1).toLowerCase());
		} else {
			setShowSlashMenu(false);
		}
	};

	const applySlashCommand = (syntax: string, cursorOffset: number) => {
		const textarea = document.querySelector('.editor-content') as HTMLTextAreaElement;
		if (!textarea) return;
		
		const start = textarea.selectionStart;
		const val = textarea.value;
		const textBeforeCursor = val.substring(0, start);
		const slashIndex = textBeforeCursor.lastIndexOf('/');
		
		if (slashIndex !== -1) {
			const newValue = val.substring(0, slashIndex) + syntax + val.substring(start);
			setContent(newValue);
			setShowSlashMenu(false);
			
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(slashIndex + cursorOffset, slashIndex + cursorOffset);
			}, 0);
		}
	};

	const filteredCommands = SLASH_COMMANDS.filter(cmd => 
		cmd.name.toLowerCase().includes(slashFilter) || cmd.cmd.toLowerCase().includes(slashFilter)
	);

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
					<svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<title>Search</title>
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
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
							<div className="empty-tags">You can create tags by inputting them in the editor.</div>
						) : (
							uniqueTags.map(tag => (
								<button 
									type="button"
									key={tag} 
									className={`sidebar-tag ${searchQuery.includes(tag) ? 'active' : ''}`}
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
				{isLoading && (
					<div className="loading-bar"></div>
				)}
				
				<div className="editor-card relative">
					<textarea
						className="editor-content"
						placeholder="Any thoughts... Type '/' for commands"
						value={content}
						onChange={handleContentChange}
						onKeyDown={(e) => {
							if (showSlashMenu && (e.key === 'Tab' || e.key === 'Enter') && filteredCommands.length > 0) {
								e.preventDefault();
								const firstCmd = filteredCommands[0];
								applySlashCommand(firstCmd.syntax, firstCmd.offset);
								return;
							}

							if (e.key === 'Enter' && !e.shiftKey) {
								const textarea = e.currentTarget;
								const start = textarea.selectionStart;
								const value = textarea.value;
								
								const lastNewLine = value.lastIndexOf('\n', start - 1);
								const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
								const lineText = value.substring(lineStart, start);
								
								// Task list prefix
								const todoMatch = lineText.match(/^(\s*- \[[ xX]\]\s+)/);
								// Bullet list prefix (prevent matching task list)
								const ulMatch = !todoMatch ? lineText.match(/^(\s*[-*+]\s+)/) : null;
								// Ordered list prefix
								const olMatch = lineText.match(/^(\s*)(\d+)\.\s+/);

								let prefix = '';
								if (todoMatch) {
									prefix = todoMatch[1].replace(/\[[xX]\]/, '[ ]');
								} else if (ulMatch) {
									prefix = ulMatch[1];
								} else if (olMatch) {
									const spaces = olMatch[1];
									const num = parseInt(olMatch[2]);
									prefix = `${spaces}${num + 1}. `;
								}

								if (prefix) {
									const contentAfterPrefix = lineText.substring(prefix.length).trim();
									if (contentAfterPrefix === '') {
										// Empty item - clear the prefix and end the list
										e.preventDefault();
										const newValue = value.substring(0, lineStart) + value.substring(start);
										setContent(newValue);
										setTimeout(() => {
											textarea.setSelectionRange(lineStart, lineStart);
										}, 0);
									} else {
										// Continue the list
										e.preventDefault();
										const insertion = '\n' + prefix;
										const newValue = value.substring(0, start) + insertion + value.substring(start);
										setContent(newValue);
										setTimeout(() => {
											const newPos = start + insertion.length;
											textarea.setSelectionRange(newPos, newPos);
										}, 0);
									}
								}
							}
						}}
						rows={4}
					/>
					
					{showSlashMenu && filteredCommands.length > 0 && (
						<div className="slash-menu">
							{filteredCommands.map(cmd => (
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
							className={`action-btn ${pinned ? 'active' : ''}`}
							onClick={togglePinned}
							title={pinned ? "Unpin note" : "Pin note"}
						>
							<svg viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
								<title>Pin</title>
								<path d="M16 11V5.5C16 4.67 15.33 4 14.5 4h-5C8.67 4 8 4.67 8 5.5V11L6 14v2h5.5v5l.5 1 .5-1v-5H18v-2l-2-3z" />
							</svg>
						</button>
						<div className="editor-actions">
							{selectedNoteId !== null && (
								<button type="button" className="cancel-btn" onClick={handleNewNote}>
									Cancel
								</button>
							)}
							<button
								type="button"
								className="save-btn"
								onClick={handleSave}
								disabled={isLoading || !content.trim()}
							>
								{selectedNoteId !== null ? "Update" : "Save"}
							</button>
						</div>
					</div>
				</div>

				<div className="memos-feed">
					{notes.length === 0 && !isLoading ? (
						<div className="empty-state">No memos yet. Share your thoughts!</div>
					) : sortedNotes.length === 0 && !isLoading ? (
						<div className="empty-state">No memos found.</div>
					) : (
						sortedNotes.map(([id, note]) => (
							<div key={id.toString()} className={`memo-card ${note.pinned ? "pinned" : ""}`}>
								<div className="memo-header">
									<div className="memo-time">
										{formatTimestamp(note.created)}
										{note.updated !== note.created && " (edited)"}
									</div>
									<div className="memo-actions">
										{note.pinned && (
											<svg className="pin-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
												<title>Pinned</title>
												<path d="M16 11V5.5C16 4.67 15.33 4 14.5 4h-5C8.67 4 8 4.67 8 5.5V11L6 14v2h5.5v5l.5 1 .5-1v-5H18v-2l-2-3z" />
											</svg>
										)}
										<button type="button" className="icon-btn" onClick={() => handleEditNote(id, note)} title="Edit">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<title>Edit</title>
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
												<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
											</svg>
										</button>
										<button type="button" className="icon-btn delete-btn" onClick={() => handleDelete(id)} title="Delete">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<title>Delete</title>
												<polyline points="3 6 5 6 21 6"></polyline>
												<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
												<line x1="10" y1="11" x2="10" y2="17"></line>
												<line x1="14" y1="11" x2="14" y2="17"></line>
											</svg>
										</button>
									</div>
								</div>
								<div className="memo-content markdown-body">
									<ReactMarkdown
										remarkPlugins={remarkPlugins as any}
										rehypePlugins={rehypePlugins as any}
										components={MarkdownComponents}
									>
										{note.content}
									</ReactMarkdown>
								</div>
								{note.tags && note.tags.length > 0 && (
									<div className="memo-tags">
										{note.tags.map(tag => (
											<span key={tag} className="tag-pill" onClick={() => handleTagClick(tag)} onKeyUp={(e) => {if(e.key === "Enter") handleTagClick(tag);}}># {tag}</span>
										))}
									</div>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</main>
	);
}

export default App;
