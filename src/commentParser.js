'use strict';

/**
 * Pure text-analysis helpers for locating comments and parsing the
 * image-comment syntax. This module must stay free of any vscode imports
 * so it can be unit-tested with plain Node.
 */

/**
 * Matches an image comment: optional description, then `[path]` at the end.
 *
 * ^(.*?)   captures any text (including none) at the beginning, lazily.
 * \[       matches the opening square bracket.
 * ([^\]]+) captures everything inside the brackets (no closing bracket).
 * \]       matches the closing square bracket.
 * \s*$     allows trailing whitespace.
 */
const IMAGE_COMMENT_PATTERN = /^(.*?)\[([^\]]+)\]\s*$/;

/**
 * Parses the text of a comment. Returns { description, imagePath } if it is
 * an image comment, otherwise null.
 */
function parseImageComment(commentText)
{
	if (typeof commentText !== 'string')
	{
		return null;
	}

	const match = commentText.match(IMAGE_COMMENT_PATTERN);
	if (!match)
	{
		return null;
	}

	const imagePath = match[2].trim();
	if (!imagePath)
	{
		return null;
	}

	return {
		description: match[1] ? match[1].trim() : '',
		imagePath
	};
}

/**
 * Counts non-overlapping occurrences of a substring.
 */
function countOccurrences(text, searchString)
{
	let count = 0;
	let index = text.indexOf(searchString);
	while (index !== -1)
	{
		count++;
		index = text.indexOf(searchString, index + searchString.length);
	}
	return count;
}

/**
 * Returns the comment text if the given character position sits inside a
 * single-line comment on this line, otherwise null.
 */
function getSingleLineCommentText(lineText, character, singleLineSymbols)
{
	for (const symbol of singleLineSymbols || [])
	{
		const symbolIndex = lineText.indexOf(symbol);
		if (symbolIndex !== -1 && character >= symbolIndex)
		{
			return lineText.substring(symbolIndex + symbol.length).trim();
		}
	}
	return null;
}

/**
 * Returns the comment text if the given character position sits inside a
 * block comment that opens and closes on this line, otherwise null.
 */
function getInlineBlockCommentText(lineText, character, startSymbol, endSymbol)
{
	const startIndex = lineText.indexOf(startSymbol);
	if (startIndex === -1)
	{
		return null;
	}

	const endIndex = lineText.indexOf(endSymbol, startIndex + startSymbol.length);
	if (endIndex === -1)
	{
		return null;
	}

	if (character > startIndex && character < endIndex)
	{
		return lineText.substring(startIndex + startSymbol.length, endIndex).trim();
	}

	return null;
}

/**
 * Determines whether a position is inside an unclosed block comment, given
 * all document text before that position. For symmetric delimiters such as
 * CoffeeScript's `###`, an odd number of occurrences means "inside".
 */
function isInsideMultiLineComment(textBeforePosition, startSymbol, endSymbol)
{
	if (startSymbol === endSymbol)
	{
		return countOccurrences(textBeforePosition, startSymbol) % 2 === 1;
	}

	const startMatches = countOccurrences(textBeforePosition, startSymbol);
	const endMatches = countOccurrences(textBeforePosition, endSymbol);
	return startMatches > endMatches;
}

/**
 * Extracts the text of the block comment surrounding the given document
 * offset. Returns an empty string if no complete comment is found.
 */
function extractMultiLineCommentText(documentText, offset, startSymbol, endSymbol)
{
	const textBeforePosition = documentText.substring(0, offset);
	const startSymbolIndex = textBeforePosition.lastIndexOf(startSymbol);

	if (startSymbolIndex === -1)
	{
		return '';
	}

	const textAfterStart = documentText.substring(startSymbolIndex + startSymbol.length);
	const endSymbolIndex = textAfterStart.indexOf(endSymbol);

	if (endSymbolIndex === -1)
	{
		return '';
	}

	return textAfterStart.substring(0, endSymbolIndex).trim();
}

/**
 * Wraps a text in the language's comment syntax. Falls back to `//` when the
 * language is unknown.
 */
function wrapComment(text, commentSymbols)
{
	if (commentSymbols && commentSymbols.singleLine && commentSymbols.singleLine.length > 0)
	{
		return `${commentSymbols.singleLine[0]} ${text}`;
	}

	if (commentSymbols && commentSymbols.multiLine)
	{
		return `${commentSymbols.multiLine.start} ${text} ${commentSymbols.multiLine.end}`;
	}

	return `// ${text}`;
}

module.exports = {
	parseImageComment,
	countOccurrences,
	getSingleLineCommentText,
	getInlineBlockCommentText,
	isInsideMultiLineComment,
	extractMultiLineCommentText,
	wrapComment
};
