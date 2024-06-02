const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const Jimp = require('jimp');

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
		vscode.commands.registerCommand('extension.scaleImage', async (imgPath) =>
		{
			const width = 500;
			const shouldProceed = await vscode.window.showInformationMessage(
				`Do you want to permanently scale the linked image in the comment to a width of ${width}px? The window will reload after scaling to apply the changes.`,
				{ modal: true },
				'Yes',
				'No'
			);

			if (shouldProceed === 'Yes')
			{
				Jimp.read(imgPath)
					.then(async image =>
					{
						await image.resize(width, Jimp.AUTO).writeAsync(imgPath);
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					})
					.catch(err =>
					{
						vscode.window.showErrorMessage('Image Comments could not scale your image');
						console.error(err);
					});
			}
		})
	);

	for (const [lang, commentSymbol] of Object.entries(supportedLanguages))
	{
		let disposable = vscode.languages.registerHoverProvider(lang, {
			provideHover(document, position, token)
			{
				const line = document.lineAt(position.line).text;
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
							const hoverContent = [
								'# Image Comments',
								match[1],
								'',
								`[Open Image](command:extension.openImage?${encodeURIComponent(JSON.stringify(imgPath))})`,
								`[Scale Image](command:extension.scaleImage?${encodeURIComponent(JSON.stringify(imgPath))})`,
								'',
								`![Image](${imgUri})`,
							].join('\n');
							const md = new vscode.MarkdownString(hoverContent, true);
							md.isTrusted = true;
							return new vscode.Hover(md);
						}
					}
				}
			}
		});
		context.subscriptions.push(disposable);
	}
}

exports.activate = activate;
