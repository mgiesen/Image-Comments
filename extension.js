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
								`![Image](${imgUri})`
							].join('\n');
							const md = new vscode.MarkdownString(hoverContent);
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
