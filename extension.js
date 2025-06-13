// Import necessary modules
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Initialize the default tooltip size
let currentTooltipSize = 400;

// Define available tooltip sizes
const tooltipSizes = [300, 400, 500, 750, 1000, 'no-scale'];

/**
 * Supported languages with their comment symbols
 */
const supportedLanguages = {
	'vue': {
		singleLine: ['//'],
		multiLine: { 
			start: '/*', 
			end: '*/' 
		},
		htmlComments: {
			start: '<!--',
			end: '-->'
		}
	},
	'c': {
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'clojure': {
		singleLine: [';']
		// No support for multi-line comments
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
		singleLine: ['//'],
		multiLine: { start: '/*', end: '*/' }
	},
	'elixir': {
		singleLine: ['#']
		// No support for multi-line comments
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
		// No support for multi-line comments
	},
	'r': {
		singleLine: ['#']
		// No support for multi-line comments
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
		// No support for multi-line comments
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
		// No support for multi-line comments
	}
};


/**
 * Escapes special characters in a string so it can be used in a regular expression
 */
function escapeRegExp(string)
{
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Activates the extension
 */
function activate(context)
{
	// Register command to open image in the editor
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.openImage', (imgPath) =>
		{
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
		})
	);

	// Register command to resize image in the tooltip
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.resizeImage', async ({ imgPath, size }) =>
		{
			currentTooltipSize = size === 'no-scale' ? 'no-scale' : parseInt(size, 10);
			await vscode.window.showInformationMessage('Changes will only take effect after reopening the tooltip due to VS Code limitations.', { modal: true });
		})
	);

	// Register hover providers for all supported languages
	registerHoverProviders(context);
}

/**
 * Registers hover providers for each supported language
 */
function registerHoverProviders(context)
{
	for (const languageId of Object.keys(supportedLanguages))
	{
		const disposable = vscode.languages.registerHoverProvider(languageId, {
			provideHover(document, position)
			{
				return provideHover(document, position);
			}
		});
		context.subscriptions.push(disposable);
	}
}

/**
 * Provides hover content when the user hovers over a comment
 */
function provideHover(document, position)
{
	const languageId = document.languageId;
	const commentSymbols = supportedLanguages[languageId];

	if (!commentSymbols)
	{
		return;
	}

	const lineText = document.lineAt(position.line).text;
	const lineTillPosition = lineText.substring(0, position.character);

	// For Vue files, check HTML comments first
	if (languageId === 'vue' && commentSymbols.htmlComments) {
		const { start: htmlStart, end: htmlEnd } = commentSymbols.htmlComments;
		const startIndex = lineText.indexOf(htmlStart);
		const endIndex = lineText.indexOf(htmlEnd, startIndex + htmlStart.length);

		if (
			startIndex !== -1 &&
			endIndex !== -1 &&
			position.character > startIndex &&
			position.character < endIndex
		) {
			// Cursor is within an HTML comment
			const commentText = lineText.substring(startIndex + htmlStart.length, endIndex).trim();
			return processComment(commentText, document);
		}

		// Check for multi-line HTML comments
		const inHtmlComment = isPositionInMultiLineComment(document, position, htmlStart, htmlEnd);
		if (inHtmlComment) {
			const commentText = getMultiLineCommentText(document, position, htmlStart, htmlEnd);
			return processComment(commentText, document);
		}
	}

	// Check for single-line comments
	const singleLineCommentSymbols = commentSymbols.singleLine || [];
	for (const symbol of singleLineCommentSymbols)
	{
		const symbolIndex = lineText.indexOf(symbol);
		if (symbolIndex !== -1 && position.character >= symbolIndex)
		{
			const commentText = lineText.substring(symbolIndex + symbol.length).trim();
			return processComment(commentText, document);
		}
	}

	// Check for multi-line comments on the same line
	if (commentSymbols.multiLine)
	{
		const { start: startSymbol, end: endSymbol } = commentSymbols.multiLine;
		const startIndex = lineText.indexOf(startSymbol);
		const endIndex = lineText.indexOf(endSymbol, startIndex + startSymbol.length);

		if (
			startIndex !== -1 &&
			endIndex !== -1 &&
			position.character > startIndex &&
			position.character < endIndex
		)
		{
			// Cursor is within a multi-line comment on the same line
			const commentText = lineText.substring(startIndex + startSymbol.length, endIndex).trim();
			return processComment(commentText, document);
		}

		// Check for multi-line comments spanning multiple lines
		const inMultiLineComment = isPositionInMultiLineComment(document, position, startSymbol, endSymbol);

		if (inMultiLineComment)
		{
			const commentText = getMultiLineCommentText(document, position, startSymbol, endSymbol);
			return processComment(commentText, document);
		}
	}

	// Not in a comment
	return;
}

/**
 * Determines if the cursor position is within a multi-line comment.
 * @param {vscode.TextDocument} document - The active text document.
 * @param {vscode.Position} position - The cursor position.
 * @param {string} startSymbol - The multi-line comment start symbol.
 * @param {string} endSymbol - The multi-line comment end symbol.
 * @returns {boolean} - True if within a multi-line comment, false otherwise.
 */
function isPositionInMultiLineComment(document, position, startSymbol, endSymbol)
{
	const textBeforePosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

	// Regular expressions to match the start and end symbols
	const startSymbolRegex = new RegExp(escapeRegExp(startSymbol), 'g');
	const endSymbolRegex = new RegExp(escapeRegExp(endSymbol), 'g');

	// Count occurrences before the cursor position
	const startMatches = [...textBeforePosition.matchAll(startSymbolRegex)].length;
	const endMatches = [...textBeforePosition.matchAll(endSymbolRegex)].length;

	// Determine if the position is within a multi-line comment
	return startMatches > endMatches;
}

/**
 * Extracts the text of the multi-line comment containing the cursor position.
 * @param {vscode.TextDocument} document - The active text document.
 * @param {vscode.Position} position - The cursor position.
 * @param {string} startSymbol - The multi-line comment start symbol.
 * @param {string} endSymbol - The multi-line comment end symbol.
 * @returns {string} - The text of the multi-line comment.
 */
function getMultiLineCommentText(document, position, startSymbol, endSymbol)
{
	const documentText = document.getText();

	// Find the start of the comment
	const offset = document.offsetAt(position);
	const textBeforePosition = documentText.substring(0, offset);
	const startSymbolIndex = textBeforePosition.lastIndexOf(startSymbol);

	if (startSymbolIndex === -1)
	{
		return '';
	}

	// Find the end of the comment
	const textAfterStart = documentText.substring(startSymbolIndex + startSymbol.length);
	const endSymbolIndex = textAfterStart.indexOf(endSymbol);

	if (endSymbolIndex === -1)
	{
		return '';
	}

	// Extract the comment text
	const commentText = textAfterStart.substring(0, endSymbolIndex).trim();

	return commentText;
}

// Processes the comment text to determine if it contains an image comment.
function processComment(commentText, document)
{
	/*
		Regular expression to match the image comment syntax
	
		^(.*)           captures any text (including none) at the beginning of the line.
		\[              matches the opening square bracket.
		([^\]]+)        captures everything inside the square brackets, ensuring no closing bracket is included.
		\]              matches the closing square bracket.
		\s*$            allows optional whitespace at the end of the line.
	*/

	const commentPattern = /^(.*?)\[([^\]]+)\]\s*$/;
	const match = commentText.match(commentPattern);

	if (!match)
	{
		return;
	}

	const descriptionText = match[1];
	const imagePath = match[2];

	if (!imagePath)
	{
		return;
	}

	// Extract and trim the description and image path
	const description = descriptionText ? descriptionText.trim() : '';
	const cleanImagePath = imagePath.trim();

	// Get the configuration for path mode
	const config = vscode.workspace.getConfiguration('imageComments');
	const pathMode = config.get('pathMode', 'relativeToFile');

	// Resolve the absolute path of the image based on the path mode
	let imgPath;
	if (pathMode === 'relativeToWorkspace')
	{
		const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
		imgPath = path.join(workspaceFolder, cleanImagePath);
	}
	else
	{
		const documentFolderPath = path.dirname(document.uri.fsPath);
		imgPath = path.join(documentFolderPath, cleanImagePath);
	}

	let imgExists = false;

	try
	{
		imgExists = fs.existsSync(imgPath);
	}
	catch (error)
	{
		imgExists = false;
	}

	if (imgExists)
	{
		const imgUri = vscode.Uri.file(imgPath).toString();

		// Generate size adjustment links
		const sizeLinks = tooltipSizes.map(size =>
		{
			const displaySize = size === 'no-scale' ? 'No Scale' : `${size}px`;
			if (size === currentTooltipSize)
			{
				return `**[${displaySize}](command:extension.resizeImage?${encodeURIComponent(JSON.stringify({ imgPath, size }))})**`;
			}

			return `[${displaySize}](command:extension.resizeImage?${encodeURIComponent(JSON.stringify({ imgPath, size }))})`;

		}).join(' ');

		// Construct the hover content
		const hoverContent = [
			'## Image Comments',
			description,
			'',
			`[Open Image in IDE](command:extension.openImage?${encodeURIComponent(JSON.stringify(imgPath))})`,
			'',
			sizeLinks,
			'',
			currentTooltipSize === 'no-scale'
				? `![Image](${imgUri})`
				: `![Image](${imgUri}|width=${currentTooltipSize}px)`,
		].join('\n');

		// Create and return the hover object
		const markdown = new vscode.MarkdownString(hoverContent, true);
		markdown.isTrusted = true;
		return new vscode.Hover(markdown);
	}
	else
	{
		// If the image does not exist, display an error message
		const hoverContent = [
			'## Image Comments',
			`Could not find image relative to the ${pathMode === 'relativeToWorkspace' ? 'workspace' : 'file'}.`,
			'',
			`**Path**: ${imgPath}`,
		].join('\n');

		const markdown = new vscode.MarkdownString(hoverContent, true);
		markdown.isTrusted = true;
		return new vscode.Hover(markdown);
	}
}

exports.activate = activate;

