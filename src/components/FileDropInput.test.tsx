import { createEvent, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { accepts } from '../lib/files';
import { renderWithProviders } from '../test/render';
import { FileDropInput } from './FileDropInput';

function Field({ onPick }: { onPick(file: File | null): void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <FileDropInput
      label="Виписка"
      placeholder="Оберіть або перетягніть файл"
      accept="application/pdf,.pdf"
      value={file}
      onChange={(next) => {
        setFile(next);
        onPick(next);
      }}
    />
  );
}

/** Drags the files over the field and drops them, as a browser does. */
function drop(target: Element, files: File[]) {
  const dataTransfer = { files, types: ['Files'], dropEffect: 'none' };
  for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
    const event = createEvent[type](target);
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    fireEvent(target, event);
  }
}

it('takes a file dropped onto the field', async () => {
  const onPick = vi.fn();
  renderWithProviders(<Field onPick={onPick} />);
  const field = await screen.findByText('Оберіть або перетягніть файл');
  const statement = new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' });

  const dragEnter = createEvent.dragEnter(field);
  Object.defineProperty(dragEnter, 'dataTransfer', { value: { files: [], types: ['Files'] } });
  fireEvent(field, dragEnter);
  expect(screen.getByText('Відпустіть файл тут')).toBeInTheDocument();

  drop(field, [statement]);

  expect(onPick).toHaveBeenCalledWith(statement);
  expect(screen.queryByText('Відпустіть файл тут')).not.toBeInTheDocument();
  expect(screen.getByText('statement.pdf')).toBeInTheDocument();
});

it('refuses a file of another type', async () => {
  const onPick = vi.fn();
  renderWithProviders(<Field onPick={onPick} />);

  drop(await screen.findByText('Оберіть або перетягніть файл'), [
    new File(['x'], 'photo.png', { type: 'image/png' }),
  ]);

  expect(onPick).not.toHaveBeenCalled();
  expect(screen.getByText('Файл «photo.png» не підходить: потрібен файл іншого типу')).toBeInTheDocument();
});

it('still lets the user choose a file', async () => {
  const onPick = vi.fn();
  const { container } = renderWithProviders(<Field onPick={onPick} />);
  const statement = new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' });

  await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, statement);

  expect(onPick).toHaveBeenCalledWith(statement);
});

it('matches files to accept lists', () => {
  const pdf = new File([''], 'Statement.PDF', { type: '' });
  const png = new File([''], 'photo.png', { type: 'image/png' });

  expect(accepts('application/pdf,.pdf', pdf)).toBe(true);
  expect(accepts('image/*', png)).toBe(true);
  expect(accepts('.xlsx', png)).toBe(false);
  expect(accepts(undefined, png)).toBe(true);
});
