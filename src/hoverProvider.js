'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const { supportedLanguages, getCommentSymbols } = require('./languages');
const {
	parseImageComment,
	getSingleLineCommentText,
	getInlineBlockCommentText,
	isInsideMultiLineComment,
	extractMultiLineCommentText
} = require('./commentParser');

const TOOLTIP_SIZES = [300, 400, 500, 750, 1000, 'no-scale'];
const DEFAULT_TOOLTIP_SIZE = 400;

const HOVER_COMMANDS = {
	openImage: 'imageComments.openImage',
	resizeImage: 'imageComments.resizeImage'
};

let currentTooltipSize = DEFAULT_TOOLTIP_SIZE;

/**
 * Command handler: opens the image in a VS Code editor tab.
 */
function handleOpenImageCommand(imgPath)
{
	if (typeof imgPath !== 'string' || !imgPath)
	{
		return;
	}
	vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
}

/**
 * Command handler: changes the tooltip image size.
 */
async function handleResizeImageCommand(args)
{
	const size = args && args.size;
	const parsed = size === 'no-scale' ? 'no-scale' : parseInt(size, 10);

	if (!TOOLTIP_SIZES.includes(parsed))
	{
		return;
	}

	currentTooltipSize = parsed;
	await vscode.window.showInformationMessage(
		'Changes will only take effect after reopening the tooltip due to VS Code limitations.',
		{ modal: true }
	);
}

/**
 * Registers hover providers for all supported languages.
 */
function registerHoverProviders(context)
{
	for (const languageId of Object.keys(supportedLanguages))
	{
		context.subscriptions.push(
			vscode.languages.registerHoverProvider(languageId, { provideHover })
		);
	}
}

/**
 * Provides hover content when the user hovers over an image comment.
 */
function provideHover(document, position)
{
	const commentSymbols = getCommentSymbols(document.languageId);
	if (!commentSymbols)
	{
		return;
	}

	const lineText = document.lineAt(position.line).text;

	// Vue templates: check HTML comments first.
	if (commentSymbols.htmlComments)
	{
		const hover = findBlockCommentHover(document, position, lineText, commentSymbols.htmlComments);
		if (hover)
		{
			return hover;
		}
	}

	const singleLineText = getSingleLineCommentText(lineText, position.character, commentSymbols.singleLine);
	if (singleLineText !== null)
	{
		return createHoverForComment(singleLineText, document);
	}

	if (commentSymbols.multiLine)
	{
		return findBlockCommentHover(document, position, lineText, commentSymbols.multiLine);
	}
}

/**
 * Checks whether the position is inside a block comment (inline or spanning
 * multiple lines) and returns the hover for it, if any.
 */
function findBlockCommentHover(document, position, lineText, { start, end })
{
	const inlineText = getInlineBlockCommentText(lineText, position.character, start, end);
	if (inlineText !== null)
	{
		return createHoverForComment(inlineText, document);
	}

	const textBeforePosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
	if (isInsideMultiLineComment(textBeforePosition, start, end))
	{
		const commentText = extractMultiLineCommentText(
			document.getText(),
			document.offsetAt(position),
			start,
			end
		);
		return createHoverForComment(commentText, document);
	}
}

/**
 * Resolves the absolute image path for a comment based on the configured
 * path mode. Returns { imgPath, pathMode }.
 */
function resolveImagePath(imagePath, document)
{
	const config = vscode.workspace.getConfiguration('imageComments');
	const pathMode = config.get('pathMode', 'relativeToFile');

	if (pathMode === 'relativeToWorkspace')
	{
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
			|| (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]);

		if (workspaceFolder)
		{
			return { imgPath: path.join(workspaceFolder.uri.fsPath, imagePath), pathMode };
		}
		// No workspace open: fall back to file-relative resolution.
	}

	return { imgPath: path.join(path.dirname(document.uri.fsPath), imagePath), pathMode: 'relativeToFile' };
}

/**
 * Builds the hover for a comment text, or undefined if it is not an image
 * comment.
 */
function createHoverForComment(commentText, document)
{
	const parsed = parseImageComment(commentText);
	if (!parsed)
	{
		return;
	}

	const { imgPath, pathMode } = resolveImagePath(parsed.imagePath, document);

	let imgExists = false;
	try
	{
		imgExists = fs.existsSync(imgPath) && fs.statSync(imgPath).isFile();
	}
	catch (error)
	{
		imgExists = false;
	}

	if (!imgExists)
	{
		const hoverContent = [
			'## Image Comments',
			`Could not find image relative to the ${pathMode === 'relativeToWorkspace' ? 'workspace' : 'file'}.`,
			'',
			`**Path**: ${imgPath}`
		].join('\n');

		return new vscode.Hover(new vscode.MarkdownString(hoverContent, true));
	}

	const imgUri = vscode.Uri.file(imgPath).toString();

	const sizeLinks = TOOLTIP_SIZES.map((size) =>
	{
		const displaySize = size === 'no-scale' ? 'No Scale' : `${size}px`;
		const commandUri = `command:${HOVER_COMMANDS.resizeImage}?${encodeURIComponent(JSON.stringify({ size }))}`;
		return size === currentTooltipSize
			? `**[${displaySize}](${commandUri})**`
			: `[${displaySize}](${commandUri})`;
	}).join(' ');

	const hoverContent = [
		'## Image Comments',
		parsed.description,
		'',
		`[Open Image in IDE](command:${HOVER_COMMANDS.openImage}?${encodeURIComponent(JSON.stringify(imgPath))})`,
		'',
		sizeLinks,
		'',
		currentTooltipSize === 'no-scale'
			? `![Image](${imgUri})`
			: `![Image](${imgUri}|width=${currentTooltipSize}px)`
	].join('\n');

	const markdown = new vscode.MarkdownString(hoverContent, true);
	markdown.isTrusted = { enabledCommands: [HOVER_COMMANDS.openImage, HOVER_COMMANDS.resizeImage] };
	return new vscode.Hover(markdown);
}

module.exports = {
	HOVER_COMMANDS,
	registerHoverProviders,
	handleOpenImageCommand,
	handleResizeImageCommand
};
