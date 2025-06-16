# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin codebase that follows the standard Obsidian plugin template structure. The plugin is built with TypeScript and uses esbuild for bundling.

## Development Commands

- `npm run dev` - Start development mode with watch compilation
- `npm run build` - Build for production (includes TypeScript type checking)
- `npm run version` - Bump version and update manifest/versions files

## Architecture

- **Entry Point**: `main.ts` - Contains the main plugin class extending Obsidian's Plugin base class
- **Build System**: esbuild configuration in `esbuild.config.mjs` with external dependencies for Obsidian API
- **Plugin Structure**: Standard Obsidian plugin with ribbon icons, commands, modals, and settings tab
- **Settings**: Plugin settings interface and persistence using Obsidian's data API
- **Output**: Builds to `main.js` which Obsidian loads along with `manifest.json` and `styles.css`

## Key Files

- `manifest.json` - Plugin metadata (ID, version, description, compatibility)
- `main.ts` - Plugin implementation with sample ribbon, commands, modal, and settings
- `esbuild.config.mjs` - Build configuration excluding Obsidian API and CodeMirror from bundle
- `version-bump.mjs` - Automated version management script
- `versions.json` - Version compatibility matrix for Obsidian releases

## Testing

Install the plugin by copying `main.js`, `styles.css`, and `manifest.json` to `.obsidian/plugins/your-plugin-id/` in an Obsidian vault for manual testing.
