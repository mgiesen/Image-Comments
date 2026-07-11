'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const { detectImageFromClipboard, MAX_IMAGE_SIZE } = require('./clipboard');
const { getCommentSymbols } = require('./languages');
const { wrapComment } = require('./commentParser');
const { log } = require('./logger');

function generateFileName(extension)
{
	const timestamp = new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\..+/, '')
		.replace('T', '-');
	const random = Math.random().toString(36).substring(2, 8);
	return `image-${timestamp}-${random}.${extension}`;
}

function generateComment(imagePath, languageId)
{
	return wrapComment(`[${imagePath}]`, getCommentSymbols(languageId));
}

/**
 * Moves a file, falling back to copy + delete when rename is not possible
 * (e.g. temp dir and workspace on different volumes).
 */
function moveFile(sourcePath, targetPath)
{
	try
	{
		fs.renameSync(sourcePath, targetPath);
	}
	catch (error)
	{
		fs.copyFileSync(sourcePath, targetPath);
		try
		{
			fs.unlinkSync(sourcePath);
		}
		catch (unlinkError)
		{
			log(`[PasteImage] Could not remove temp file ${sourcePath}: ${unlinkError.message}`);
		}
	}
}

/**
 * Finds the placeholder in the current document state. The user may have
 * typed while the clipboard was being read, so the originally computed range
 * can be stale — searching by text is robust against that.
 */
function findPlaceholderRange(document, placeholder)
{
	const text = document.getText();
	const index = text.indexOf(placeholder);
	if (index === -1)
	{
		return null;
	}

	return new vscode.Range(
		document.positionAt(index),
		document.positionAt(index + placeholder.length)
	);
}

async function replacePlaceholder(editor, placeholder, replacement)
{
	const range = findPlaceholderRange(editor.document, placeholder);
	if (!range)
	{
		return false;
	}

	return editor.edit((editBuilder) =>
	{
		editBuilder.replace(range, replacement);
	});
}

/**
 * Handles the "Image Comments: Paste Image" command.
 */
async function handlePasteImageCommand()
{
	const editor = vscode.window.activeTextEditor;
	if (!editor)
	{
		vscode.window.showWarningMessage('No active editor.');
		return;
	}

	if (process.platform !== 'darwin' && process.platform !== 'win32')
	{
		vscode.window.showWarningMessage('Paste Image from Clipboard is currently only supported on macOS and Windows.');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder)
	{
		vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
		return;
	}

	const config = vscode.workspace.getConfiguration('imageComments');
	const saveDir = config.get('saveDirectory', 'image-comments');
	const workspaceRoot = workspaceFolder.uri.fsPath;
	const imageDir = path.join(workspaceRoot, saveDir);

	try
	{
		fs.mkdirSync(imageDir, { recursive: true });
	}
	catch (error)
	{
		vscode.window.showErrorMessage(`Could not create image directory "${imageDir}": ${error.message}`);
		return;
	}

	const languageId = editor.document.languageId;
	const commentSymbols = getCommentSymbols(languageId);
	const placeholder = wrapComment('Image Comments: Inserting image from clipboard. Please wait...', commentSymbols);

	const placeholderInserted = await editor.edit((editBuilder) =>
	{
		editBuilder.insert(editor.selection.active, placeholder);
	});

	if (!placeholderInserted)
	{
		return;
	}

	try
	{
		log('[PasteImage] Detecting image from clipboard...');
		const result = await detectImageFromClipboard();

		if (!result.ok)
		{
			await replacePlaceholder(editor, placeholder, '');

			if (result.reason === 'too-large')
			{
				vscode.window.showWarningMessage(
					`Image is too large (${(result.sizeBytes / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
				);
			}
			else
			{
				vscode.window.showInformationMessage(
					'No image found in clipboard. Copy an image file or take a screenshot first.'
				);
			}
			return;
		}

		const fileName = generateFileName(result.extension);
		const targetPath = path.join(imageDir, fileName);

		if (result.isTemporary)
		{
			moveFile(result.filePath, targetPath);
		}
		else
		{
			fs.copyFileSync(result.filePath, targetPath);
		}

		const relativePath = path.relative(workspaceRoot, targetPath).replace(/\\/g, '/');
		const comment = generateComment(relativePath, languageId);
		log(`[PasteImage] Saved ${relativePath}, inserting comment: "${comment}"`);

		const replaced = await replacePlaceholder(editor, placeholder, comment);
		if (!replaced)
		{
			// The placeholder is gone (user removed it or closed the editor).
			// The image is saved, so surface the path instead of failing silently.
			vscode.window.showInformationMessage(`Image saved as ${relativePath}, but the comment could not be inserted.`);
			return;
		}

		vscode.window.setStatusBarMessage(`Image saved: ${relativePath}`, 5000);
	}
	catch (error)
	{
		const message = error instanceof Error ? error.message : String(error);
		log(`[PasteImage] ERROR: ${message}`);
		await replacePlaceholder(editor, placeholder, '');
		vscode.window.showErrorMessage(`Failed to save image: ${message}`);
	}
}

module.exports = { handlePasteImageCommand, generateFileName, generateComment };
