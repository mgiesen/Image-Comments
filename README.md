# Image Comments for Visual Studio Code

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/mgiesen.image-comments)
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/mgiesen.image-comments)

## Description

The `Image Comments` extension for Visual Studio Code allows you to add images, such as sketches or diagrams, directly into your source code. This helps to improve documentation and understanding, especially for complex algorithms. By visualizing code concepts, it makes them easier to comprehend and track over time.

![Image](readme/image-comment.png)

## Features

- Hover over comments to display custom images in a tooltip
- Simple syntax for linking images in comments
- Option to open images directly within the editor
- Option to scale images for better overview

## Requirements

- Visual Studio Code version 1.60.0 or higher

## Usage

- Place your image in a folder that is accessible relative to the source file you are working on.
- Insert a standard comment into your code.
- Append the relative image path, starting from the current file's folder, enclosed in square brackets to the comment.
- The image can be located in the same folder, a subfolder, or a parent folder of the current file.
- Hover over the comment to view the image directly within your IDE.

Javascript Examples:

```javascript
// If the image is in the same folder [image.png]

// If the image is in a subfolder [images/image.png]

// If the image is in a parent folder [../image.png]
```

Python Example:

```Python
# Functional comment [image-comments/image1.png]
```

SQL Example:

```sql
-- Functional comment [image-comments/image1.png]
```

## Installation

1. Open Visual Studio Code
2. Go to Extensions Marketplace
3. Search for "Image Comments"
4. Click the "Install" button

Or just install the extension from [marketplace](https://marketplace.visualstudio.com/items?itemName=mgiesen.image-comments&ssr=false#review-details).

## Supported File Types

- JavaScript
- Python
- C++
- C
- C#
- SQL
- TypeScript
- TypeScriptReact
- PHP
- Java
- Ruby
- Go
- Swift
- Kotlin
- Perl
- R
- ShellScript
- Lua
- Groovy
- PowerShell
- Rust
- Dart
- Haskell
- Elixir

## Limitations

Due to the limitations of Visual Studio Code, it is not possible to display images directly in the code. Therefore, this extension uses the solution of visualization via tooltips. The usage and styling of tooltips are also severely restricted. We do our best to always utilize all possibilities provided by Microsoft.

## Reporting Issues

If you encounter any problems or have suggestions, please open an issue on our GitHub [repository](https://github.com/mgiesen/Image-Comments).

## Contributing to This Project

We encourage contributions to this project and welcome collaborators who are interested in enhancing its functionality and features. Instead of forking and creating redundant versions, please consider submitting pull requests with your improvements. By working together, we can maintain a single, robust version of the project and ensure that all users benefit from the collective effort. Your contributions are highly valued and can make a significant impact on the project’s success. Thank you for supporting the open-source community!

## Author

Maximilian Giesen  
https://github.com/mgiesen
