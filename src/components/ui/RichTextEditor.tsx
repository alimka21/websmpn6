import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import {
  Bold, Italic, Underline as UnderlineIcon, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, RotateCcw
} from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Tulis konten berita...',
  minHeight = '300px'
}: RichTextEditorProps) {
  const [isUploading, setIsUploading] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      Image.configure({
        inline: true,
        allowBase64: true
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer'
        }
      }),
      Placeholder.configure({
        placeholder
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Typography
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validasi ukuran
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 5MB');
        return;
      }

      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        // Upload via fetch karena api.post belum support FormData dengan custom headers
        const token = localStorage.getItem('token') ||
                      JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token;

        const res = await fetch('/api/admin/upload/berita', {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: formData, // Browser auto-set Content-Type dengan boundary
          credentials: 'include'
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(errorData.error || `Upload failed (${res.status})`);
        }

        const response = await res.json();

        if (response.url) {
          editor?.chain().focus().setImage({ src: response.url }).run();
          toast.success('Gambar berhasil diupload');
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(error.message || 'Gagal upload gambar');
      } finally {
        setIsUploading(false);
      }
    };

    input.click();
  }, [editor]);

  const handleAddLink = useCallback(() => {
    const url = window.prompt('Masukkan URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="w-full p-4 border border-outline-variant rounded-xl bg-surface-container">
        <div className="animate-pulse text-on-surface-variant text-sm">Memuat editor...</div>
      </div>
    );
  }

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="bg-surface-container border-b border-outline-variant p-2 flex flex-wrap gap-1">
        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('bold') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Bold (Ctrl+B)"
          type="button"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('italic') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Italic (Ctrl+I)"
          type="button"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('underline') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Underline (Ctrl+U)"
          type="button"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <div className="w-px bg-outline-variant mx-1" />

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Heading 2"
          type="button"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Heading 3"
          type="button"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px bg-outline-variant mx-1" />

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('bulletList') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Bullet List"
          type="button"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('orderedList') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Ordered List"
          type="button"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('blockquote') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Blockquote"
          type="button"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px bg-outline-variant mx-1" />

        {/* Link & Image */}
        <button
          onClick={handleAddLink}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive('link') ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Tambah Link"
          type="button"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <button
          onClick={handleImageUpload}
          disabled={isUploading}
          className="p-2 rounded hover:bg-surface-container-high transition-colors text-on-surface disabled:opacity-50"
          title="Upload Gambar"
          type="button"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </button>

        <div className="w-px bg-outline-variant mx-1" />

        {/* Text Align */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Align Left"
          type="button"
        >
          <AlignLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Align Center"
          type="button"
        >
          <AlignCenter className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Align Right"
          type="button"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 rounded hover:bg-surface-container-high transition-colors ${
            editor.isActive({ textAlign: 'justify' }) ? 'bg-primary-container/20 text-primary' : 'text-on-surface'
          }`}
          title="Justify"
          type="button"
        >
          <AlignJustify className="w-4 h-4" />
        </button>

        <div className="w-px bg-outline-variant mx-1" />

        {/* Clear Format */}
        <button
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          className="p-2 rounded hover:bg-surface-container-high transition-colors text-on-surface"
          title="Clear Format"
          type="button"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="prose max-w-none p-4"
        style={{ minHeight }}
      />
    </div>
  );
}
