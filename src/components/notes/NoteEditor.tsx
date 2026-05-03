import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NoteEditorProps {
  content: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  content, isEditing, onStartEdit, onChange, onBlur,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full h-full min-h-[120px] bg-transparent text-gray-100 text-sm resize-none outline-none placeholder-gray-500 font-mono"
        placeholder="Escreva em markdown..."
      />
    );
  }

  return (
    <div
      onClick={onStartEdit}
      className="w-full h-full min-h-[80px] cursor-text text-sm text-gray-200 prose prose-invert prose-sm max-w-none"
    >
      {content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      ) : (
        <span className="text-gray-500 italic">Clique para editar...</span>
      )}
    </div>
  );
};
