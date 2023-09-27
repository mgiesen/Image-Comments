const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function activate(context)
{
	const supportedLanguages = {
		'javascript': '\/\/',
		'python': '#',
		'cpp': '\/\/',
		'csharp': '\/\/'
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.openImage', (imgPath) =>
		{
			vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
		})
	);

	for (const [lang, commentSymbol] of Object.entries(supportedLanguages))
	{
		let disposable = vscode.languages.registerHoverProvider(lang, {
			provideHover(document, position, token)
			{
				const line = document.lineAt(position.line).text;
				const commentPattern = new RegExp(`${commentSymbol}(.+) \\[(.+\\.\\w+)\\]$`);

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
