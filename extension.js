const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

let currentTooltipSize = 500;

const tooltipSizes = [300, 500, 750, 1000, 'no-scale'];

const supportedLanguages = {
	'javascript': '\/\/',
	'python': '#',
	'cpp': '\/\/',
	'c': '\/\/',
	'csharp': '\/\/',
	'sql': '--',
	'typescript': '\/\/',
	'typescriptreact': '\/\/',
	'php': '\/\/',
	'java': '\/\/',
	'ruby': '#',
	'go': '//',
	'swift': '//',
	'kotlin': '//',
	'perl': '#',
	'r': '#',
	'shellscript': '#',
	'lua': '--',
	'groovy': '//',
	'powershell': '#',
	'rust': '//',
	'dart': '//',
	'haskell': '--',
	'elixir': '#'
};

function createHoverContent(title, body)
{
	return new vscode.MarkdownString([`# ${title}`, body].join('\n'), true);
}

function activate(context)
{
	// Register function, to open image in IDE
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.openImage', (imgPath) =>
		{
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
		})
	);

	// Register function, to resize image in tooltip
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.resizeImage', async ({ imgPath, size }) =>
		{
			currentTooltipSize = size === 'no-scale' ? 'no-scale' : parseInt(size, 10);
			await vscode.window.showInformationMessage('Changes will be applied only after reopening the tooltip due to VS Code limitations.', { modal: true });
		})
	);

	function registerHoverProviders(context)
	{
		for (const [lang, commentSymbol] of Object.entries(supportedLanguages))
		{
			let disposable = vscode.languages.registerHoverProvider(lang, {
				provideHover(document, position, token)
				{
					return provideHover(document, position);
				}
			});
			context.subscriptions.push(disposable);
		}
	}

	function provideHover(document, position)
	{
		const line = document.lineAt(position.line).text;
		const commentSymbol = supportedLanguages[document.languageId];
		const commentPattern = new RegExp(`${commentSymbol}(.+)\\[(.+\\.\\w+)\\]$`);
		const match = line.match(commentPattern);

		// Verify if the line follows the image comment format
		if (!match || !match[1] || !match[2])
		{
			return;
		}

		const documentFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
		const documentFolderPath = path.dirname(documentFilePath);

		const regexComment = match[1];
		const regexImg = match[2];

		const imgPath = path.join(documentFolderPath, regexImg);
		const imgExists = fs.existsSync(imgPath);

		if (imgExists)
		{
			const imgUri = vscode.Uri.file(imgPath).toString();

			const sizeLinks = tooltipSizes.map(size =>
			{
				if (size === currentTooltipSize)
				{
					return `**[${size === 'no-scale' ? 'No Scale' : size + 'px'}](command:extension.resizeImage?${encodeURIComponent(JSON.stringify({ imgPath, size }))})**`;
				}
				return `[${size === 'no-scale' ? 'No Scale' : size + 'px'}](command:extension.resizeImage?${encodeURIComponent(JSON.stringify({ imgPath, size }))})`;
			}).join(' ');

			const hoverContent = [
				'## Image Comments',
				regexComment,
				'',
				`[Open Image in IDE](command:extension.openImage?${encodeURIComponent(JSON.stringify(imgPath))})`,
				'',
				sizeLinks,
				'',
				currentTooltipSize === 'no-scale' ? `![Image](${imgUri})` : `![Image](${imgUri}|width=${currentTooltipSize}px)`,
			].join('\n');

			const md = new vscode.MarkdownString(hoverContent, true);
			md.isTrusted = true;
			return new vscode.Hover(md);
		}
		else
		{
			const hoverContent = [
				'## Image Comments',
				'Could not find image',
			].join('\n');

			const md = new vscode.MarkdownString(hoverContent, true);
			md.isTrusted = true;
			return new vscode.Hover(md);
		}
	}


	registerHoverProviders(context);
}

exports.activate = activate;
