/**
 * Markdown Content Renderer
 *
 * Detects and renders markdown content with proper formatting
 */

import React, { useMemo } from "react";
import { marked } from "marked";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

// Configure marked options for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const isMarkdown = (text: string): boolean => {
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#+\s/m, // Headers
    /\*\*[\s\S]+?\*\*/m, // Bold (including multiline)
    /(?<!\*)\*[\s\S]+?\*(?!\*)/m, // Italic (single asterisk, including multiline)
    /__[\s\S]+?__/m, // Bold alternate (including multiline)
    /~~[\s\S]+?~~/m, // Strikethrough (including multiline)
    /\[.+?\]\(.+?\)/m, // Links
    /^[-*+]\s+/m, // Lists (with one or more spaces)
    /^\d+\.\s/m, // Numbered lists
    /```[\s\S]*?```/m, // Code blocks (multiline)
    /`[^`]+`/m, // Inline code
    /^>\s/m, // Blockquotes
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const html = useMemo(() => {
    if (!isMarkdown(content)) {
      // If not markdown, preserve whitespace and render as plain text
      return {
        __html: `<p class="whitespace-pre-wrap">${escapeHtml(content)}</p>`,
      };
    }

    // Parse markdown to HTML
    const rendered = marked(content) as string;
    return { __html: rendered };
  }, [content]);

  return (
    <div
      className={`markdown-content max-w-none
        [&_p]:my-1 [&_p]:leading-relaxed
        [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h1]:mt-3
        [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-2 [&_h2]:mt-2
        [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1
        [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:my-1
        [&_h5]:text-xs [&_h5]:font-semibold [&_h5]:my-1
        [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:my-1
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
        [&_li]:my-0.5 [&_li]:pl-1
        [&_strong]:font-bold
        [&_em]:italic
        [&_del]:line-through
        [&_code]:bg-slate-200 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_code]:text-red-700
        [&_pre]:bg-slate-800 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre]:text-xs
        [&_pre_code]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0
        [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:my-2
        [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800
        [&_table]:border-collapse [&_table]:my-2 [&_table]:text-xs
        [&_th]:border [&_th]:border-slate-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-100 [&_th]:font-bold
        [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1
        [&_hr]:my-2 [&_hr]:border-t [&_hr]:border-slate-300
        ${className || ''}`}
      dangerouslySetInnerHTML={html}
    />
  );
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
