'use strict';

/**
 * Comment syntax per VS Code language id.
 *
 * singleLine: ordered list of line-comment prefixes. When one prefix starts
 * with another (e.g. Dart's `///` and `//`), the longer one must come first.
 * multiLine:  block comment delimiters.
 * htmlComments: additional HTML block comments (used in Vue templates).
 */
const supportedLanguages = {
	'vue': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' },
		htmlComments: { start: '<!--', end: '-->' }
	},
	'c': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'clojure': {
		singleLine: [';']
	},
	'coffeescript': {
		singleLine: ['#'],
		multiLine: { start: '###', end: '###' }
	},
	'cpp': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'csharp': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'css': {
		multiLine: { start: '/*', end: '*/' }
	},
	'dart': {
		singleLine: ['///', '//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'elixir': {
		singleLine: ['#']
	},
	'fsharp': {
		singleLine: ['//'],
		multiLine: { start: '(*', end: '*)' }
	},
	'go': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'groovy': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'haskell': {
		singleLine: ['--'],
		multiLine: { start: '{-', end: '-}' }
	},
	'html': {
		multiLine: { start: '<!--', end: '-->' }
	},
	'java': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'javascript': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'jsonc': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'kotlin': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'less': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'lua': {
		singleLine: ['--'],
		multiLine: { start: '--[[', end: ']]' }
	},
	'matlab': {
		singleLine: ['%'],
		multiLine: { start: '%{', end: '%}' }
	},
	'objective-c': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'ocaml': {
		multiLine: { start: '(*', end: '*)' }
	},
	'perl': {
		singleLine: ['#'],
		multiLine: { start: '=pod', end: '=cut' }
	},
	'php': {
		singleLine: ['//', '#'],
		multiLine: { start: '/*', end: '*/' }
	},
	'powershell': {
		singleLine: ['#'],
		multiLine: { start: '<#', end: '#>' }
	},
	'python': {
		singleLine: ['#']
	},
	'r': {
		singleLine: ['#']
	},
	'ruby': {
		singleLine: ['#'],
		multiLine: { start: '=begin', end: '=end' }
	},
	'rust': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'sass': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'scala': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'scss': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'shellscript': {
		singleLine: ['#']
	},
	'sql': {
		singleLine: ['--'],
		multiLine: { start: '/*', end: '*/' }
	},
	'swift': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'typescript': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'yaml': {
		singleLine: ['#']
	},
	'glsl': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'odin': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	}
};

/**
 * Returns the comment symbols for a language id, or undefined if unsupported.
 */
function getCommentSymbols(languageId)
{
	return supportedLanguages[languageId];
}

module.exports = { supportedLanguages, getCommentSymbols };
