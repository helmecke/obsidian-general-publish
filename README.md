# Obsidian General Publish

A simple Obsidian plugin that publishes notes with `publish: true` in frontmatter to a git repository folder and commits the changes automatically.

## Features

- **Frontmatter-based Publishing**: Only notes with `publish: true` in frontmatter are published
- **Git Integration**: Automatically copies files to a git repository and commits changes
- **Asset Copying**: Copies referenced images and attachments
- **Configurable**: Customizable folder structure and commit messages

## Setup

1. **Configure Git Repository**: Set the path to your git repository in plugin settings
2. **Configure Folders**: Set the target folder for published notes (default: `content`) and assets (default: `assets`)
3. **Customize Commit Message**: Optional template for git commit messages

## Usage

### Publishing Notes

Add `publish: true` to the frontmatter of any note you want to publish:

```yaml
---
title: My Published Note
publish: true
---
# My Published Note

This note will be published to your git repository.
```

### Commands

- **Publish All Marked Notes**: Publishes all notes with `publish: true` in frontmatter
- **Publish Current Note**: Publishes only the currently active note (if marked for publishing)

## Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` for development with watch mode
4. Run `npm run build` for production build

## Installation

### Manual Installation

1. Download the latest release
2. Extract `main.js`, `styles.css`, and `manifest.json` to your vault's plugins folder: `VaultFolder/.obsidian/plugins/obsidian-general-publish/`
3. Enable the plugin in Obsidian settings

## Settings

- **Git Repository Path**: Path to your local git repository
- **Publish Folder**: Target folder within the repo for markdown files (default: `content`)
- **Assets Folder**: Target folder for images/attachments (default: `assets`)
- **Commit Message**: Template for git commits (supports `{timestamp}` placeholder)
- **Auto Commit**: Whether to automatically commit changes after publishing

## Workflow Integration

This plugin works well with static site generators and git-based publishing workflows:

- **GitHub Pages**: Push to a GitHub repository configured for Pages
- **Netlify/Vercel**: Connect your git repository for automatic deployments
- **Hugo/Jekyll**: Configure folder structure to match your static site generator
- **Custom**: Use any git-based workflow with the flexible folder configuration
