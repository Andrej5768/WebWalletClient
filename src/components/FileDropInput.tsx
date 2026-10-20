import { FileInput, type FileInputProps } from '@mantine/core';
import { Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { accepts } from '../lib/files';
import classes from './FileDropInput.module.css';

type Props = Omit<FileInputProps<false>, 'onChange' | 'multiple'> & {
  onChange(file: File | null): void;
};

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

/** A file field that also takes a file dropped onto it; a file of another type is refused with a message. */
export function FileDropInput({ accept, onChange, error, ...props }: Props) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  // Entering and leaving child elements fires events too; the field is left when the count returns to zero
  const depth = useRef(0);

  const choose = (file: File | null) => {
    if (file && !accepts(accept, file)) {
      setRefused(t('files.wrongType', { name: file.name }));
      return;
    }
    setRefused(null);
    onChange(file);
  };

  return (
    <div
      className={classes.zone}
      data-dragging={dragging || undefined}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        choose(event.dataTransfer.files[0] ?? null);
      }}
    >
      <FileInput
        {...props}
        accept={accept}
        onChange={choose}
        error={refused ?? error}
        leftSection={<Upload size={16} />}
        classNames={{ input: classes.input }}
      />
      {dragging && (
        <div className={classes.overlay} aria-hidden>
          {t('files.drop')}
        </div>
      )}
    </div>
  );
}
