const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

let currentTooltipSize = 500;
const tooltipSizes = [300, 500, 750, 1000, 'no-scale'];

function activate(context)
{
	const supportedLanguages = {
		'javascript': '\/\/',
		'python': '#',
		'cpp': '\/\/',
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

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.openImage', (imgPath) =>
		{
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
		})
	);

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
		if (match && match[1] && match[2])
		{
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
			if (workspaceFolder)
			{
				const rootPath = workspaceFolder.uri.fsPath;
				const imgPath = path.join(rootPath, match[2]);
				if (fs.existsSync(imgPath))
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
						'# Image Comments',
						match[1],
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
			}
		}
	}

	registerHoverProviders(context);
}

exports.activate = activate;
