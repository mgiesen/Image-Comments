'use strict';

const vscode = require('vscode');

const { initLogger, log } = require('./logger');
const { handlePasteImageCommand } = require('./pasteImage');
const {
	HOVER_COMMANDS,
	registerHoverProviders,
	handleOpenImageCommand,
	handleResizeImageCommand
} = require('./hoverProvider');

function activate(context)
{
	const outputChannel = vscode.window.createOutputChannel('Image Comments');
	context.subscriptions.push(outputChannel);
	initLogger(outputChannel);
	log('Image Comments extension activated.');

	context.subscriptions.push(
		vscode.commands.registerCommand('imageComments.pasteImage', handlePasteImageCommand),
		// Legacy id kept so existing user keybindings continue to work.
		vscode.commands.registerCommand('imageComment.pasteImage', handlePasteImageCommand),
		vscode.commands.registerCommand(HOVER_COMMANDS.openImage, handleOpenImageCommand),
		vscode.commands.registerCommand(HOVER_COMMANDS.resizeImage, handleResizeImageCommand)
	);

	registerHoverProviders(context);
}

function deactivate()
{
}

module.exports = { activate, deactivate };
