'use strict';

/**
 * Smoke tests for activation and the hover pipeline, using a minimal mock of
 * the vscode API. This does not replace a manual test in the Extension
 * Development Host, but it catches wiring regressions (broken requires,
 * renamed commands, hover crashes) without launching VS Code.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

class Position
{
	constructor(line, character)
	{
		this.line = line;
		this.character = character;
	}
}

class Range
{
	constructor(start, end)
	{
		this.start = start;
		this.end = end;
	}
}

class MarkdownString
{
	constructor(value)
	{
		this.value = value;
		this.isTrusted = false;
	}
}

class Hover
{
	constructor(contents)
	{
		this.contents = contents;
	}
}

const registeredCommands = new Map();
const registeredHoverProviders = new Map();

const vscodeMock = {
	Position,
	Range,
	MarkdownString,
	Hover,
	Uri: {
		file: (fsPath) => ({
			fsPath,
			toString: () => `file://${fsPath}`
		})
	},
	window: {
		createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
		showInformationMessage: async () => undefined,
		showWarningMessage: async () => undefined,
		showErrorMessage: async () => undefined,
		setStatusBarMessage: () => undefined,
		activeTextEditor: undefined
	},
	commands: {
		registerCommand: (id, handler) =>
		{
			registeredCommands.set(id, handler);
			return { dispose() {} };
		},
		executeCommand: async () => undefined
	},
	languages: {
		registerHoverProvider: (languageId, provider) =>
		{
			registeredHoverProviders.set(languageId, provider);
			return { dispose() {} };
		}
	},
	workspace: {
		getConfiguration: () => ({ get: (key, defaultValue) => defaultValue }),
		getWorkspaceFolder: () => undefined,
		workspaceFolders: undefined
	}
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain)
{
	if (request === 'vscode')
	{
		return vscodeMock;
	}
	return originalLoad.call(this, request, parent, isMain);
};

const { activate, deactivate } = require('../src/extension');
const { supportedLanguages } = require('../src/languages');

function fakeDocument(lines, languageId, fsPath)
{
	const text = lines.join('\n');
	const offsetAt = (position) =>
	{
		let offset = 0;
		for (let line = 0; line < position.line; line++)
		{
			offset += lines[line].length + 1;
		}
		return offset + position.character;
	};

	return {
		languageId,
		uri: { fsPath },
		lineAt: (line) => ({ text: lines[line] }),
		offsetAt,
		getText: (range) => (range ? text.substring(offsetAt(range.start), offsetAt(range.end)) : text)
	};
}

test('activate registers commands and hover providers', () =>
{
	const context = { subscriptions: [] };
	activate(context);

	assert.ok(registeredCommands.has('imageComments.pasteImage'));
	assert.ok(registeredCommands.has('imageComment.pasteImage'), 'legacy command id must stay registered');
	assert.ok(registeredCommands.has('imageComments.openImage'));
	assert.ok(registeredCommands.has('imageComments.resizeImage'));

	assert.deepEqual(
		[...registeredHoverProviders.keys()].sort(),
		Object.keys(supportedLanguages).sort()
	);

	assert.ok(context.subscriptions.length > 0);
	deactivate();
});

test('hover renders an existing image', () =>
{
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-comments-test-'));
	const imagePath = path.join(tmpDir, 'sketch.png');
	fs.writeFileSync(imagePath, 'not-a-real-png');

	try
	{
		const provider = registeredHoverProviders.get('javascript');
		const document = fakeDocument(
			['const x = 1; // my sketch [sketch.png]'],
			'javascript',
			path.join(tmpDir, 'main.js')
		);

		const hover = provider.provideHover(document, new Position(0, 20));

		assert.ok(hover instanceof Hover);
		assert.match(hover.contents.value, /my sketch/);
		assert.match(hover.contents.value, /sketch\.png/);
		assert.match(hover.contents.value, /command:imageComments\.openImage/);
		assert.deepEqual(hover.contents.isTrusted, {
			enabledCommands: ['imageComments.openImage', 'imageComments.resizeImage']
		});
	}
	finally
	{
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test('hover reports a missing image without crashing', () =>
{
	const provider = registeredHoverProviders.get('javascript');
	const document = fakeDocument(
		['// missing [does-not-exist.png]'],
		'javascript',
		path.join(os.tmpdir(), 'main.js')
	);

	const hover = provider.provideHover(document, new Position(0, 10));

	assert.ok(hover instanceof Hover);
	assert.match(hover.contents.value, /Could not find image/);
});

test('hover ignores comments without image syntax', () =>
{
	const provider = registeredHoverProviders.get('javascript');
	const document = fakeDocument(['// just a note'], 'javascript', '/tmp/main.js');

	assert.equal(provider.provideHover(document, new Position(0, 8)), undefined);
});

test('hover works in multi-line block comments', () =>
{
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-comments-test-'));
	const imagePath = path.join(tmpDir, 'diagram.png');
	fs.writeFileSync(imagePath, 'not-a-real-png');

	try
	{
		const provider = registeredHoverProviders.get('javascript');
		const document = fakeDocument(
			['/*', '  overview [diagram.png]', '*/', 'code();'],
			'javascript',
			path.join(tmpDir, 'main.js')
		);

		const hover = provider.provideHover(document, new Position(1, 5));

		assert.ok(hover instanceof Hover);
		assert.match(hover.contents.value, /diagram\.png/);
	}
	finally
	{
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});

test('hover does not trigger with relativeToWorkspace and no workspace open', () =>
{
	// Regression test: this used to crash with a TypeError on
	// vscode.workspace.workspaceFolders[0]. It must fall back to
	// file-relative resolution instead.
	vscodeMock.workspace.getConfiguration = () => ({
		get: (key, defaultValue) => (key === 'pathMode' ? 'relativeToWorkspace' : defaultValue)
	});

	try
	{
		const provider = registeredHoverProviders.get('javascript');
		const document = fakeDocument(
			['// note [missing.png]'],
			'javascript',
			path.join(os.tmpdir(), 'main.js')
		);

		const hover = provider.provideHover(document, new Position(0, 8));
		assert.ok(hover instanceof Hover);
		assert.match(hover.contents.value, /Could not find image/);
	}
	finally
	{
		vscodeMock.workspace.getConfiguration = () => ({ get: (key, defaultValue) => defaultValue });
	}
});
