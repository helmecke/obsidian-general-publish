import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	Modal,
} from "obsidian";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

interface GeneralPublishSettings {
	gitRepoPath: string;
	publishFolder: string;
	assetsFolder: string;
	commitMessage: string;
	autoCommit: boolean;
}

const DEFAULT_SETTINGS: GeneralPublishSettings = {
	gitRepoPath: "",
	publishFolder: "content",
	assetsFolder: "assets",
	commitMessage: "Update published notes - {timestamp}",
	autoCommit: true,
};

export default class GeneralPublishPlugin extends Plugin {
	settings: GeneralPublishSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon("upload", "Publish Notes", () => {
			this.publishAllNotes();
		});

		// Add commands
		this.addCommand({
			id: "publish-all-notes",
			name: "Publish all marked notes",
			callback: () => {
				this.publishAllNotes();
			},
		});

		this.addCommand({
			id: "publish-current-note",
			name: "Publish current note",
			callback: () => {
				this.publishCurrentNote();
			},
		});

		// Add settings tab
		this.addSettingTab(new GeneralPublishSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async publishAllNotes() {
		if (!this.settings.gitRepoPath) {
			new Notice("Please configure git repository path in settings");
			return;
		}

		try {
			const publishableFiles = await this.getPublishableFiles();
			if (publishableFiles.length === 0) {
				new Notice('No files found with "publish: true" frontmatter');
				return;
			}

			new Notice(`Publishing ${publishableFiles.length} notes...`);

			for (const file of publishableFiles) {
				await this.copyFileToRepo(file);
			}

			let commitResult = false;
			if (this.settings.autoCommit) {
				commitResult = await this.commitChanges();
			}

			if (commitResult || !this.settings.autoCommit) {
				new Notice(`Successfully published ${publishableFiles.length} notes`);
			} else {
				new Notice(
					`Copied ${publishableFiles.length} notes (no changes to commit)`,
				);
			}
		} catch (error) {
			new Notice(`Error publishing notes: ${error.message}`);
			console.error("Publish error:", error);
		}
	}

	async publishCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file");
			return;
		}

		if (!this.settings.gitRepoPath) {
			new Notice("Please configure git repository path in settings");
			return;
		}

		try {
			const shouldPublish = await this.shouldPublishFile(activeFile);
			if (!shouldPublish) {
				const confirmed = await this.confirmAddPublishFlag(activeFile);
				if (confirmed) {
					await this.addPublishFlag(activeFile);
					new Notice('Added "publish: true" to frontmatter');
				} else {
					return;
				}
			}

			await this.copyFileToRepo(activeFile);

			let commitResult = false;
			if (this.settings.autoCommit) {
				commitResult = await this.commitChanges();
			}

			if (commitResult || !this.settings.autoCommit) {
				new Notice("Successfully published current note");
			}
		} catch (error) {
			new Notice(`Error publishing note: ${error.message}`);
			console.error("Publish error:", error);
		}
	}

	async getPublishableFiles(): Promise<TFile[]> {
		const files = this.app.vault.getMarkdownFiles();
		const publishableFiles: TFile[] = [];

		for (const file of files) {
			if (await this.shouldPublishFile(file)) {
				publishableFiles.push(file);
			}
		}

		return publishableFiles;
	}

	async shouldPublishFile(file: TFile): Promise<boolean> {
		const content = await this.app.vault.read(file);
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

		if (!frontmatterMatch) {
			return false;
		}

		const frontmatter = frontmatterMatch[1];
		return (
			frontmatter.includes("publish: true") ||
			frontmatter.includes("publish:true")
		);
	}

	async copyFileToRepo(file: TFile) {
		const content = await this.app.vault.read(file);
		const processedContent = await this.processContent(content, file);

		// Validate git repo path is absolute and exists
		if (!path.isAbsolute(this.settings.gitRepoPath)) {
			throw new Error("Git repository path must be an absolute path");
		}

		const targetDir = path.resolve(
			this.settings.gitRepoPath,
			this.settings.publishFolder,
		);
		const targetPath = path.resolve(targetDir, file.name);

		// Ensure target directory exists
		await fs.promises.mkdir(targetDir, { recursive: true });

		// Write the processed content
		await fs.promises.writeFile(targetPath, processedContent, "utf8");

		// Copy referenced assets
		await this.copyReferencedAssets(content, file);
	}

	async processContent(content: string, file: TFile): Promise<string> {
		// Return content as-is, no link processing
		return content;
	}

	async copyReferencedAssets(content: string, sourceFile: TFile) {
		// Find image references in markdown
		const imageRegex = /!\[\[([^\]]+)\]\]|!\[.*?\]\(([^)]+)\)/g;
		let match;

		while ((match = imageRegex.exec(content)) !== null) {
			const imageName = match[1] || match[2];
			if (!imageName) continue;

			// Try multiple ways to find the image file
			let imageFile: TFile | null = null;

			// First try direct path
			const directFile = this.app.vault.getAbstractFileByPath(imageName);
			if (directFile instanceof TFile) {
				imageFile = directFile;
			} else {
				// Search all files for matching name
				const allFiles = this.app.vault.getFiles();
				imageFile =
					allFiles.find(
						(file) =>
							file.name === imageName ||
							file.name === imageName.split("/").pop() ||
							file.path === imageName,
					) || null;
			}

			if (imageFile) {
				try {
					await this.copyAssetToRepo(imageFile);
				} catch (error) {
					console.error(`Failed to copy asset ${imageName}:`, error);
				}
			} else {
				console.warn(`Asset not found: ${imageName}`);
			}
		}
	}

	async copyAssetToRepo(assetFile: TFile) {
		const arrayBuffer = await this.app.vault.readBinary(assetFile);
		const buffer = Buffer.from(arrayBuffer);

		const targetDir = path.resolve(
			this.settings.gitRepoPath,
			this.settings.assetsFolder,
		);
		const targetPath = path.resolve(targetDir, assetFile.name);

		// Ensure target directory exists
		await fs.promises.mkdir(targetDir, { recursive: true });

		// Write the asset file
		await fs.promises.writeFile(targetPath, buffer);
	}

	async commitChanges(): Promise<boolean> {
		try {
			// First check if there are any changes to commit
			const statusCommand = `cd "${this.settings.gitRepoPath}" && git status --porcelain`;
			const { stdout: statusOutput } = await execAsync(statusCommand);

			if (!statusOutput.trim()) {
				// No changes to commit
				return false;
			}

			const timestamp = new Date().toISOString();
			const commitMessage = this.settings.commitMessage.replace(
				"{timestamp}",
				timestamp,
			);

			// Add and commit changes
			const gitCommands = [
				`cd "${this.settings.gitRepoPath}"`,
				"git add .",
				`git commit -m "${commitMessage}"`,
			].join(" && ");

			await execAsync(gitCommands);
			return true;
		} catch (error) {
			// Git commit might fail if no changes, which is okay
			if (
				!error.message.includes("nothing to commit") &&
				!error.message.includes("working tree clean")
			) {
				throw error;
			}
			return false;
		}
	}

	async confirmAddPublishFlag(file: TFile): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmPublishModal(this.app, file.name, resolve);
			modal.open();
		});
	}

	async addPublishFlag(file: TFile) {
		const content = await this.app.vault.read(file);
		let newContent: string;

		// Check if file already has frontmatter
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

		if (frontmatterMatch) {
			// Add publish: true to existing frontmatter
			const frontmatter = frontmatterMatch[1];
			const newFrontmatter = frontmatter + "\npublish: true";
			newContent = content.replace(
				/^---\n([\s\S]*?)\n---/,
				`---\n${newFrontmatter}\n---`,
			);
		} else {
			// Create new frontmatter at the beginning
			newContent = `---\npublish: true\n---\n\n${content}`;
		}

		await this.app.vault.modify(file, newContent);
	}
}

class ConfirmPublishModal extends Modal {
	fileName: string;
	resolve: (value: boolean) => void;

	constructor(app: App, fileName: string, resolve: (value: boolean) => void) {
		super(app);
		this.fileName = fileName;
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Publish Note?" });
		contentEl.createEl("p", {
			text: `"${this.fileName}" doesn't have "publish: true" in its frontmatter. Would you like to add it and publish the note?`,
		});

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.onclick = () => {
			this.resolve(false);
			this.close();
		};

		const publishButton = buttonContainer.createEl("button", {
			text: "Add & Publish",
			cls: "mod-cta",
		});
		publishButton.onclick = () => {
			this.resolve(true);
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class GeneralPublishSettingTab extends PluginSettingTab {
	plugin: GeneralPublishPlugin;

	constructor(app: App, plugin: GeneralPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "General Publish Settings" });

		new Setting(containerEl)
			.setName("Git Repository Path")
			.setDesc("Path to your git repository where notes will be published")
			.addText((text) =>
				text
					.setPlaceholder("/path/to/your/git/repo")
					.setValue(this.plugin.settings.gitRepoPath)
					.onChange(async (value) => {
						this.plugin.settings.gitRepoPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Publish Folder")
			.setDesc(
				"Folder within the git repository where markdown files will be copied",
			)
			.addText((text) =>
				text
					.setPlaceholder("content")
					.setValue(this.plugin.settings.publishFolder)
					.onChange(async (value) => {
						this.plugin.settings.publishFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Assets Folder")
			.setDesc(
				"Folder within the git repository where images and attachments will be copied",
			)
			.addText((text) =>
				text
					.setPlaceholder("assets")
					.setValue(this.plugin.settings.assetsFolder)
					.onChange(async (value) => {
						this.plugin.settings.assetsFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Commit Message")
			.setDesc(
				"Template for git commit messages. Use {timestamp} for automatic timestamp",
			)
			.addText((text) =>
				text
					.setPlaceholder("Update published notes - {timestamp}")
					.setValue(this.plugin.settings.commitMessage)
					.onChange(async (value) => {
						this.plugin.settings.commitMessage = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto Commit")
			.setDesc("Automatically commit changes after publishing notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCommit)
					.onChange(async (value) => {
						this.plugin.settings.autoCommit = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
