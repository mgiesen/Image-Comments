'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { supportedLanguages } = require('../src/languages');
const packageJson = require(path.join(__dirname, '..', 'package.json'));

test('every language defines at least one comment style', () =>
{
	for (const [languageId, symbols] of Object.entries(supportedLanguages))
	{
		const hasSingleLine = Array.isArray(symbols.singleLine) && symbols.singleLine.length > 0;
		const hasMultiLine = Boolean(symbols.multiLine && symbols.multiLine.start && symbols.multiLine.end);
		assert.ok(hasSingleLine || hasMultiLine, `${languageId} has neither single-line nor multi-line comments`);
	}
});

test('longer single-line symbols come first (prefix ordering)', () =>
{
	for (const [languageId, symbols] of Object.entries(supportedLanguages))
	{
		const singleLine = symbols.singleLine || [];
		for (let i = 0; i < singleLine.length; i++)
		{
			for (let j = i + 1; j < singleLine.length; j++)
			{
				// A later symbol must not extend an earlier one, otherwise the
				// shorter symbol always matches first and shadows the longer one.
				assert.ok(
					!singleLine[j].startsWith(singleLine[i]),
					`${languageId}: "${singleLine[j]}" is shadowed by "${singleLine[i]}" and must come first`
				);
			}
		}
	}
});

test('package.json activation events match supported languages', () =>
{
	const activationLanguages = packageJson.activationEvents
		.filter((event) => event.startsWith('onLanguage:'))
		.map((event) => event.slice('onLanguage:'.length))
		.sort();

	const supported = Object.keys(supportedLanguages).sort();

	assert.deepEqual(activationLanguages, supported);
});

test('package.json wires the paste command into the context menu', () =>
{
	const commandIds = packageJson.contributes.commands.map((c) => c.command);
	assert.ok(commandIds.includes('imageComments.pasteImage'));

	for (const entry of packageJson.contributes.menus['editor/context'])
	{
		assert.ok(commandIds.includes(entry.command), `menu references unknown command ${entry.command}`);
	}
});
