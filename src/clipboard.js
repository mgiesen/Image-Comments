'use strict';

/**
 * Platform-specific clipboard image detection (macOS and Windows).
 *
 * All detectors return a candidate file path (or null); validation and the
 * final result shape are handled centrally in detectImageFromClipboard.
 * This module deliberately does not import vscode — user-facing messages
 * are the caller's job.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { log } = require('./logger');

const execFileAsync = promisify(execFile);

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

function sanitizePath(rawPath)
{
	const cleaned = rawPath.replace(/[\x00-\x1F\x7F]/g, '').trim();
	return cleaned ? path.normalize(cleaned) : '';
}

function tryUnlink(filePath)
{
	try
	{
		fs.unlinkSync(filePath);
	}
	catch (error)
	{
		// The file may already be gone; nothing more we can do here.
	}
}

/**
 * Validates a candidate image file.
 * Returns { ok: true, extension } or { ok: false, reason, sizeBytes? }.
 */
function validateImageFile(filePath)
{
	let stats;
	try
	{
		stats = fs.statSync(filePath);
	}
	catch (error)
	{
		return { ok: false, reason: 'not-found' };
	}

	if (!stats.isFile())
	{
		return { ok: false, reason: 'not-a-file' };
	}

	const extension = path.extname(filePath).slice(1).toLowerCase();
	if (!IMAGE_EXTENSIONS.includes(extension))
	{
		return { ok: false, reason: 'unsupported-type' };
	}

	if (stats.size > MAX_IMAGE_SIZE)
	{
		return { ok: false, reason: 'too-large', sizeBytes: stats.size };
	}

	return { ok: true, extension };
}

function generateTempFilePath(extension)
{
	const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	return path.join(os.tmpdir(), `vscode-image-comments-${unique}.${extension}`);
}

/**
 * macOS: Returns the path of a file copied in Finder, or null.
 */
async function detectFilePathMac()
{
	const script = `try
	set fileRef to (the clipboard as «class furl»)
	return POSIX path of fileRef
on error
	return ""
end try`;

	try
	{
		const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
		return sanitizePath(stdout) || null;
	}
	catch (error)
	{
		log(`[Clipboard] macOS file path detection failed: ${error.message}`);
		return null;
	}
}

/**
 * macOS: Saves raw clipboard image data (e.g. a screenshot) to a temp file
 * and returns its path, or null.
 */
async function detectImageDataMac()
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
			return "none"
		end try
	end try
end try`;

	let tempFile = null;
	try
	{
		const { stdout } = await execFileAsync('osascript', ['-e', detectScript], { timeout: 5000 });
		const format = stdout.trim().toLowerCase();

		if (!IMAGE_EXTENSIONS.includes(format))
		{
			return null;
		}

		const clipboardClass = format === 'png'
			? '«class PNGf»'
			: format === 'jpg'
				? '«class JPEG»'
				: '«class GIFf»';

		tempFile = generateTempFilePath(format);
		const escapedPath = tempFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		const saveScript = `set imageData to (the clipboard as ${clipboardClass})
set fileRef to open for access POSIX file "${escapedPath}" with write permission
write imageData to fileRef
close access fileRef
return "success"`;

		const saveResult = await execFileAsync('osascript', ['-e', saveScript], { timeout: 10000 });

		if (saveResult.stdout.trim() !== 'success' || !fs.existsSync(tempFile))
		{
			tryUnlink(tempFile);
			return null;
		}

		return tempFile;
	}
	catch (error)
	{
		log(`[Clipboard] macOS image data detection failed: ${error.message}`);
		if (tempFile)
		{
			tryUnlink(tempFile);
		}
		return null;
	}
}

async function runPowerShell(script, timeout)
{
	const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
	return execFileAsync(
		'powershell.exe',
		['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript],
		{ timeout }
	);
}

/**
 * Windows: Returns the path of a file copied in Explorer, or null.
 */
async function detectFilePathWindows()
{
	const script = `$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.Windows.Forms; $fileList = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($fileList.Count -gt 0) { Write-Output $fileList[0] }`;

	try
	{
		const { stdout } = await runPowerShell(script, 5000);
		return sanitizePath(stdout) || null;
	}
	catch (error)
	{
		log(`[Clipboard] Windows file path detection failed: ${error.message}`);
		return null;
	}
}

/**
 * Windows: Saves raw clipboard image data to a temp file and returns its
 * path, or null.
 */
async function detectImageDataWindows()
{
	const tempFileBase = generateTempFilePath('png');
	try
	{
		const escapedTempFile = tempFileBase.replace(/`/g, '``').replace(/"/g, '`"');
		const script = `$ProgressPreference = 'SilentlyContinue'; $TempFile = "${escapedTempFile}"; Add-Type -AssemblyName System.Windows.Forms; $clipboard = [System.Windows.Forms.Clipboard]::GetImage(); if ($clipboard -ne $null) { $format = $clipboard.RawFormat.Guid; if ($format -eq [System.Drawing.Imaging.ImageFormat]::Png.Guid) { $ext = "png" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) { $ext = "jpg" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Gif.Guid) { $ext = "gif" } elseif ($format -eq [System.Drawing.Imaging.ImageFormat]::Bmp.Guid) { $ext = "bmp" } else { $ext = "png" }; $tempFile = $TempFile -replace '\\.png$', ".$ext"; try { $clipboard.Save($tempFile); Write-Output $tempFile } catch { Write-Error $_.Exception.Message } }`;

		const { stdout } = await runPowerShell(script, 10000);
		const outputFile = sanitizePath(stdout);

		if (!outputFile || !fs.existsSync(outputFile))
		{
			tryUnlink(tempFileBase);
			return null;
		}

		// The script only rewrites the extension, so the result must stay in
		// the temp directory. Reject anything else defensively.
		const tmpDir = path.normalize(os.tmpdir());
		if (!outputFile.toLowerCase().startsWith(tmpDir.toLowerCase() + path.sep))
		{
			tryUnlink(tempFileBase);
			return null;
		}

		return outputFile;
	}
	catch (error)
	{
		log(`[Clipboard] Windows image data detection failed: ${error.message}`);
		tryUnlink(tempFileBase);
		return null;
	}
}

/**
 * Detects an image in the clipboard. A copied image file wins over raw image
 * data; the detectors run sequentially so the clipboard is not read
 * concurrently and no temp file is written unless needed.
 *
 * Returns one of:
 *   { ok: true, filePath, extension, isTemporary }
 *   { ok: false, reason: 'too-large', sizeBytes }
 *   { ok: false, reason: 'no-image' }
 *   { ok: false, reason: 'unsupported-platform' }
 */
async function detectImageFromClipboard()
{
	let detectors;
	if (process.platform === 'darwin')
	{
		detectors = [
			{ detect: detectFilePathMac, isTemporary: false },
			{ detect: detectImageDataMac, isTemporary: true }
		];
	}
	else if (process.platform === 'win32')
	{
		detectors = [
			{ detect: detectFilePathWindows, isTemporary: false },
			{ detect: detectImageDataWindows, isTemporary: true }
		];
	}
	else
	{
		return { ok: false, reason: 'unsupported-platform' };
	}

	for (const { detect, isTemporary } of detectors)
	{
		const candidate = await detect();
		if (!candidate)
		{
			continue;
		}

		log(`[Clipboard] Candidate (${isTemporary ? 'clipboard data' : 'copied file'}): ${candidate}`);

		const validation = validateImageFile(candidate);
		if (validation.ok)
		{
			return { ok: true, filePath: candidate, extension: validation.extension, isTemporary };
		}

		log(`[Clipboard] Candidate rejected: ${validation.reason}`);

		if (isTemporary)
		{
			tryUnlink(candidate);
		}

		if (validation.reason === 'too-large')
		{
			return { ok: false, reason: 'too-large', sizeBytes: validation.sizeBytes };
		}
	}

	return { ok: false, reason: 'no-image' };
}

module.exports = {
	IMAGE_EXTENSIONS,
	MAX_IMAGE_SIZE,
	detectImageFromClipboard,
	validateImageFile
};
