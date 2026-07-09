// Import necessary modules
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const vscode = require('vscode');

const execAsync = promisify(exec);

let outputChannel;

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
		singleLine: ['///', '//'],
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
 * Image paste functionality
 */

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

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
	const commentSymbols = supportedLanguages[languageId];
	const hasSingleLine = commentSymbols && commentSymbols.singleLine && commentSymbols.singleLine.length > 0;
	const hasMultiLine = commentSymbols && commentSymbols.multiLine;

	if (hasSingleLine)
	{
		const symbol = commentSymbols.singleLine[0];
		return `${symbol} [${imagePath}]`;
	}
	else if (hasMultiLine)
	{
		const { start, end } = commentSymbols.multiLine;
		return `${start} [${imagePath}] ${end}`;
	}
	else
	{
		return `// [${imagePath}]`;
	}
}

/**
 * macOS: Detects a file path copied in Finder from the clipboard
 */
async function detectFilePathMac()
{
	try
	{
		const script = `try
	set fileRef to (the clipboard as «class furl»)
	return POSIX path of fileRef
on error
	return ""
end try`;

		const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
		let filePath = stdout.trim();

		filePath = filePath.replace(/[\x00-\x1F\x7F]/g, '').trim();
		filePath = path.normalize(filePath);

		if (!filePath || !fs.existsSync(filePath))
		{
			return null;
		}

		const stats = fs.statSync(filePath);
		if (!stats.isFile())
		{
			return null;
		}

		const ext = path.extname(filePath).slice(1).toLowerCase();
		if (!IMAGE_EXTENSIONS.includes(ext))
		{
			return null;
		}

		if (stats.size > MAX_IMAGE_SIZE)
		{
			vscode.window.showWarningMessage(
				`Image is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
			);
			return null;
		}

		return { tempFilePath: filePath, extension: ext };
	}
	catch (e)
	{
		return null;
	}
}

/**
 * macOS: Detects raw image data from clipboard (screenshot etc.)
 */
async function detectImageDataMac()
{
	let tempFile = null;
	try
	{
		const detectScript = `try
	set imageData to (the clipboard as «class PNGf»)
	return "png"
on error
	try
		set imageData to (the clipboard as «class JPEG»)
		return "jpg"
	on error
		try
			set imageData to (the clipboard as «class GIFf»)
			return "gif"
		on error
			return "error"
		end try
	end try
end try`;

		const { stdout } = await execAsync(`osascript -e '${detectScript}'`, { timeout: 5000 });
		const format = stdout.trim().toLowerCase();

		if (format === 'error' || !IMAGE_EXTENSIONS.includes(format))
		{
			return null;
		}

		tempFile = path.join(
			os.tmpdir(),
			`vscode-image-${Date.now()}-${Math.random().toString(36).substring(7)}.${format}`
		);

		const readData = format === 'png'
			? 'the clipboard as «class PNGf»'
			: format === 'jpg' || format === 'jpeg'
				? 'the clipboard as «class JPEG»'
				: 'the clipboard as «class GIFf»';

		const escapedPath = tempFile.replace(/'/g, "\\'");
		const saveScript = `try
	set imageData to ${readData}
	set filePath to POSIX file "${escapedPath}"
	set fileRef to open for access file filePath with write permission
	write imageData to fileRef
	close access fileRef
	return "success"
on error
	return "error"
end try`;

		const saveResult = await execAsync(`osascript -e '${saveScript}'`, { timeout: 10000 });

		if (saveResult.stdout.trim() !== 'success' || !fs.existsSync(tempFile))
		{
			if (tempFile && fs.existsSync(tempFile))
			{
				try { fs.unlinkSync(tempFile); } catch {}
			}
			return null;
		}

		const stats = fs.statSync(tempFile);
		if (stats.size > MAX_IMAGE_SIZE)
		{
			fs.unlinkSync(tempFile);
			vscode.window.showWarningMessage(
				`Image is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
			);
			return null;
		}

		return { tempFilePath: tempFile, extension: format };
	}
	catch (e)
	{
		if (tempFile && fs.existsSync(tempFile))
		{
			try { fs.unlinkSync(tempFile); } catch {}
		}
		return null;
	}
}

/**
 * Windows: Detects a file path copied in Explorer from the clipboard
 */
async function detectFilePathWindows()
{
	try
	{
		const script = `$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.Windows.Forms; $fileList = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($fileList.Count -gt 0) { Write-Output $fileList[0] }`;
		const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

		const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encodedScript}`, { timeout: 5000 });
		let filePath = stdout.trim();

		filePath = filePath.replace(/[\x00-\x1F\x7F]/g, '').trim();
		filePath = path.normalize(filePath);

		if (!filePath || !fs.existsSync(filePath))
		{
			return null;
		}

		const stats = fs.statSync(filePath);
		if (!stats.isFile())
		{
			return null;
		}

		const ext = path.extname(filePath).slice(1).toLowerCase();
		if (!IMAGE_EXTENSIONS.includes(ext))
		{
			return null;
		}

		if (stats.size > MAX_IMAGE_SIZE)
		{
			vscode.window.showWarningMessage(
				`Image is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
			);
			return null;
		}

		return { tempFilePath: filePath, extension: ext };
	}
	catch (e)
	{
		return null;
	}
}

/**
 * Windows: Detects raw image data from clipboard
 */
async function detectImageDataWindows()
{
	let tempFile = null;
	try
	{
		const tmpDir = os.tmpdir();
		tempFile = path.join(tmpDir, `vscode-image-${Date.now()}.png`);

		const escapedTempFile = tempFile.replace(/"/g, '`"');
		const script = `$ProgressPreference = 'SilentlyContinue'; $TempFile = "${escapedTempFile}"; Add-Type -AssemblyName System.Windows.Forms; $clipboard = [System.Windows.Forms.Clipboard]::GetImage(); if ($clipboard -ne $null) { $format = $clipboard.RawFormat.Guid; if ($format -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid) { $ext = "png" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) { $ext = "jpg" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Gif.Guid) { $ext = "gif" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Bmp.Guid) { $ext = "bmp" } else { $ext = "png" }; $tempFile = $TempFile -replace '\\.png$', ".$ext"; try { $clipboard.Save($tempFile); Write-Output $tempFile } catch { Write-Error $_.Exception.Message } }`;
		const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

		const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encodedScript}`, { timeout: 10000 });

		let outputFile = stdout.trim().replace(/[\x00-\x1F\x7F]/g, '').trim();
		outputFile = path.normalize(outputFile);

		if (!outputFile || !fs.existsSync(outputFile))
		{
			if (tempFile && fs.existsSync(tempFile))
			{
				try { fs.unlinkSync(tempFile); } catch {}
			}
			return null;
		}

		const tmpDirNormalized = path.normalize(tmpDir);
		const outputNormalized = path.normalize(outputFile);
		if (!outputNormalized.toLowerCase().startsWith(tmpDirNormalized.toLowerCase() + path.sep) && outputNormalized.toLowerCase() !== tmpDirNormalized.toLowerCase())
		{
			try { fs.unlinkSync(outputNormalized); } catch {}
			return null;
		}

		const stats = fs.statSync(outputFile);
		if (stats.size > MAX_IMAGE_SIZE)
		{
			fs.unlinkSync(outputFile);
			vscode.window.showWarningMessage(
				`Image is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
			);
			return null;
		}

		const ext = path.extname(outputFile).slice(1).toLowerCase();
		if (!IMAGE_EXTENSIONS.includes(ext))
		{
			fs.unlinkSync(outputFile);
			return null;
		}

		return { tempFilePath: outputFile, extension: ext };
	}
	catch (e)
	{
		if (tempFile && fs.existsSync(tempFile))
		{
			try { fs.unlinkSync(tempFile); } catch {}
		}
		return null;
	}
}

/**
 * Detects image from clipboard (Windows)
 */
async function detectImageFromClipboardWindows()
{
	const [filePathResult, imageDataResult] = await Promise.all([
		detectFilePathWindows(),
		detectImageDataWindows(),
	]);

	if (filePathResult)
	{
		if (imageDataResult && imageDataResult.tempFilePath !== filePathResult.tempFilePath)
		{
			const tmpDir = os.tmpdir();
			if (imageDataResult.tempFilePath.startsWith(tmpDir))
			{
				try { fs.unlinkSync(imageDataResult.tempFilePath); } catch {}
			}
		}
		return filePathResult;
	}

	return imageDataResult;
}

/**
 * Detects image from clipboard (macOS)
 */
async function detectImageFromClipboardMac()
{
	const [filePathResult, imageDataResult] = await Promise.all([
		detectFilePathMac(),
		detectImageDataMac(),
	]);

	if (filePathResult)
	{
		if (imageDataResult && imageDataResult.tempFilePath !== filePathResult.tempFilePath)
		{
			const tmpDir = os.tmpdir();
			if (imageDataResult.tempFilePath.startsWith(tmpDir))
			{
				try { fs.unlinkSync(imageDataResult.tempFilePath); } catch {}
			}
		}
		return filePathResult;
	}

	return imageDataResult;
}

/**
 * Detects image from clipboard (platform-specific dispatcher)
 */
async function detectImageFromClipboard()
{
	const platform = process.platform;

		if (platform === 'darwin')
	{
		return await detectImageFromClipboardMac();
	}

	if (platform === 'win32')
	{
		return await detectImageFromClipboardWindows();
	}

	return null;
}

/**
 * Handles the paste image command
 */
async function handlePasteImageCommand()
{
	const editor = vscode.window.activeTextEditor;
	if (!editor)
	{
		outputChannel.appendLine('[PasteImage] No active editor.');
		vscode.window.showWarningMessage('No active editor.');
		return;
	}

	const platform = process.platform;
	outputChannel.appendLine(`[PasteImage] Platform: ${platform}`);
	if (platform !== 'darwin' && platform !== 'win32')
	{
		outputChannel.appendLine('[PasteImage] Unsupported platform.');
		vscode.window.showWarningMessage('Paste Image from Clipboard is currently only supported on macOS and Windows.');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
	if (!workspaceFolder)
	{
		outputChannel.appendLine('[PasteImage] No workspace folder.');
		vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
		return;
	}

	const config = vscode.workspace.getConfiguration('imageComments');
	const saveDir = config.get('saveDirectory', 'image-comments');
	const workspaceRoot = workspaceFolder.uri.fsPath;
	const imageDir = path.join(workspaceRoot, saveDir);

	if (!fs.existsSync(imageDir))
	{
		fs.mkdirSync(imageDir, { recursive: true });
	}

	const languageId = editor.document.languageId;
	const commentSymbols = supportedLanguages[languageId];
	let commentPrefix = '//';
	if (commentSymbols)
	{
		if (commentSymbols.singleLine && commentSymbols.singleLine.length > 0)
		{
			commentPrefix = commentSymbols.singleLine[0];
		}
		else if (commentSymbols.multiLine)
		{
			commentPrefix = commentSymbols.multiLine.start;
		}
	}

	const cursorPos = editor.selection.active;
	const placeholderText = `${commentPrefix} Image Comments: Inserting image from clipboard. Please wait...`;
	const placeholder = commentSymbols && commentSymbols.multiLine && (!commentSymbols.singleLine || commentSymbols.singleLine.length === 0) && !commentSymbols.htmlComments
		? `${placeholderText} ${commentSymbols.multiLine.end}`  // HTML or CSS multi-line only
		: placeholderText;

	let placeholderInserted = false;
	await editor.edit((editBuilder) =>
	{
		editBuilder.insert(cursorPos, placeholder);
	}).then((success) => { placeholderInserted = success; });

	if (!placeholderInserted)
	{
		return;
	}

	const placeholderRange = new vscode.Range(
		cursorPos,
		new vscode.Position(cursorPos.line, cursorPos.character + placeholder.length)
	);

	try
	{
		outputChannel.appendLine('[PasteImage] Detecting image from clipboard...');
		const imageInfo = await detectImageFromClipboard();
		outputChannel.appendLine(`[PasteImage] Image detected: ${imageInfo ? `${imageInfo.extension} (${imageInfo.tempFilePath})` : 'null'}`);

		if (!imageInfo)
		{
			vscode.window.showInformationMessage(
				'No image found in clipboard. Copy an image file from Finder or take a screenshot first.'
			);
			await editor.edit((editBuilder) =>
			{
				editBuilder.replace(placeholderRange, '');
			});
			return;
		}

		const fileName = generateFileName(imageInfo.extension);
		const filePath = path.join(imageDir, fileName);

		const tmpDir = os.tmpdir();
		const isTempFile = imageInfo.tempFilePath.startsWith(tmpDir);
		outputChannel.appendLine(`[PasteImage] isTempFile: ${isTempFile}, source: ${imageInfo.tempFilePath}`);

		if (!fs.existsSync(imageInfo.tempFilePath))
		{
			throw new Error(`Source image file not found: ${imageInfo.tempFilePath}`);
		}

		if (isTempFile)
		{
			fs.renameSync(imageInfo.tempFilePath, filePath);
		}
		else
		{
			fs.copyFileSync(imageInfo.tempFilePath, filePath);
		}

		const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
		const comment = generateComment(relativePath, languageId);
		outputChannel.appendLine(`[PasteImage] Language: ${languageId}, comment: "${comment}"`);

		await editor.edit((editBuilder) =>
		{
			editBuilder.replace(placeholderRange, comment);
		});

		vscode.window.setStatusBarMessage(`Image saved: ${relativePath}`, 5000);
		outputChannel.appendLine(`[PasteImage] SUCCESS: ${relativePath}`);
	}
	catch (error)
	{
		outputChannel.appendLine(`[PasteImage] ERROR: ${error instanceof Error ? error.message : String(error)}`);
		await editor.edit((editBuilder) =>
		{
			editBuilder.replace(placeholderRange, '');
		});
		vscode.window.showErrorMessage(
			`Failed to save image: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

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
	outputChannel = vscode.window.createOutputChannel('Image Comments');
	outputChannel.appendLine('Image Comments extension activated.');

	context.subscriptions.push(
		vscode.commands.registerCommand('imageComment.pasteImage', handlePasteImageCommand)
	);

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
	if (languageId === 'vue' && commentSymbols.htmlComments)
	{
		const { start: htmlStart, end: htmlEnd } = commentSymbols.htmlComments;
		const startIndex = lineText.indexOf(htmlStart);
		const endIndex = lineText.indexOf(htmlEnd, startIndex + htmlStart.length);

		if (
			startIndex !== -1 &&
			endIndex !== -1 &&
			position.character > startIndex &&
			position.character < endIndex
		)
		{
			// Cursor is within an HTML comment
			const commentText = lineText.substring(startIndex + htmlStart.length, endIndex).trim();
			return processComment(commentText, document);
		}

		// Check for multi-line HTML comments
		const inHtmlComment = isPositionInMultiLineComment(document, position, htmlStart, htmlEnd);
		if (inHtmlComment)
		{
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

