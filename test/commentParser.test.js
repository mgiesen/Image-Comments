'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
	parseImageComment,
	countOccurrences,
	getSingleLineCommentText,
	getInlineBlockCommentText,
	isInsideMultiLineComment,
	extractMultiLineCommentText,
	wrapComment
} = require('../src/commentParser');

test('parseImageComment: path only', () =>
{
	assert.deepEqual(parseImageComment('[images/foo.png]'), {
		description: '',
		imagePath: 'images/foo.png'
	});
});

test('parseImageComment: description and path', () =>
{
	assert.deepEqual(parseImageComment('My sketch [foo.png]'), {
		description: 'My sketch',
		imagePath: 'foo.png'
	});
});

test('parseImageComment: trailing whitespace allowed', () =>
{
	assert.deepEqual(parseImageComment('x [a.png]   '), {
		description: 'x',
		imagePath: 'a.png'
	});
});

test('parseImageComment: rejects non-image comments', () =>
{
	assert.equal(parseImageComment('just a comment'), null);
	assert.equal(parseImageComment('[foo.png] trailing text'), null);
	assert.equal(parseImageComment(''), null);
	assert.equal(parseImageComment(null), null);
});

test('parseImageComment: whitespace-only path rejected', () =>
{
	assert.equal(parseImageComment('[   ]'), null);
});

test('countOccurrences: non-overlapping', () =>
{
	assert.equal(countOccurrences('/**/', '/*'), 1);
	assert.equal(countOccurrences('/**/', '*/'), 1);
	assert.equal(countOccurrences('### a ###', '###'), 2);
	assert.equal(countOccurrences('abc', 'x'), 0);
});

test('getSingleLineCommentText: cursor inside comment', () =>
{
	assert.equal(getSingleLineCommentText('code(); // note [a.png]', 15, ['//']), 'note [a.png]');
});

test('getSingleLineCommentText: cursor before comment', () =>
{
	assert.equal(getSingleLineCommentText('code(); // note', 2, ['//']), null);
});

test('getSingleLineCommentText: Dart doc comments prefer longest symbol', () =>
{
	assert.equal(getSingleLineCommentText('/// doc [a.png]', 8, ['///', '//']), 'doc [a.png]');
});

test('getSingleLineCommentText: no symbols', () =>
{
	assert.equal(getSingleLineCommentText('code();', 2, undefined), null);
});

test('getInlineBlockCommentText: cursor inside', () =>
{
	assert.equal(getInlineBlockCommentText('a(); /* hint [b.png] */ b();', 10, '/*', '*/'), 'hint [b.png]');
});

test('getInlineBlockCommentText: cursor outside', () =>
{
	assert.equal(getInlineBlockCommentText('a(); /* hint */ b();', 2, '/*', '*/'), null);
	assert.equal(getInlineBlockCommentText('a(); b();', 2, '/*', '*/'), null);
});

test('isInsideMultiLineComment: open block', () =>
{
	assert.equal(isInsideMultiLineComment('code();\n/* start\n', '/*', '*/'), true);
	assert.equal(isInsideMultiLineComment('code();\n/* done */\n', '/*', '*/'), false);
});

test('isInsideMultiLineComment: symmetric delimiters (CoffeeScript ###)', () =>
{
	assert.equal(isInsideMultiLineComment('x = 1\n###\ninside ', '###', '###'), true);
	assert.equal(isInsideMultiLineComment('x = 1\n###\nblock\n###\nafter ', '###', '###'), false);
});

test('extractMultiLineCommentText: extracts surrounding block', () =>
{
	const text = 'a();\n/*\n  sketch [img.png]\n*/\nb();';
	const offset = text.indexOf('sketch');
	assert.equal(extractMultiLineCommentText(text, offset, '/*', '*/'), 'sketch [img.png]');
});

test('extractMultiLineCommentText: unterminated block returns empty', () =>
{
	const text = 'a();\n/*\n  sketch';
	assert.equal(extractMultiLineCommentText(text, text.length, '/*', '*/'), '');
});

test('wrapComment: prefers single-line symbol', () =>
{
	assert.equal(wrapComment('[a.png]', { singleLine: ['//'], multiLine: { start: '/*', end: '*/' } }), '// [a.png]');
});

test('wrapComment: multi-line only languages (CSS, HTML, OCaml)', () =>
{
	assert.equal(wrapComment('[a.png]', { multiLine: { start: '/*', end: '*/' } }), '/* [a.png] */');
	assert.equal(wrapComment('[a.png]', { multiLine: { start: '<!--', end: '-->' } }), '<!-- [a.png] -->');
});

test('wrapComment: unknown language falls back to //', () =>
{
	assert.equal(wrapComment('[a.png]', undefined), '// [a.png]');
});
