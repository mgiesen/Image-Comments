'use strict';

let channel = null;

/**
 * Binds the logger to a vscode OutputChannel. Until initialized, log calls
 * are silently dropped, so modules can log unconditionally.
 */
function initLogger(outputChannel)
{
	channel = outputChannel;
}

function log(message)
{
	if (channel)
	{
		channel.appendLine(message);
	}
}

module.exports = { initLogger, log };
