import * as vscode from 'vscode';

/**
 * Pomodoro timer configuration settings
 */
export interface PomodoroConfig {
	focusDuration: number;
	breakDuration: number;
	roundsPerSession: number;
	backgroundImage: string;
	enableSounds: boolean;
}

/**
 * Record of a completed pomodoro session
 */
export interface SessionRecord {
 	id: string;
 	date: string;
 	durationSeconds: number;
 	title: string;
 	type: string;
 }

/**
 * A single sticky note in the always-visible notes panel
 */
export interface StickyNote {
	id: string;
	text: string;
	color?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

/**
 * A sticky note that has been deleted and is awaiting permanent removal
 */
export interface TrashedNote extends StickyNote {
	deletedAt: string;
}

const DEFAULT_CONFIG: PomodoroConfig = {
	focusDuration: 25,
	breakDuration: 5,
	roundsPerSession: 2,
	backgroundImage: 'transparent',
	enableSounds: true
};

const HISTORY_KEY = 'pomodoroSessionHistory';
const MAX_HISTORY = 200;
const NOTES_KEY = 'pomodoroStickyNotes';
const TRASH_KEY = 'pomodoroStickyNotesTrash';
const MAX_NOTES = 20;
const MAX_TRASH = 50;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UI_STATE_KEY = 'pomodoroUiState';

export interface PomodoroUiState {
	activeTab: 'timer' | 'notes';
}

/**
 * Manages extension persistence: configuration and session history.
 */
export class Storage {
	private context: vscode.ExtensionContext;
	private noteLayoutQueue: Promise<void> = Promise.resolve();

	// Session metadata (simplified - public access)
	public sessionTitle: string = '';
	public sessionTag: string = 'Work';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Returns current pomodoro configuration with defaults applied
	 */
	getConfig(): PomodoroConfig {
		const config = vscode.workspace.getConfiguration('pomodoro');
		return {
			focusDuration: config.get('focusDuration', DEFAULT_CONFIG.focusDuration),
			breakDuration: config.get('breakDuration', DEFAULT_CONFIG.breakDuration),
			roundsPerSession: config.get('roundsPerSession', DEFAULT_CONFIG.roundsPerSession),
			backgroundImage: config.get('backgroundImage', DEFAULT_CONFIG.backgroundImage),
			enableSounds: config.get('enableSounds', DEFAULT_CONFIG.enableSounds)
		};
	}

	/**
	 * Updates configuration values in VS Code settings
	 */
	async updateConfig(updates: Partial<PomodoroConfig>): Promise<void> {
		const config = vscode.workspace.getConfiguration('pomodoro');
		for (const [key, value] of Object.entries(updates)) {
			await config.update(key, value, vscode.ConfigurationTarget.Global);
		}
	}

	/**
	 * Returns all stored session records
	 */
	getHistory(): SessionRecord[] {
		return this.context.globalState.get<SessionRecord[]>(HISTORY_KEY, []);
	}

	/**
	 * Adds a new session record to history
	 */
	async addSession(record: SessionRecord): Promise<void> {
		const history = this.getHistory();
		history.unshift(record);
		history.length = Math.min(history.length, MAX_HISTORY);
		await this.context.globalState.update(HISTORY_KEY, history);
	}

	/**
	 * Removes a session record by ID
	 */
	async deleteSession(id: string): Promise<void> {
		const history = this.getHistory().filter(s => s.id !== id);
		await this.context.globalState.update(HISTORY_KEY, history);
	}

	/**
	 * Clears all session history
	 */
	async clearHistory(): Promise<void> {
		await this.context.globalState.update(HISTORY_KEY, []);
	}

	/**
	 * Returns all sticky notes, persisted independently of any session
	 */
	getNotes(): StickyNote[] {
		return this.context.globalState.get<StickyNote[]>(NOTES_KEY, []);
	}

	/**
	 * Appends a new blank sticky note, up to MAX_NOTES. Returns the updated list.
	 */
	async addNote(): Promise<StickyNote[]> {
		const notes = this.getNotes();
		if (notes.length >= MAX_NOTES) return notes;
		notes.push({ id: Date.now().toString(), text: '', x: 42, y: 42 });
		await this.context.globalState.update(NOTES_KEY, notes);
		return notes;
	}

	/**
	 * Updates the text of a sticky note by ID
	 */
	async updateNote(id: string, text: string): Promise<void> {
		const notes = this.getNotes();
		const note = notes.find(n => n.id === id);
		if (!note) return;
		note.text = text;
		await this.context.globalState.update(NOTES_KEY, notes);
	}

	/**
	 * Updates the color of a sticky note by ID
	 */
	async updateNoteColor(id: string, color: string): Promise<void> {
		const notes = this.getNotes();
		const note = notes.find(n => n.id === id);
		if (!note) return;
		note.color = color;
		await this.context.globalState.update(NOTES_KEY, notes);
	}

	/** Persists a note's canvas position and optional size. */
	async updateNoteLayout(id: string, x: number, y: number, width?: number, height?: number): Promise<void> {
		// Serialize layout writes so fast drag/pin actions cannot overwrite each other.
		this.noteLayoutQueue = this.noteLayoutQueue.then(async () => {
			const notes = this.getNotes();
			const note = notes.find(n => n.id === id);
			if (!note) return;
			note.x = Math.max(0, Math.min(100, x));
			note.y = Math.max(0, Math.min(100, y));
			if (width !== undefined) note.width = Math.max(160, Math.min(600, width));
			if (height !== undefined) note.height = Math.max(112, Math.min(600, height));
			await this.context.globalState.update(NOTES_KEY, notes);
		});
		await this.noteLayoutQueue;
	}

	getUiState(): PomodoroUiState {
		return this.context.globalState.get<PomodoroUiState>(UI_STATE_KEY, { activeTab: 'timer' });
	}

	async setActiveTab(activeTab: 'timer' | 'notes'): Promise<void> {
		await this.context.globalState.update(UI_STATE_KEY, { activeTab });
	}

	/**
	 * Removes a sticky note by ID. Blank notes are deleted permanently; notes with
	 * content are moved to the trash instead. Returns the updated notes and trash lists.
	 */
	async deleteNote(id: string): Promise<{ notes: StickyNote[]; trash: TrashedNote[] }> {
		const notes = this.getNotes();
		const index = notes.findIndex(n => n.id === id);
		if (index === -1) return { notes, trash: this.getTrash() };

		const [removed] = notes.splice(index, 1);
		await this.context.globalState.update(NOTES_KEY, notes);

		if (!removed.text.trim()) {
			return { notes, trash: this.getTrash() };
		}

		const trash = this.getTrash();
		trash.unshift({ ...removed, deletedAt: new Date().toISOString() });
		trash.length = Math.min(trash.length, MAX_TRASH);
		await this.context.globalState.update(TRASH_KEY, trash);

		return { notes, trash };
	}

	/**
	 * Returns all trashed notes
	 */
	getTrash(): TrashedNote[] {
		return this.context.globalState.get<TrashedNote[]>(TRASH_KEY, []);
	}

	/**
	 * Moves a trashed note back into the active notes list. Returns the updated notes and trash lists.
	 */
	async restoreNote(id: string): Promise<{ notes: StickyNote[]; trash: TrashedNote[] }> {
		const trash = this.getTrash();
		const index = trash.findIndex(n => n.id === id);
		if (index === -1) return { notes: this.getNotes(), trash };

		const [restored] = trash.splice(index, 1);
		await this.context.globalState.update(TRASH_KEY, trash);

		const notes = this.getNotes();
		notes.push({ id: restored.id, text: restored.text, color: restored.color, x: restored.x, y: restored.y, width: restored.width, height: restored.height });
		await this.context.globalState.update(NOTES_KEY, notes);

		return { notes, trash };
	}

	/**
	 * Permanently removes a note from the trash by ID
	 */
	async permanentlyDeleteNote(id: string): Promise<TrashedNote[]> {
		const trash = this.getTrash().filter(n => n.id !== id);
		await this.context.globalState.update(TRASH_KEY, trash);
		return trash;
	}

	/**
	 * Removes trashed notes older than the 30-day retention window. Meant to run on panel open.
	 */
	async purgeExpiredTrash(): Promise<TrashedNote[]> {
		const now = Date.now();
		const trash = this.getTrash().filter(n => now - new Date(n.deletedAt).getTime() < TRASH_RETENTION_MS);
		await this.context.globalState.update(TRASH_KEY, trash);
		return trash;
	}
}
